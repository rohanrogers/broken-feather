// Camera sessions own their worker, stream, and pending frame. Late callbacks
// cannot revive a cancelled session or mutate a newer one.
export class HandCamera {
  constructor({onResult,onState,onError,onDiagnostics}){Object.assign(this,{onResult,onState,onError,onDiagnostics});this.session=0;this.active=false;this.pending=false;this.cancelInit=null;this.video=null;this.worker=null;this.tracker=null;this.stream=null;this.busy=false;this.timer=null;this.raf=null;this.lastTimestamp=-Infinity;this.sampleCount=0;this.resultInterval=66;this.freshnessMs=180;this.lastResultTime=null;this.maxResultAgeMs=650;this.inferenceMs=0;this.frameAgeMs=0;this.slowFrames=0;this.fallbackTried=false;this.recovering=false;}
  stop(){this.session++;this.recovering=false;this.active=false;this.pending=false;this.cancelInit?.();this.cancelInit=null;clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.worker=null;this.tracker?.close();this.tracker=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;if(this.video)this.video.srcObject=null;this.busy=false;this.onState('off');}
  async start(video){
    if(this.active||this.pending)return;
    if(!navigator.mediaDevices?.getUserMedia||!window.isSecureContext){this.onError('Camera needs localhost or HTTPS. Mouse practice is available.');return;}
    const session=++this.session;this.pending=true;this.video=video;this.onState('loading');
    const ready=this.initTracker(session).then(()=>({ok:true}),error=>({error}));
    try{
      const incoming=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}}});
      if(session!==this.session){incoming.getTracks().forEach(t=>t.stop());return;}
      this.stream=incoming;for(const track of incoming.getVideoTracks())track.onended=()=>{if(session===this.session)this.fail('Camera disconnected. Reconnect it and try again.');};
      video.srcObject=incoming;await video.play();const result=await ready;if(session!==this.session)return;if(result.error)throw result.error;
      this.pending=false;this.active=true;this.busy=false;this.fallbackTried=false;this.slowFrames=0;this.recovering=false;this.lastCapture=-Infinity;this.lastVideoTime=-1;this.lastTimestamp=-Infinity;this.sampleCount=0;this.resultInterval=66;this.freshnessMs=180;this.lastResultTime=null;this.interval=this.tracker?66:30;this.onState('on');
      const pump=()=>{if(session!==this.session||!this.active)return;this.capture(session);if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(pump);else this.raf=setTimeout(pump,33);};pump();
    }catch(error){if(session===this.session){const messages={NotAllowedError:'Camera permission was blocked. Allow camera access and try again.',NotFoundError:'No camera found. Connect a camera, or try mouse practice.',NotReadableError:'The camera is busy. Close other camera apps and try again.'};this.fail(messages[error.name]||error.message||'The hand tracker could not start. Try mouse practice.');}}
  }
  async initTracker(session,delegate='GPU'){
    let candidate;
    try{
      candidate=new Worker(new URL('./tracker-worker.js?v=grip-16',import.meta.url),{type:'module'});this.worker=candidate;
      await new Promise((resolve,reject)=>{
        let finished=false;const done=error=>{if(finished)return;finished=true;clearTimeout(timeout);this.cancelInit=null;error?reject(error):resolve();};
        const timeout=setTimeout(()=>done(Error('Hand tracker loading timed out. Please retry.')),45000);this.cancelInit=()=>done(Error('Cancelled'));
        candidate.onerror=()=>{if(session!==this.session)return;if(!finished)done(Error('Worker unavailable'));else this.fail('Hand tracking stopped. Please retry the camera.');};
        candidate.onmessage=({data})=>{if(session!==this.session||this.worker!==candidate)return;if(data.type==='ready'){this.delegate=data.delegate;done();}else if(data.type==='error'){if(!finished)done(Error(data.message));else this.fail('Hand tracking stopped. Please retry the camera.');}else if(data.type==='result')this.consume(data,session);};
        candidate.postMessage({type:'init',delegate});
      });
    }catch(error){
      candidate?.terminate();if(session!==this.session)return;this.worker=null;
      const {FilesetResolver,HandLandmarker}=await import('./assets/mediapipe/vision_bundle.mjs');if(session!==this.session)return;
      const files=await FilesetResolver.forVisionTasks(new URL('./assets/mediapipe/wasm',import.meta.url).href,true);if(session!==this.session)return;
      const tracker=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./assets/hand_landmarker.task',import.meta.url).href,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5});
      if(session!==this.session){tracker.close();return;}this.tracker=tracker;this.delegate='CPU';
    }
  }
  async capture(session){
    const now=performance.now(),video=this.video;
    if(this.recovering||this.busy||document.hidden||video.readyState<2||now-this.lastCapture<this.interval||video.currentTime===this.lastVideoTime)return;
    this.busy=true;this.lastCapture=now;this.lastVideoTime=video.currentTime;
    this.timer=setTimeout(()=>{if(session===this.session&&this.busy)this.fail('Hand tracking stopped responding. Please retry the camera.');},5000);
    try{if(this.worker){const worker=this.worker,bitmap=await createImageBitmap(video);if(session!==this.session||worker!==this.worker){bitmap.close();return;}worker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);}
      else{const start=performance.now(),result=this.tracker.detectForVideo(video,now);this.consume({points:result.landmarks[0]??null,worldPoints:result.worldLandmarks[0]??null,timestamp:now,inferenceMs:performance.now()-start},session);}
    }catch(error){if(session===this.session)this.fail(error.message||'Camera frame could not be read. Please retry.');}
  }
  async recoverSlowTracker(session){
    if(session!==this.session||!this.active||this.recovering||this.fallbackTried||this.delegate!=='GPU')return;
    this.fallbackTried=true;this.recovering=true;this.onDiagnostics?.({type:'backend-recovery-start',timestamp:performance.now(),backend:this.delegate});clearTimeout(this.timer);this.timer=null;
    this.worker?.terminate();this.worker=null;this.busy=false;
    try{
      // Preserve the video stream and calibration. Only replace the slow
      // inference backend, once per camera session.
      await this.initTracker(session,'CPU');
      if(session!==this.session)return;
      this.interval=66;this.lastCapture=-Infinity;this.lastResultTime=null;this.resultInterval=66;this.slowFrames=0;this.onDiagnostics?.({type:'backend-recovery-ready',timestamp:performance.now(),backend:this.delegate});
    }catch(error){if(session===this.session)this.fail(error.message||'Hand tracker could not recover.');}
    finally{if(session===this.session)this.recovering=false;}
  }
  consume(data,session){
    if(session!==this.session)return;
    clearTimeout(this.timer);this.busy=false;const now=performance.now();
    if(!Number.isFinite(data.timestamp)||data.timestamp<=this.lastTimestamp||data.timestamp>now)return;
    this.frameAgeMs=now-data.timestamp;this.inferenceMs=Number.isFinite(data.inferenceMs)?data.inferenceMs:0;
    this.slowFrames=this.frameAgeMs>300||this.inferenceMs>250?this.slowFrames+1:Math.max(0,this.slowFrames-1);
    if(this.frameAgeMs>this.maxResultAgeMs){this.onDiagnostics?.({type:'stale-tracking-frame',timestamp:data.timestamp,arrivedAt:now,frameAgeMs:this.frameAgeMs,inferenceMs:this.inferenceMs,backend:this.delegate});if(this.slowFrames>=3)void this.recoverSlowTracker(session);return;}
    if(this.lastResultTime!==null){const cadence=now-this.lastResultTime;if(cadence>0&&cadence<1200)this.resultInterval=this.resultInterval*.6+cadence*.4;}
    this.lastResultTime=now;this.sampleCount++;this.freshnessMs=Math.min(900,Math.max(180,this.resultInterval*1.8));this.lastTimestamp=data.timestamp;
    this.interval=Math.min(140,Math.max(this.tracker?66:25,this.inferenceMs*1.1));
    this.onResult(data.points,data.timestamp,now,data.worldPoints??null);
    if(this.slowFrames>=3)void this.recoverSlowTracker(session);
  }
  fail(message){this.onDiagnostics?.({type:'tracker-error',timestamp:performance.now(),message});this.stop();this.onError(message);}
}
