// Streaming statistics keep every sample's contribution even when retained raw
// frames are compacted during a long user-controlled hold.
export const createStillness=()=>({samples:0,unwantedShots:0,missingSamples:0,poseRejectedSamples:0,firstCapturedAt:null,lastCapturedAt:null,channels:{}});
export function observeStillness(stats,frame,cueAt){
  if(frame.capturedAt<cueAt)return;
  stats.samples++;stats.unwantedShots+=frame.fired?1:0;stats.missingSamples+=frame.imageLandmarks?.length===21?0:1;stats.poseRejectedSamples+=frame.state?.pose?0:1;stats.firstCapturedAt??=frame.capturedAt;stats.lastCapturedAt=frame.capturedAt;
  const add=(name,value)=>{if(!Number.isFinite(value))return;const s=stats.channels[name]??={count:0,first:value,last:value,min:value,max:value,mean:0,m2:0};s.count++;const delta=value-s.mean;s.mean+=delta/s.count;s.m2+=delta*(value-s.mean);s.last=value;s.min=Math.min(s.min,value);s.max=Math.max(s.max,value);};
  add('aim.x',frame.state?.aimX);add('aim.y',frame.state?.aimY);
  add('palm.x',frame.hand?.center?.x);add('palm.y',frame.hand?.center?.y);add('direction.yaw',frame.hand?.direction?.yaw);add('direction.pitch',frame.hand?.direction?.pitch);add('aimDirection.yaw',frame.hand?.aimDirection?.yaw);add('aimDirection.pitch',frame.hand?.aimDirection?.pitch);
  for(const type of ['imageLandmarks','worldLandmarks'])for(const [i,p] of (frame[type]??[]).entries())for(const [axis,name] of ['x','y','z'].entries())add(`${type}.${i}.${name}`,p[axis]);
}
export function summarizeStillness(stats){
  return {...stats,channels:Object.fromEntries(Object.entries(stats.channels).map(([key,s])=>[key,{count:s.count,first:s.first,last:s.last,min:s.min,max:s.max,mean:s.mean,span:s.max-s.min,stdDev:Math.sqrt(Math.max(0,s.m2/Math.max(1,s.count))),maxDriftFromStart:Math.max(s.max-s.first,s.first-s.min)}])),note:'After-cue samples only. Hand and finger are intentionally held comfortably still; natural tremor is expected. Reported variation includes both physical movement and estimation noise, not a proven noise label. All samples contribute to statistics even if raw frames are compacted. Aim/image coordinates are normalized; world coordinates are estimated MediaPipe units.'};
}
