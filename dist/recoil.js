// Shot recognition uses camera-space movement of the whole palm. Estimated
// finger depth is deliberately not a firing signal; it remains free to aim.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class RecoilTrigger {
  constructor(){this.reset();}
  reset(){this.samples=[];this.lastTime=null;this.lastGripAt=-Infinity;this.lastShot=-Infinity;this.blockedAt=-Infinity;this.ready=false;this.gripSince=null;this.hold=null;this.candidate=null;this.lostAt=null;this.wasReady=false;}
  disarm(){this.ready=false;this.gripSince=null;this.candidate=null;this.samples=[];this.hold=null;this.wasReady=false;}
  lost(){if(this.lostAt===null){this.lostAt=this.lastTime;this.wasReady=this.ready;}this.ready=false;}
  predict(time,{canFire=true}={}){const c=this.candidate;this.candidate=null;if(!canFire||!c||time<c.observedAt||time-c.observedAt>180||time-this.lastShot<=740||!(this.ready||this.wasReady))return null;const horizon=clamp((time-c.observedAt)/1000,.04,.1);if(c.rise+c.speed*horizon<c.threshold)return null;this.lastShot=time;this.ready=false;this.wasReady=false;this.hold={peakY:c.y,startedAt:time};return c;}
  update(hand,time,{canFire=true}={}){
    if(!hand||!Number.isFinite(time)||this.lastTime!==null&&time<=this.lastTime)return {fire:false,ready:this.ready};
    const gap=this.lastTime===null?Infinity:time-this.lastTime;
    if(gap>650||this.lostAt!==null&&time-this.lostAt>250){this.samples=[];this.ready=false;this.gripSince=null;this.wasReady=false;this.hold=null;}
    if(hand.gunPose){this.lastGripAt=time;this.gripSince??=time;}
    else if(time-this.lastGripAt>350){this.gripSince=null;this.ready=false;}
    const allowedGrip=hand.gunPose||time-this.lastGripAt<=220&&hand.curled>=2;
    const sample={time,x:hand.center.x,y:hand.center.y,palmY:hand.palmY,size:hand.size,grip:hand.gunPose};
    this.samples.push(sample);this.samples=this.samples.filter(s=>time-s.time<=650);
    if(!canFire)this.blockedAt=time;
    // A shallow palm drift while tracing targets is not a recoil pulse.
    // Retain size scaling, with a floor that clears the measured aim-only drifts.
    const threshold=clamp(hand.size*.35,.06,.07),minSpeed=clamp(hand.size*1.2,.18,.32);
    let motion=null,partial=null;
    for(const base of this.samples){
      const age=(time-base.time)/1000;if(age<.035||age>.45||base.time<this.blockedAt||!base.grip)continue;
      const rise=base.y-sample.y,side=Math.abs(base.x-sample.x),coherent=base.palmY.filter((y,i)=>y-sample.palmY[i]>Math.max(.006,threshold*.4)).length;
      const speed=rise/age;
      // Four palm/wrist joints must travel upward together. A long-cadence
      // frame needs a larger displacement to compensate for missing detail.
      if(coherent<4||rise<side*.8||speed<minSpeed)continue;
      const between=this.samples.filter(s=>s.time>=base.time);
      const rising=between.slice(1).filter((s,i)=>between[i].y-s.y>.0015).length;
      const interrupted=gap>=100||this.lostAt!==null&&time-this.lostAt<=250;
      const continuous=rising>=2||interrupted&&rise>=threshold*1.25;
      const evidence={startTime:base.time,observedAt:time,rise,speed,threshold,y:sample.y};
      if(rise>=threshold&&continuous&&(!motion||rise>motion.rise))motion=evidence;
      if(rise>=threshold*.5&&age<=.18&&(!partial||speed>partial.speed))partial=evidence;
    }
    const freshReturn=this.lostAt!==null&&time-this.lostAt<=250&&this.wasReady;
    this.lostAt=null;
    // A valid pre-lift grip is enough for a strong coherent gesture; brief
    // finger-pose errors during the lift must not erase that established grip.
    const established=this.gripSince!==null&&time-this.gripSince>=150;
    const eligible=this.ready||freshReturn||established&&!this.hold;
    const fire=canFire&&allowedGrip&&eligible&&time-this.lastShot>740&&!!motion;
    this.candidate=!fire&&canFire&&allowedGrip&&(this.ready||freshReturn)&&partial?partial:null;
    if(fire){this.lastShot=time;this.hold={peakY:sample.y,startedAt:time};this.ready=false;this.wasReady=false;}
    else{
      if(this.hold){this.hold.peakY=Math.min(this.hold.peakY,sample.y);const lower=sample.y-this.hold.peakY>threshold*.45;
        const quiet=this.samples.filter(s=>time-s.time<=250),steady=quiet.length>=3&&time-quiet[0].time>=150&&Math.max(...quiet.map(s=>s.y))-Math.min(...quiet.map(s=>s.y))<.018;
        if(lower||steady&&time-this.lastShot>740)this.hold=null;
      }
      if(allowedGrip&&established&&!this.hold&&time-this.lastShot>740&&!motion)this.ready=true;
    }
    this.lastTime=time;this.wasReady=false;
    return {fire,ready:this.ready,returnRequired:!!this.hold,startTime:motion?.startTime??null,evidence:motion??partial};
  }
}
