const coords=f=>[f.imageLandmarks?.map(([x,y,z])=>({x,y,z})),f.worldLandmarks?.map(([x,y,z])=>({x,y,z}))];
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
export function runSteeringReplay(data,Controller,describe,modern){
 const controller=new Controller(),frames=data.parts.flatMap(p=>p.frames.map(f=>({...f,part:p.stage}))).sort((a,b)=>a.capturedAt-b.capturedAt);
 const start=frames[0].capturedAt,baseline=frames.filter(f=>f.capturedAt<=start+450&&f.hand).map(f=>{const [p,w]=coords(f),h=describe(p,w);return {direction:modern?h.aimDirection:h.direction,extent:h.aimExtent};});
 const neutral={yaw:median(baseline.map(s=>s.direction.yaw)),pitch:median(baseline.map(s=>s.direction.pitch))},extent=modern?median(baseline.map(s=>s.extent)):null;
 controller.setNeutral(neutral,frames[0].state.deadband,extent);
 const path=[];
 for(const f of frames){const [p,w]=coords(f);if(!p){controller.invalidate();continue;}const result=controller.update(p,f.capturedAt,w,{canFire:false});if(result.valid)path.push({time:f.capturedAt,x:result.aim.x,y:result.aim.y,part:f.part});}
 return {path,neutral,extent};
}
export const summarizePath=path=>Object.fromEntries(['x','y'].map(axis=>{const values=path.map(p=>p[axis]),mean=values.reduce((a,b)=>a+b,0)/values.length;let travel=0;for(let i=1;i<values.length;i++)travel+=Math.abs(values[i]-values[i-1]);return [axis,{span:Math.max(...values)-Math.min(...values),stdDev:Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length),totalTravel:travel}];}));

// Current-space captures contain their own neutral and extent. Preserve actual
// recenter events and ignore every shot event when checking mapping changes.
export function replayRecordedCalibration(data,Controller){
 const controller=new Controller(),path=[];let calibrationKey=null;
 for(const part of data.parts)for(const frame of part.frames){
  const state=frame.state,key=JSON.stringify([state.neutral,state.deadband,state.aimExtent]);
  if(key!==calibrationKey){controller.setNeutral(state.neutral,state.deadband,state.aimExtent);calibrationKey=key;}
  const points=frame.imageLandmarks?.map(([x,y,z])=>({x,y,z})),world=frame.worldLandmarks?.map(([x,y,z])=>({x,y,z}));
  if(!points){controller.invalidate();continue;}
  const result=controller.update(points,frame.capturedAt,world,{canFire:false});
  if(result.valid&&frame.capturedAt>=part.cueAt)path.push({stage:part.stage,time:(frame.capturedAt-part.cueAt)/1000,x:result.aim.x,y:result.aim.y});
 }
 return path;
}
