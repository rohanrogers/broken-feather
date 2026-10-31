import {fingerSteering,mapSteering} from './steering.js?v=grip-16';
import {RecoilTrigger} from './recoil.js?v=grip-16';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const alpha=(cutoff,dt)=>1/(1+1/(2*Math.PI*cutoff*dt));
export class OneEuro {
  constructor(min=1.8,beta=4){this.min=min;this.beta=beta;this.reset();}
  reset(){this.value=null;this.raw=null;this.time=null;this.derivative=0;}
  update(value,time){if(!Number.isFinite(value)||!Number.isFinite(time))return this.value;if(this.time!==null&&time<=this.time)return this.value;if(this.time===null||time-this.time>500){this.value=this.raw=value;this.time=time;this.derivative=0;return value;}const dt=(time-this.time)/1000;this.derivative+=alpha(1.5,dt)*((value-this.raw)/dt-this.derivative);this.value+=alpha(this.min+this.beta*Math.abs(this.derivative),dt)*(value-this.value);this.raw=value;this.time=time;return this.value;}
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const valid3D=points=>Array.isArray(points)&&points.length===21&&points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));
const distance3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
export function describeHand(points,worldPoints=null){
  if(!Array.isArray(points)||points.length!==21||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  const center=[0,5,9,13,17].reduce((s,i)=>({x:s.x+points[i].x/5,y:s.y+points[i].y/5}),{x:0,y:0});
  const size=(dist(points[0],points[9])+dist(points[5],points[17]))/2;
  if(center.x<0||center.x>1||center.y<0||center.y>1||size<.025||size>.65)return null;
  // World-space bone geometry is invariant to turning a finger toward the
  // camera. Screen-space length alone collapses for this natural aiming pose.
  const joints=valid3D(worldPoints)?worldPoints:points;
  const extended=(base,pip,dip,tip)=>{
    const chain=distance3(joints[base],joints[pip])+distance3(joints[pip],joints[dip])+distance3(joints[dip],joints[tip]);
    const straightness=distance3(joints[base],joints[tip])/Math.max(chain,.00001);
    const outward=distance3(joints[tip],joints[0])/Math.max(distance3(joints[pip],joints[0]),.00001);
    return straightness>.78&&outward>1.02;
  };
  const middle=extended(9,10,11,12);
  // Ring/little foreshortening can push a folded tip just beyond its first
  // joint. Keep that tolerance separate from the extended middle finger.
  const compact=(pip,tip)=>distance3(joints[tip],joints[0])/Math.max(distance3(joints[pip],joints[0]),.00001)<1.20;
  const ringFolded=compact(14,16),littleFolded=compact(18,20);
  const index=extended(5,6,7,8),curled=[[9,10,11,12],[13,14,15,16],[17,18,19,20]].filter(ids=>!extended(...ids)).length;
  const palmSize=(distance3(joints[0],joints[9])+distance3(joints[5],joints[17]))/2;
  const visiblyRaisedThumb=points[2].y-points[4].y>size*.2&&dist(points[4],points[2])>size*.35;
  const thumb=visiblyRaisedThumb||distance3(joints[4],joints[5])>palmSize*.35;
  const indexLength=distance3(joints[5],joints[8]);
  // A finger aimed into the lens is often partially occluded. Permit a
  // compact front grip with thumb raised and other fingers curled instead
  // of requiring a long visible index silhouette.
  const frontGrip=thumb&&(curled>=2||ringFolded&&littleFolded&&index&&middle)&&dist(points[8],points[5])<size*.85&&dist(points[8],points[0])>dist(points[5],points[0])*.7;
  const forward=Math.max(frontGrip?.85:0,clamp(((-(joints[8].z??0)+(joints[5].z??0))/Math.max(indexLength,.00001)-.35)/.45,0,1));
  const vector={x:joints[8].x-joints[5].x,y:joints[8].y-joints[5].y,z:(joints[8].z??0)-(joints[5].z??0)};
  const proximal={x:joints[6].x-joints[5].x,y:joints[6].y-joints[5].y,z:(joints[6].z??0)-(joints[5].z??0)},proximalLength=Math.hypot(proximal.x,proximal.y,proximal.z);
  // Restore the earlier base-weighted direction estimate. The inferred tip
  // contributes a little without locking aim when joint estimates disagree.
  const proximalWeight=proximalLength>indexLength*.15?.75:0;
  const direction={yaw:-(proximalWeight*proximal.x/Math.max(proximalLength,.00001)+(1-proximalWeight)*vector.x/Math.max(indexLength,.00001)),pitch:proximalWeight*proximal.y/Math.max(proximalLength,.00001)+(1-proximalWeight)*vector.y/Math.max(indexLength,.00001)};
  // A screen-facing index may be completely hidden behind its knuckle.
  // Accept the visible raised-thumb / curled-finger grip in that case;
  // demanding a confidently extended hidden tip creates false rejections.
  const strictGunPose=thumb&&curled>=2,twoFingerCandidate=thumb&&index&&middle&&ringFolded&&littleFolded;
  const pointingGrip=strictGunPose||twoFingerCandidate;
  const palmAxes=[5,9,17].map(i=>{const v={x:joints[i].x-joints[0].x,y:joints[i].y-joints[0].y,z:(joints[i].z??0)-(joints[0].z??0)},length=Math.hypot(v.x,v.y,v.z);return {x:v.x/Math.max(length,.00001),y:v.y/Math.max(length,.00001),z:v.z/Math.max(length,.00001),imageX:points[i].x-points[0].x,imageY:points[i].y-points[0].y};});
  const steering=fingerSteering(points,worldPoints);
  return {aimDirection:steering.direction,aimExtent:steering.extent,aimSource:steering.source,aimUsable:steering.usable,strictGunPose,twoFingerCandidate,middle,ringFolded,littleFolded,gripVariant:pointingGrip?(middle?'two-finger':'one-finger-or-foreshortened'):null,center:{x:1-center.x,y:center.y},palmY:[0,5,9,13,17].map(i=>points[i].y),size,gunPose:pointingGrip,forward,index,curled,thumb,direction,palmAxes};
}

// Steering uses palm-scaled proximal XY; shooting retains its own whole-palm
// movement state, so pose noise and old return positions cannot latch aiming.
export class HandAim {
  constructor(){this.range=.5;this.reset();}
  reset(){this.fx=new OneEuro(1.15,.65);this.fy=new OneEuro(1.15,.65);this.trigger=new RecoilTrigger();this.samples=[];this.directionWindow=[];this.lastTime=null;this.lastSeen=null;this.lastPoseAt=null;this.poseSince=null;this.softGripSince=null;this.softGripSamples=0;this.pose=false;this.aimValid=false;this.armed=false;this.settleSince=null;this.lastShot=-Infinity;this.anchor={x:.5,y:.5};this.neutral=null;this.aimExtent=null;this.latestExtent=null;this.latestDirection=null;this.aim={x:.5,y:.5};this.returning=false;this.history=[];this.noise=.004;this.lostTrigger=null;this.exitCandidate=null;this.release=null;this.lostAt=null;}
  setNeutral(direction,noise=.004,extent=null){this.trigger.disarm();this.release=null;this.directionWindow=[];this.exitCandidate=null;this.lostTrigger=null;this.neutral={...direction};this.aimExtent=extent??this.latestExtent??1.1;this.noise=clamp(noise,.004,.012);this.fx.reset();this.fy.reset();this.aim={x:.5,y:.5};this.anchor={...this.aim};this.history=[];this.armed=false;this.settleSince=null;this.returning=false;}
  disarm(){this.trigger.disarm();this.armed=false;this.settleSince=null;}
  predictExit(time,{canFire=true}={}){
    const candidate=this.exitCandidate;this.exitCandidate=null;const event=this.trigger.predict(time,{canFire});
    if(!event)return null;this.armed=false;this.lastShot=time;this.returning=true;this.release=this.trigger.hold;
    return {...(candidate?.aim??this.anchor),observedAt:event.observedAt};
  }
  recenter(){if(!this.aimValid||!this.latestDirection)return false;this.setNeutral(this.latestDirection,this.noise,this.latestExtent);return true;}
  invalidate(){this.lostAt??=this.lastTime;this.trigger.lost();this.pose=false;this.aimValid=false;this.armed=false;this.poseSince=null;this.lastPoseAt=null;this.settleSince=null;this.lastSeen=null;this.lastTime=null;this.returning=false;}
  update(points,time,worldPoints=null,{canFire=true}={}){
    const hand=describeHand(points,worldPoints);if(!hand||!Number.isFinite(time))return {valid:false};
    if(this.lastTime!==null&&time<=this.lastTime)return {valid:false};
    const gap=this.lastTime===null?Infinity:time-this.lastTime;
    if(this.returning&&time-this.lastShot>350)this.returning=false;
    if(gap>650&&!(this.lostAt!==null&&time-this.lostAt<=250)){this.directionWindow=[];this.samples=[];this.history=[];this.poseSince=null;this.softGripSince=null;this.softGripSamples=0;}
    const prev=this.samples.at(-1),dt=prev?(time-prev.time)/1000:0;
    if(prev&&dt<.14&&dist(prev,hand.center)>.27)return {valid:false};
    this.lostAt=null;this.lastTime=time;this.lastSeen=time;this.latest=hand.center;this.latestDirection=hand.aimDirection;this.latestExtent=hand.aimExtent;this.aimValid=hand.aimUsable;
    if(this.aimValid)this.directionWindow.push({...hand.aimDirection,time});this.directionWindow=this.directionWindow.filter(p=>time-p.time<=110).slice(-5);
    const median=key=>{const sorted=this.directionWindow.map(p=>p[key]).sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
    const direction={yaw:median('yaw'),pitch:median('pitch')};
    const speed=prev?dist(prev,hand.center)/Math.max(dt,.001):0,angularSpeed=prev?Math.hypot(hand.direction.pitch-prev.pitch,hand.direction.yaw-prev.yaw)/Math.max(dt,.001):0,oldAim={...this.aim};
    this.samples.push({...hand.center,...hand.direction,palmY:hand.palmY,palmAxes:hand.palmAxes,size:hand.size,time});this.samples=this.samples.filter(s=>time-s.time<=650);
    if(hand.twoFingerCandidate){this.softGripSince??=time;this.softGripSamples=Math.min(3,this.softGripSamples+1);}else{this.softGripSince=null;this.softGripSamples=0;}
    const shootingGrip=hand.strictGunPose||(this.softGripSince!==null&&time-this.softGripSince>=100&&this.softGripSamples>=3);hand.gripConfirmed=shootingGrip;
    if(shootingGrip)this.lastPoseAt=time;
    const poseGrace=this.lastPoseAt!==null&&time-this.lastPoseAt<=220&&hand.curled>=2&&(hand.index||hand.thumb)&&(speed>.2||angularSpeed>2);
    const event=this.trigger.update({...hand,gunPose:shootingGrip},time,{canFire:canFire&&this.aimValid});
    this.pose=shootingGrip||poseGrace||event.fire;this.poseSince=this.pose?(this.poseSince??time):null;if(!this.neutral){this.neutral={...hand.aimDirection};this.aimExtent=hand.aimExtent;}
    this.armed=event.ready;this.release=this.trigger.hold;
    const shotAim=this.history.filter(s=>s.time<=(event.startTime??time-90)).at(-1)?.aim??this.anchor;
    const candidate=this.trigger.candidate;
    this.exitCandidate=candidate?{...candidate,aim:{...(this.history.filter(s=>s.time<=candidate.startTime).at(-1)?.aim??this.anchor)}}:null;
    if(event.fire){this.lastShot=time;this.returning=true;this.aim={...shotAim};}
    else if(!this.returning&&this.aimValid){
      const neutral=this.neutral??hand.aimDirection;
      const mapped=mapSteering(direction,neutral,this.aimExtent??1.1,this.range);
      const filtered={x:this.fx.update(mapped.x,time),y:this.fy.update(mapped.y,time)},step=clamp(Number.isFinite(gap)?gap/1000:1/30,.001,.1)*1.7;
      for(const axis of ['x','y']){const delta=filtered[axis]-this.aim[axis];if(Math.abs(delta)>this.noise)this.aim[axis]+=clamp(delta-Math.sign(delta)*this.noise,-step,step);}
      if(gap>180&&Number.isFinite(gap))this.aim={x:oldAim.x+(this.aim.x-oldAim.x)*.15,y:oldAim.y+(this.aim.y-oldAim.y)*.15};
    }
    if(this.armed&&!candidate)this.anchor={...this.aim};
    this.history.push({time,aim:{...this.aim}});this.history=this.history.filter(s=>time-s.time<650);
    return {valid:true,aimValid:this.aimValid,pose:this.pose,armed:this.armed,aim:{...this.aim},fire:event.fire?{...shotAim}:null,hand,triggerEvidence:event.evidence};
  }
}

// Capture a comfortable neutral pose. Small human tremor and one briefly
// missing/uncertain frame pause collection rather than restarting a timer.
export class AimCalibration {
  constructor(){this.reset();}
  get target(){return {name:'center',label:'CENTER',x:.5,y:.5,hold:900};}
  reset(){this.duration=0;this.samples=[];this.lastTime=null;this.progress=0;this.complete=false;this.neutral=null;this.extent=null;this.noise=.004;this.reason='Point comfortably at the centre — small movement is fine';}
  capture(direction,noise=.004,extent=this.extent){this.neutral={...direction};this.extent=extent;this.noise=clamp(noise,.004,.012);this.complete=true;this.progress=1;return true;}
  observe(hand,time){
    if(this.complete)return true;
    if(!Number.isFinite(time)||this.lastTime!==null&&time<=this.lastTime)return false;
    if(this.lastTime!==null&&time-this.lastTime>650)this.reset();
    if(hand?.aimUsable===false){this.reason='Keep your index and knuckle visible';return false;}
    if(!hand?.gunPose){this.reason=!hand?'Show your hand — your progress waits':!hand.thumb?'Thumb up; fold ring and little fingers':'Fold ring and little fingers; point one or two forward';return false;}
    const input=hand.aimDirection??hand.direction;
    const previous=this.samples.at(-1),dt=this.lastTime===null?0:time-this.lastTime;
    // Only a large turn starts a fresh capture; ordinary hand tremor does not.
    if(previous&&Math.hypot(input.yaw-previous.yaw,input.pitch-previous.pitch)>.35)this.reset();
    else this.duration+=clamp(dt,0,300);
    this.lastTime=time;this.samples.push({...input,extent:hand.aimExtent,time});this.samples=this.samples.filter(p=>time-p.time<=1200);
    this.progress=clamp(this.duration/this.target.hold,0,1);this.reason='Finding your centre — relax your hand';
    if(this.duration<this.target.hold||this.samples.length<4)return false;
    const middle=key=>{const sorted=this.samples.map(p=>p[key]).sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
    const neutral={yaw:middle('yaw'),pitch:middle('pitch')};
    const deviations=this.samples.map(p=>Math.hypot(p.yaw-neutral.yaw,p.pitch-neutral.pitch)).sort((a,b)=>a-b);
    // A robust central spread ignores isolated bad landmarks, while a large
    // ongoing sweep is collected in a sliding window instead of reset loops.
    const spread=deviations[Math.floor((deviations.length-1)*.75)];
    if(spread>.10){this.reason='Point roughly at the centre for a moment';return false;}
    this.extent=middle('extent');return this.capture(neutral,spread*.5);
  }
}
