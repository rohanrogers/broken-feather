import {loadTrackingModel} from './tracker-assets.js?v=loading-17';
let tracker;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    const progress=detail=>self.postMessage({type:'progress',...detail});
    try{
      progress({stage:'runtime'});
      const {FilesetResolver,HandLandmarker}=await import('./assets/mediapipe/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks(new URL('./assets/mediapipe/wasm',self.location.href).href,true);
      const model=await loadTrackingModel(new URL('./assets/hand_landmarker.task',self.location.href),{onProgress:progress});
      progress({stage:'initializing'});
      const preferred=data.delegate==='CPU'?'CPU':'GPU',options={baseOptions:{modelAssetBuffer:model,delegate:preferred},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5};
      let delegate=preferred;
      try{tracker=await HandLandmarker.createFromOptions(files,options);}
      catch(error){if(preferred==='CPU')throw error;progress({stage:'fallback'});options.baseOptions.delegate='CPU';delegate='CPU';tracker=await HandLandmarker.createFromOptions(files,options);}
      progress({stage:'tracker-ready'});self.postMessage({type:'ready',delegate});
    }catch(e){self.postMessage({type:'error',message:e.message});}
  }else if(data.type==='frame'){
    const start=performance.now();try{const result=tracker.detectForVideo(data.bitmap,data.timestamp);self.postMessage({type:'result',points:result.landmarks[0]??null,worldPoints:result.worldLandmarks[0]??null,timestamp:data.timestamp,inferenceMs:performance.now()-start});}catch(e){self.postMessage({type:'error',message:e.message});}finally{data.bitmap.close();}
  }
};
