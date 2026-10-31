import {clamp} from './controls.js?v=grip-16';
export const W=1600,H=900,ROUND_SECONDS=60,RELOAD_SECONDS=1.6,SHOT_COOLDOWN=.72,SPREAD=53;
export class Hunt {
  constructor(random=Math.random){this.random=random;this.viewAspect=1;this.reset();}
  reset(){this.time=ROUND_SECONDS;this.score=0;this.shells=6;this.reload=0;this.cooldown=0;this.birds=[];this.falling=[];this.particles=[];this.labels=[];this.elapsed=0;this.roundElapsed=0;this.spawnIn=.2;this.kills=0;this.shots=0;this.hitShots=0;this.combo=0;this.lastKill=-Infinity;this.escaped=0;this.done=false;this.serial=0;}
  spawn(){const depth=this.random(),size=depth<.3?66:depth<.7?92:122,dir=this.random()<.5?1:-1;const b={id:++this.serial,x:dir===1?-size:W+size,y:110+this.random()*420,baseY:0,vx:dir*(150+this.random()*130+(1-depth)*65+this.elapsed*.9),size,phase:this.random()*Math.PI*2,age:0,value:size===66?200:size===92?150:100};b.baseY=b.y;this.birds.push(b);return b;}
  reloadWeapon(){if(this.shells===6||this.reload>0||this.done)return false;this.reload=RELOAD_SECONDS;this.combo=0;return true;}
  fire(x,y){
    if(this.done||this.cooldown>0||this.reload>0||this.shells<=0||!Number.isFinite(x)||!Number.isFinite(y))return null;
    this.shells--;this.shots++;this.cooldown=SHOT_COOLDOWN;
    const hit=this.birds.filter(b=>Math.hypot((b.x-x)/1.04,(b.y-y)*this.viewAspect/.9)<SPREAD+b.size*.34),ids=new Set(hit.map(b=>b.id));
    this.birds=this.birds.filter(b=>!ids.has(b.id));let earned=0;
    if(hit.length){this.hitShots++;this.combo=this.elapsed-this.lastKill<3?Math.min(4,this.combo+1):1;this.lastKill=this.elapsed;
      for(const b of hit){this.kills++;const points=b.value*this.combo;earned+=points;this.falling.push({...b,life:.62,rotation:0});this.labels.push({x:b.x,y:b.y-35,text:`+${points}`,life:1});
        for(let i=0;i<11;i++){const a=this.random()*Math.PI*2,s=60+this.random()*140;this.particles.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-70,life:.7+this.random()*.4,max:1.1,angle:a,spin:(this.random()-.5)*9,size:4+this.random()*6});}
      }this.score+=earned;
    }else this.combo=0;
    if(this.shells===0)this.reload=RELOAD_SECONDS;
    return {hit:hit.length,earned,x,y};
  }
  update(delta,{holdRound=false}={}){
    const dt=clamp(delta,0,.05);if(this.done)return;
    this.elapsed+=dt;if(!holdRound)this.roundElapsed+=dt;this.time=Math.max(0,ROUND_SECONDS-this.roundElapsed);this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.reload>0){this.reload=Math.max(0,this.reload-dt);if(this.reload===0)this.shells=6;}
    this.spawnIn-=dt;if(this.spawnIn<=0){this.spawn();this.spawnIn=.62+this.random()*.55-Math.min(.25,this.elapsed*.004);}
    for(const b of this.birds){b.age+=dt;b.x+=b.vx*dt;b.y=b.baseY+Math.sin(b.age*2.4+b.phase)*38+Math.sin(b.age*4+b.phase)*9;}
    this.birds=this.birds.filter(b=>{if((b.vx>0&&b.x>W+b.size*1.5)||(b.vx<0&&b.x<-b.size*1.5)){this.escaped++;return false;}return true;});
    for(const b of this.falling){b.life-=dt;b.y+=180*dt;b.rotation+=Math.sign(b.vx)*dt*2.5;}this.falling=this.falling.filter(b=>b.life>0);
    for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.angle+=p.spin*dt;}this.particles=this.particles.filter(p=>p.life>0);
    for(const l of this.labels){l.life-=dt;l.y-=35*dt;}this.labels=this.labels.filter(l=>l.life>0);
    if(this.elapsed-this.lastKill>3)this.combo=0;
    if(this.time===0)this.done=true;
  }
}
