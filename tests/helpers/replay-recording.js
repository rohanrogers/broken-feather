import {HandAim} from '../../dist/controls.js';
import {Hunt} from '../../dist/game.js';
// Replay complete controller + weapon availability; do not reuse the old
// detector's armed/cooldown decisions or its recorded fire labels.
export function replayRecording(recording,{Controller=HandAim}={}){
  const controller=new Controller(),game=new Hunt(()=>.5),fires=[];
  game.shells=recording.parts[0].frames[0].before.shells;
  let previous=null;
  const frames=[...recording.parts.flatMap(p=>p.frames.map(f=>({...f,part:p.number}))),...(recording.postConfirmationFrames??[]).map(f=>({...f,part:10}))].sort((a,b)=>a.capturedAt-b.capturedAt);
  for(const frame of frames){
    if(previous!==null){let delta=(frame.capturedAt-previous)/1000;while(delta>0){const step=Math.min(.05,delta);game.update(step,{holdRound:true});delta-=step;}}
    previous=frame.capturedAt;
    const points=frame.imageLandmarks?.map(([x,y,z])=>({x,y,z})),world=frame.worldLandmarks?.map(([x,y,z])=>({x,y,z})),canFire=game.reload<=0&&game.cooldown<=0;
    if(!points||points.length!==21){const shot=controller.predictExit(frame.capturedAt,{canFire});if(shot&&game.fire(800,450))fires.push({time:frame.capturedAt,part:frame.part,predicted:true});controller.invalidate();continue;}
    const result=controller.update(points,frame.capturedAt,world,{canFire});
    if(!result.valid){const shot=controller.predictExit(frame.capturedAt,{canFire});if(shot&&game.fire(800,450))fires.push({time:frame.capturedAt,part:frame.part,predicted:true});controller.invalidate();continue;}
    if(result.fire&&result.pose&&game.fire(800,450))fires.push({time:frame.capturedAt,part:frame.part,predicted:false,evidence:result.triggerEvidence});
  }
  return fires;
}
export function matchInferredIntents(fires,labels){
  const matched=new Set(),outcomes=labels.attempts.map(label=>{const found=fires.find((f,i)=>!matched.has(i)&&f.time>=label.evidence.start-80&&f.time<=label.evidence.peak+220);if(found)matched.add(fires.indexOf(found));return {attempt:label.attempt,detected:!!found,shot:found??null};});
  return {inferredIntentsDetected:outcomes.filter(x=>x.detected).length,totalInferredIntents:outcomes.length,unmatchedDetections:fires.filter((_,i)=>!matched.has(i)),outcomes,allDetections:fires};
}
