import {FilesetResolver,HandLandmarker} from './assets/mediapipe/vision_bundle.mjs';
let tracker;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{const files=await FilesetResolver.forVisionTasks(new URL('./assets/mediapipe/wasm',self.location.href).href,true);const preferred=data.delegate==='CPU'?'CPU':'GPU',options={baseOptions:{modelAssetPath:new URL('./assets/hand_landmarker.task',self.location.href).href,delegate:preferred},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5};let delegate=preferred;try{tracker=await HandLandmarker.createFromOptions(files,options);}catch{options.baseOptions.delegate='CPU';delegate='CPU';tracker=await HandLandmarker.createFromOptions(files,options);}self.postMessage({type:'ready',delegate});}catch(e){self.postMessage({type:'error',message:e.message});}
  }else if(data.type==='frame'){
    const start=performance.now();try{const result=tracker.detectForVideo(data.bitmap,data.timestamp);self.postMessage({type:'result',points:result.landmarks[0]??null,worldPoints:result.worldLandmarks[0]??null,timestamp:data.timestamp,inferenceMs:performance.now()-start});}catch(e){self.postMessage({type:'error',message:e.message});}finally{data.bitmap.close();}
  }
};
