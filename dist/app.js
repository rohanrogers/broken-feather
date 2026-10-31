import {AimPresence} from './aim-presence.js?v=grip-16';
import {Hunt,W,H,SPREAD,RELOAD_SECONDS,SHOT_COOLDOWN} from './game.js?v=grip-16';
import {HandAim,AimCalibration,OneEuro,clamp} from './controls.js?v=grip-16';
import {HandCamera} from './camera.js?v=grip-16';
import {ArcadeAudio} from './audio.js?v=grip-16';
const $=id=>document.getElementById(id),canvas=$('gameCanvas'),ctx=canvas.getContext('2d'),video=$('cameraVideo'),handCanvas=$('handCanvas'),hctx=handCanvas.getContext('2d');
const game=new Hunt(),aimController=new HandAim(),aimPresence=new AimPresence(),audio=new ArcadeAudio();
const calibration=new AimCalibration();
// Explicit local test harness only; absent from the production document.
const qaTelemetry=document.querySelector('output[data-qa-telemetry]');
const debugEnabled=!!document.getElementById('debugPanel');
let debugProtocolMode=null;
document.addEventListener('chickenshot:debug-mode',event=>{if(debugEnabled&&[null,'shooting','aim-only','stillness'].includes(event.detail?.mode))debugProtocolMode=event.detail.mode;});
let mode='none',phase='idle',aim={x:W*.5,y:H*.42},lastTick=performance.now(),countdownEnd=0,countNumber=0,lastHandAt=-Infinity,lastPoints=null,handDescription=null,shotAt=-Infinity,hitAt=-Infinity,shotPosition={...aim},lastHud='',cameraMessage='',resumePhase='running',lossSince=null,autoPaused=false;
const bestStorageKey=qaTelemetry||document.documentElement.dataset.qaTest==='true'||document.documentElement.dataset.debugTest==='true'?'chickenshot-best-qa':'chicken-shot-best';
let best=0;try{best=Number(localStorage.getItem(bestStorageKey))||0;}catch{}$('best').textContent=best.toLocaleString();
let chickenGraphic=null,shotgunGraphic=null;
const chickenImage=new Image();chickenImage.onload=()=>{const sprite=document.createElement('canvas');sprite.width=384;sprite.height=256;sprite.getContext('2d').drawImage(chickenImage,0,0,384,256);chickenGraphic=sprite;};chickenImage.src='./assets/chicken.png';
const shotgunImage=new Image();shotgunImage.onload=()=>{const sprite=document.createElement('canvas');sprite.width=512;sprite.height=126;sprite.getContext('2d').drawImage(shotgunImage,39,175,1922,470,0,0,512,126);shotgunGraphic=sprite;};shotgunImage.src='./assets/shotgun.png';
const layout={width:W,height:H};
if(typeof ResizeObserver!=='undefined')new ResizeObserver(([entry])=>{layout.width=Math.max(1,entry.contentRect.width);layout.height=Math.max(1,entry.contentRect.height);}).observe(canvas);
else{const measure=()=>{const rect=canvas.getBoundingClientRect();layout.width=Math.max(1,rect.width);layout.height=Math.max(1,rect.height);};measure();window.addEventListener('resize',measure);}
let lastUiUpdate=-Infinity,lastGunDraw=-Infinity,lastCameraStatus='',lastAmmoHud='';
function setText(id,value){const element=$(id);if(element&&element.textContent!==value)element.textContent=value;}
function setHidden(id,value){const element=$(id);if(element&&element.hidden!==value)element.hidden=value;}

const jointFilters=Array.from({length:21},()=>({x:new OneEuro(2.5,5),y:new OneEuro(2.5,5)}));
let sceneCorrection=1;
const gunVisual={size:1,front:0,angle:0,lastFrame:null,lastPose:-Infinity};
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fresh=now=>camera.active&&aimPresence.visible(now,camera.freshnessMs??180);
const liveShotTracking=now=>camera.active&&aimController.aimValid&&aimController.pose&&aimPresence.live(now,camera.freshnessMs??180);
const announce=text=>$('announcer').textContent=text;
function setCameraStatus(text,type=''){const key=`${text}/${type}`;if(key===lastCameraStatus)return;lastCameraStatus=key;const element=$('cameraStatus');element.className=`camera-status ${type}`;const dot=document.createElement('i');element.replaceChildren(dot,document.createTextNode(text));}
function setOverlay(content){$('welcomeCard').innerHTML=content;$('overlay').hidden=false;}
function hideOverlay(){$('overlay').hidden=true;}
function resetRound(){game.reset();calibration.reset();aimController.reset();aimPresence.reset();lossSince=null;autoPaused=false;shotAt=hitAt=-Infinity;lastHud='';$('comboBadge').hidden=true;setHidden('trackingWarning',true);$('sceneLabel').textContent='SUNNY MEADOW · ROUND 01';}
function startCountdown(){phase='countdown';countdownEnd=performance.now()+(mode==='camera'?1000:3000);countNumber=0;hideOverlay();$('pauseButton').disabled=false;$('pauseButton').textContent='Ⅱ';$('pauseButton').setAttribute('aria-label','Pause game');$('statusText').textContent='GET READY · MAKE EVERY SHOT COUNT';}
function startPractice(){audio.init();camera.stop();mode='practice';resetRound();$('controlTitle').textContent='MOVE TO TAKE AIM';$('controlSubtitle').textContent='CLICK OR TAP TO SHOOT';$('footerHint').textContent='R RELOAD · P PAUSE · C CENTER';setText('trackingHint','MOUSE & TOUCH PRACTICE');$('cameraPlaceholder').hidden=false;$('cameraPlaceholder').querySelector('strong').textContent='PRACTICE MAKES PERFECT';$('cameraPlaceholder').querySelector('span').textContent='Click ↗ below to switch to camera.';setCameraStatus('PRACTICE');startCountdown();}
async function startCamera(){
  if(camera.pending)return;audio.init();mode='camera';resetRound();phase='loading';$('pauseButton').disabled=true;$('countdown').hidden=true;
  $('controlTitle').textContent='AIM WITH YOUR HAND';$('controlSubtitle').textContent='SMALL FLICK UP TO SHOOT';$('footerHint').textContent='C / SPACE CENTRE · R RELOAD · P PAUSE';
  setOverlay('<span class="welcome-tag">YOUR HAND IS THE CONTROLLER</span><h1>Let’s get<br><em>connected.</em></h1><p>Allow camera access when your browser asks.<br>The hand tracker is loading on your device.</p><button class="text-button" data-action="practice">Play with mouse instead →</button><span class="privacy-note">Camera frames stay on your device.</span>');
  await camera.start(video);
}
function showWaiting(){
  phase='waiting';$('countdown').hidden=true;
  setOverlay(`<span class="welcome-tag">QUICK CENTRE SETUP</span><h2 class="setup-title">Point at centre.</h2><div class="calibration-instructions"><p>Thumb up. Point one or two fingers forward.<br>Fold your ring and little fingers.<br><strong>About one second. Small movement is fine.</strong></p></div><div class="calibration-progress"><span id="calibrationProgress"></span></div><p id="calibrationHint" role="status">${calibration.reason}</p><button class="text-button" data-action="practice">Use mouse instead →</button><span class="privacy-note">C / Space: use this direction now · Timer paused</span>`);
  $('pauseButton').disabled=false;setText('statusText','POINT AT CENTRE · RELAX YOUR HAND · ABOUT ONE SECOND');

}

function recalibrate(){
  if(mode==='camera'&&camera.active){
    if(!aimController.aimValid||!aimPresence.live(performance.now(),camera.freshnessMs??180)){announce('Show your pointing finger to centre the aim.');return;}
    if(phase==='waiting'&&!calibration.complete)calibration.capture(aimController.latestDirection,aimController.noise,aimController.latestExtent);
    aimController.recenter();aim={x:W/2,y:H/2};setCameraStatus('CENTRED','ready');setText('trackingHint','AIM CENTRED · KEEP AIMING');announce('Aim centred.');
  }else{aimController.recenter();aim={x:W/2,y:H/2};}
}

function cameraError(message){cameraMessage=message;lastHandAt=-Infinity;lastPoints=null;aimController.invalidate();$('cameraPlaceholder').hidden=false;setHidden('trackingWarning',true);$('countdown').hidden=true;phase='idle';setCameraStatus('RETRY','warn');$('pauseButton').disabled=true;setText('trackingHint','CAMERA NEEDS ATTENTION');setOverlay(`<span class="welcome-tag">CAMERA NEEDS ATTENTION</span><h1>Let’s get<br><em>you playing.</em></h1><p id="cameraErrorText"></p><button class="primary-button" data-action="camera">Retry camera ↗</button><button class="text-button" data-action="practice">Play with mouse or touch →</button>`);$('cameraErrorText').textContent=message;$('statusText').textContent='CAMERA OFF · PRACTICE IS AVAILABLE';announce(message);}
function emitDebugFrame(points,time,now,worldPoints,result,before,predicted=false){
  if(!debugEnabled)return;
  const round=v=>Number.isFinite(v)?Math.round(v*10000)/10000:null;
  const coordinates=list=>Array.isArray(list)?list.map(p=>[round(p.x),round(p.y),round(p.z)]):null;
  const fired=game.shots>before.shots,hand=result?.hand;
  const requested=!!result?.fire||predicted;
  const reason=fired?(predicted?'shot-predicted':'shot-visible'):requested?'shot-rejected-by-game':phase!=='running'?'round-not-running':before.reload>0?'reloading':before.cooldown>0?'cooldown':!result?.valid?'tracking-lost':!result.pose?'grip-not-recognized':!before.armed?(aimController.release?'lowering-required':'trigger-not-ready'):'no-recoil-detected';
  document.dispatchEvent(new CustomEvent('chickenshot:tracking',{detail:{
    capturedAt:round(time),arrivedAt:round(now),frameAgeMs:round(now-time),phase,debugProtocolMode,reason,fired,predicted,requested,
    before,state:{armed:aimController.armed,pose:aimController.pose,aimValid:aimController.aimValid,aimVisible:fresh(now),aimHeld:fresh(now)&&!aimPresence.current,returnRequired:!!aimController.release,lastShot:round(aimController.lastShot),aimX:round(aim.x/W),aimY:round(aim.y/H),neutral:aimController.neutral,aimRange:aimController.range,deadband:aimController.noise,aimExtent:aimController.aimExtent,aimMapping:'palm-scaled-proximal-xy-curved-edges-upward-range'},
    controlsVersion:'grip-16',triggerVersion:'recoil-11',triggerEvidence:result?.triggerEvidence??null,
    hand:hand?{center:hand.center,size:round(hand.size),direction:hand.direction,aimDirection:hand.aimDirection,aimSource:hand.aimSource,aimUsable:hand.aimUsable,gripVariant:hand.gripVariant,gripConfirmed:hand.gripConfirmed,middle:hand.middle,ringFolded:hand.ringFolded,littleFolded:hand.littleFolded,index:hand.index,thumb:hand.thumb,curled:hand.curled,gunPose:hand.gunPose}:null,
    camera:{backend:camera.delegate??null,inferenceMs:round(camera.inferenceMs),resultIntervalMs:round(camera.resultInterval),recovering:!!camera.recovering},
    imageLandmarks:coordinates(points),worldLandmarks:coordinates(worldPoints)
  }}));
}
const camera=new HandCamera({
  onState(state){if(state==='loading')setCameraStatus('LOADING','warn');else if(state==='on'){
    handCanvas.width=video.videoWidth||640;handCanvas.height=video.videoHeight||480;$('cameraPlaceholder').hidden=true;setText('trackingHint','MAKE A FINGER GUN');setCameraStatus('FIND HAND','warn');$('cameraToggle').title='Turn camera off';$('cameraToggle').setAttribute('aria-label','Turn camera off');
    if(document.hidden||$('helpDialog').open){phase='paused';resumePhase='waiting';autoPaused=false;}else showWaiting();
  }else{setText('trackingRate','');lastPoints=null;lastHandAt=-Infinity;aimPresence.reset();aimController.invalidate();hctx.clearRect(0,0,handCanvas.width,handCanvas.height);setCameraStatus('OFFLINE');$('cameraToggle').title='Turn camera on';$('cameraToggle').setAttribute('aria-label','Turn camera on');}},
  onError:cameraError,
  onDiagnostics(detail){if(debugEnabled)document.dispatchEvent(new CustomEvent('chickenshot:diagnostic',{detail:{...detail,arrivedAt:detail.arrivedAt??performance.now()}}));},
  onResult(points,time,now,worldPoints){
    const debugBefore=debugEnabled?{armed:aimController.armed,pose:aimController.pose,aimValid:aimController.aimValid,aimVisible:fresh(now),aimHeld:fresh(now)&&!aimPresence.current,returnRequired:!!aimController.release,shots:game.shots,shells:game.shells,cooldown:game.cooldown,reload:game.reload,lastVisibleAt:aimController.lastSeen,lastPalm:aimController.latest??null,lastDirection:aimController.latestDirection??null,exitCandidate:aimController.exitCandidate?{observedAt:aimController.exitCandidate.observedAt,rise:aimController.exitCandidate.rise,speed:aimController.exitCandidate.speed,threshold:aimController.exitCandidate.threshold}:null}:null;
    if(!points){const predicted=aimController.predictExit(time,{canFire:phase==='running'&&game.cooldown<=0&&game.reload<=0});if(predicted)fire(predicted.x*W,predicted.y*H,{exitEvidenceAt:predicted.observedAt});lastPoints=null;lastHandAt=-Infinity;aimPresence.observe(false,now);aimController.invalidate();if(phase==='waiting')calibration.observe(null,now);emitDebugFrame(points,time,now,worldPoints,null,debugBefore,!!predicted);return;}
    const result=aimController.update(points,time,worldPoints,{canFire:phase==='running'&&game.cooldown<=0&&game.reload<=0});if(!result.valid){const predicted=aimController.predictExit(time,{canFire:phase==='running'&&game.cooldown<=0&&game.reload<=0});if(predicted)fire(predicted.x*W,predicted.y*H,{exitEvidenceAt:predicted.observedAt});lastPoints=null;lastHandAt=-Infinity;aimPresence.observe(false,now);aimController.invalidate();emitDebugFrame(points,time,now,worldPoints,result,debugBefore,!!predicted);return;}handDescription=result.hand;
    lastHandAt=now;aimPresence.observe(result.aimValid,now);lastPoints=points.map((p,i)=>({...p,x:jointFilters[i].x.update(p.x,time),y:jointFilters[i].y.update(p.y,time)}));
    if(phase==='waiting'&&!calibration.complete&&!document.hidden&&!$('helpDialog').open){if(calibration.observe(result.hand,now)){aimController.setNeutral(calibration.neutral,calibration.noise,calibration.extent);aim={x:W/2,y:H/2};audio.ready();announce('Aim calibrated. Get ready.');}}
    if(result.aimValid)aim={x:result.aim.x*W,y:result.aim.y*H};if(result.fire&&result.pose&&phase==='running'&&now-time<=(camera.maxResultAgeMs??350))fire(result.fire.x*W,result.fire.y*H);
    emitDebugFrame(points,time,now,worldPoints,result,debugBefore);
  }
});
function fire(x=aim.x,y=aim.y,{exitEvidenceAt=null}={}){
  const now=performance.now(),predictedRecent=Number.isFinite(exitEvidenceAt)&&now>=exitEvidenceAt&&now-exitEvidenceAt<=(camera.maxResultAgeMs??350);
  if(phase!=='running'||(mode==='camera'&&!liveShotTracking(now)&&!predictedRecent))return;
  const result=game.fire(x,y);if(!result)return;
  if(mode==='camera'){setCameraStatus(game.reload>0?'RELOAD':'SHOT!','ready');setText('trackingHint',game.reload>0?'RELOADING · KEEP AIMING':'SHOT REGISTERED · LOWER TO READY');}
  audio.shot();audio.cycle({chamber:game.shells>0});if(result.hit){audio.hit();hitAt=performance.now();announce(`${result.hit} chicken${result.hit>1?'s':''}. ${result.earned} points.`);}
  shotAt=performance.now();shotPosition={x,y};if(game.shells===0)audio.reload(.45);updateHud();
}
function pause({automatic=false,recovery=false}={}){
  if(!['running','countdown','waiting'].includes(phase))return;resumePhase=phase;phase='paused';autoPaused=automatic;$('countdown').hidden=true;$('pauseButton').textContent='▶';$('pauseButton').setAttribute('aria-label','Resume game');$('statusText').textContent=recovery?'PAUSED · OPTIMIZING TRACKING':automatic?'PAUSED · HAND OUT OF VIEW':'TAKING A BREATHER';
  setOverlay(`<span class="welcome-tag">${automatic?'YOUR SCORE IS SAFE':'TAKE YOUR TIME'}</span><h1>${recovery?'Getting your<br><em>aim back.</em>':automatic?'Hand out<br>of <em>view.</em>':'Taking a<br><em>breather.</em>'}</h1><p>${recovery?'Restoring hand tracking.<br>Keep your hand visible. Your timer is paused.':automatic?'Show your finger gun and hold it steady.<br>We’ll continue when you’re ready.':'The chickens can wait. Your timer is paused.'}</p><button class="primary-button" data-action="resume">Back to the hunt →</button><button class="text-button" data-action="restart">Start a fresh round ↻</button>`);
}
function resume(){if(phase!=='paused'||$('helpDialog').open)return;if(mode==='camera'&&!fresh(performance.now())){setHidden('trackingWarning',false);setText('trackingWarning','Show your hand to resume.');return;}$('pauseButton').textContent='Ⅱ';$('pauseButton').setAttribute('aria-label','Pause game');autoPaused=false;lossSince=null;setHidden('trackingWarning',true);if(resumePhase==='waiting'){showWaiting();return;}if(resumePhase==='countdown'){startCountdown();return;}phase='running';hideOverlay();$('statusText').textContent=mode==='camera'?'HAND CONTROL · HUNT IS LIVE':'MOUSE PRACTICE · HUNT IS LIVE';aimController.disarm();}
function finish(){phase='finished';$('pauseButton').disabled=true;setHidden('trackingWarning',true);$('comboBadge').hidden=true;const newBest=game.score>best;if(newBest){best=game.score;try{localStorage.setItem(bestStorageKey,String(best));}catch{}$('best').textContent=best.toLocaleString();}audio.finish();const accuracy=game.shots?Math.round(game.hitShots/game.shots*100):0;
  setOverlay(`<span class="welcome-tag">${newBest?'✦ A NEW PERSONAL BEST':'THAT’S A WRAP, SHARPSHOOTER'}</span><h1 class="result-score">${game.score.toLocaleString()}</h1><span class="result-label">POINTS · ${mode==='camera'?'HAND CONTROL':'MOUSE PRACTICE'}</span><div class="result-stats"><div><strong>${game.kills}</strong><span>CHICKENS</span></div><div><strong>${accuracy}%</strong><span>ACCURACY</span></div><div><strong>${game.shots}</strong><span>SHOTS</span></div></div><div class="result-actions"><button class="primary-button" data-action="restart">One more round ↻</button><button class="text-button" data-action="${mode==='camera'?'practice':'camera'}">${mode==='camera'?'Try mouse practice':'Try hand control'} →</button></div>`);$('statusText').textContent='ROUND COMPLETE · NICELY SHOT';announce(`Round complete. ${game.score} points. ${game.kills} chickens.`);
}
function updateHud(){const seconds=Math.ceil(game.time),key=`${game.score}/${seconds}/${game.shells}/${game.reload>0}/${game.combo}`;if(key!==lastHud){lastHud=key;$('score').textContent=String(game.score).padStart(4,'0');$('timer').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;document.querySelector('.timer-block').classList.toggle('urgent',seconds<=10&&phase==='running');if(lastAmmoHud!==String(game.shells)){lastAmmoHud=String(game.shells);$('reloadButton').replaceChildren(...Array.from({length:6},(_,i)=>{const e=document.createElement('span');e.className=`shell${i>=game.shells?' empty':''}`;return e;}));}$('weaponStatus').textContent=game.reload>0?'RELOADING…':`${game.shells} SHOTS · AUTO RELOAD`;$('comboBadge').hidden=game.combo<2||phase!=='running';$('comboBadge').textContent=`${game.combo}× COMBO · KEEP IT GOING`;} const reloadWidth=game.reload>0?`${Math.round((1-game.reload/RELOAD_SECONDS)*100)}%`:'0%';if($('reloadProgress').style.width!==reloadWidth)$('reloadProgress').style.width=reloadWidth;}

function drawChicken(b,now,falling=false){
  ctx.save();ctx.translate(b.x,b.y);if(falling){ctx.rotate(b.rotation);ctx.globalAlpha=Math.min(1,b.life*2);}else ctx.rotate(Math.sin(now*.004+b.phase)*.055);
  ctx.scale(b.vx>0?1:-1,sceneCorrection);const flap=reducedMotion?1:1+Math.sin(now*.016+b.phase)*.045;
  if(chickenGraphic){ctx.scale(1,flap);ctx.drawImage(chickenGraphic,-b.size*.78,-b.size*.63,b.size*1.56,b.size*1.04);}else{ctx.fillStyle='#fff0cb';ctx.beginPath();ctx.ellipse(0,0,b.size*.45,b.size*.3,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ef6448';ctx.beginPath();ctx.arc(b.size*.3,-b.size*.3,b.size*.12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffba4a';ctx.beginPath();ctx.moveTo(b.size*.4,-b.size*.16);ctx.lineTo(b.size*.65,-b.size*.08);ctx.lineTo(b.size*.4,0);ctx.fill();}ctx.restore();
}
function drawReticle(now){
  if(phase!=='running'&&phase!=='countdown')return;if(mode==='camera'&&!fresh(now)&&now-shotAt>180)return;
  const fired=now-shotAt<180;
  const p=fired?shotPosition:aim,expansion=fired?(1-(now-shotAt)/180)*15:0,r=SPREAD+expansion;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,sceneCorrection);ctx.shadowColor='#173525aa';ctx.shadowBlur=5;ctx.lineWidth=2.3;ctx.strokeStyle=game.reload>0?'#ffc35d':'#fff9e9';ctx.fillStyle=ctx.strokeStyle;
  ctx.globalAlpha=game.reload>0?.6:.85;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
  for(let i=0;i<4;i++){ctx.save();ctx.rotate(i*Math.PI/2);ctx.beginPath();ctx.moveTo(0,19+expansion);ctx.lineTo(0,31+expansion);ctx.stroke();ctx.restore();}
  ctx.beginPath();ctx.arc(0,0,3.2,0,Math.PI*2);ctx.fill();
  if(game.reload>0){ctx.strokeStyle='#ffc35d';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-game.reload/RELOAD_SECONDS));ctx.stroke();}
  if(now-hitAt<180){ctx.strokeStyle='#ffdf88';ctx.lineWidth=4;for(let i=0;i<4;i++){ctx.save();ctx.rotate(Math.PI/4+i*Math.PI/2);ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(0,16);ctx.stroke();ctx.restore();}}
  ctx.restore();
}
function render(now){
  const ratio=Math.min(window.devicePixelRatio||1,1.5),rect=layout,width=Math.round(rect.width*ratio),height=Math.round(rect.height*ratio);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}sceneCorrection=(rect.width/W)/(rect.height/H);game.viewAspect=1/sceneCorrection;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);
  const birds=phase==='idle'||phase==='loading'||phase==='waiting'?demoBirds:game.birds;for(const b of [...birds].sort((a,b)=>a.size-b.size))drawChicken(b,now);
  for(const b of game.falling)drawChicken(b,now,true);
  for(const p of game.particles){ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,sceneCorrection);ctx.rotate(p.angle);ctx.globalAlpha=clamp(p.life/.3,0,1);ctx.fillStyle='#fff1cf';ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*.32,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#cfaf78';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-p.size,0);ctx.lineTo(p.size,0);ctx.stroke();ctx.restore();}
  for(const l of game.labels){ctx.save();ctx.translate(l.x,l.y);ctx.scale(1,sceneCorrection);ctx.globalAlpha=Math.min(1,l.life*3);ctx.font='800 30px "Barlow Condensed", Impact, sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#1e3b2c';ctx.strokeText(l.text,0,0);ctx.fillStyle='#fff2be';ctx.fillText(l.text,0,0);ctx.restore();}
  if(!reducedMotion&&now-shotAt<90){const strength=1-(now-shotAt)/90;ctx.fillStyle=`rgba(255,235,180,${strength*.10})`;ctx.fillRect(0,0,W,H);}
  drawReticle(now);if(now-lastGunDraw>=1000/30){lastGunDraw=now;drawHandGun(now);}
}
function drawHandGun(now){
  hctx.clearRect(0,0,handCanvas.width,handCanvas.height);if(!lastPoints||now-lastHandAt>(camera.freshnessMs??180))return;
  const w=handCanvas.width,h=handCanvas.height,p=lastPoints.map(p=>({x:(1-p.x)*w,y:p.y*h}));
  if(phase==='waiting'&&!calibration.complete){hctx.strokeStyle='#cbed9c';hctx.lineWidth=3;const center=handDescription?.center;if(center){hctx.beginPath();hctx.arc(center.x*w,center.y*h,10,0,Math.PI*2);hctx.stroke();}return;}if(aimController.pose)gunVisual.lastPose=now;
  if(!aimController.pose&&now-gunVisual.lastPose>220)return;
  const grip={x:p[5].x*.7+p[9].x*.3,y:p[5].y*.7+p[9].y*.3};
  const dt=gunVisual.lastFrame===null?1/60:clamp((now-gunVisual.lastFrame)/1000,0,.05);gunVisual.lastFrame=now;
  const smooth=1-Math.exp(-dt*12),palmSpan=Math.max(Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y),Math.hypot(p[0].x-p[9].x,p[0].y-p[9].y)*.8);
  gunVisual.size+=(clamp(palmSpan/104,.7,1.5)-gunVisual.size)*smooth;
  gunVisual.front+=((handDescription?.forward??0)-gunVisual.front)*smooth;
  const rawAngle=Math.atan2(p[8].y-p[5].y,p[8].x-p[5].x),angleDifference=Math.atan2(Math.sin(rawAngle-gunVisual.angle),Math.cos(rawAngle-gunVisual.angle));
  if(gunVisual.front<.55)gunVisual.angle+=angleDifference*smooth;
  const angle=gunVisual.angle,size=gunVisual.size;
  if(gunVisual.front>.55){
    // Foreshortened shotgun: muzzle is aligned with the projected fingertip,
    // while the stock/grip remains anchored to the tracked palm.
    hctx.save();hctx.translate(grip.x,grip.y);hctx.scale(size,size);hctx.lineJoin='round';hctx.lineWidth=3;hctx.strokeStyle='#11261f';hctx.shadowColor='#0007';hctx.shadowBlur=8;
    hctx.fillStyle='#a97643';hctx.beginPath();hctx.roundRect(-20,-5,40,62,9);hctx.fill();hctx.stroke();
    const dx=clamp((p[8].x-grip.x)/size,-35,35),dy=clamp((p[8].y-grip.y)/size,-50,5)-22;
    hctx.fillStyle='#42584e';hctx.beginPath();hctx.moveTo(-20,20);hctx.lineTo(dx-27,dy);hctx.lineTo(dx+27,dy);hctx.lineTo(20,20);hctx.closePath();hctx.fill();hctx.stroke();hctx.shadowBlur=0;
    for(const x of [-14,14]){hctx.fillStyle='#76877b';hctx.beginPath();hctx.ellipse(dx+x,dy,17,21,0,0,Math.PI*2);hctx.fill();hctx.stroke();hctx.fillStyle='#10251f';hctx.beginPath();hctx.ellipse(dx+x,dy,11,15,0,0,Math.PI*2);hctx.fill();hctx.strokeStyle='#a6b69f';hctx.lineWidth=1.5;hctx.stroke();hctx.strokeStyle='#11261f';hctx.lineWidth=3;}
    if(now-shotAt<100){hctx.fillStyle='#ffe9a8';hctx.globalAlpha=.9;hctx.beginPath();for(let i=0;i<12;i++){const a=i*Math.PI/6,r=i%2?26:58;const x=dx+Math.cos(a)*r,y=dy+Math.sin(a)*r;i?hctx.lineTo(x,y):hctx.moveTo(x,y);}hctx.closePath();hctx.fill();}hctx.restore();return;
  }
  hctx.save();hctx.translate(grip.x,grip.y);hctx.rotate(angle);hctx.scale(size,Math.cos(angle)<0?-size:size);hctx.lineJoin='round';hctx.lineWidth=3;hctx.strokeStyle='#13231f';hctx.shadowColor='#0008';hctx.shadowBlur=8;
  if(shotgunGraphic){
    hctx.drawImage(shotgunGraphic,-105,-36,260,63.58);
    if(now-shotAt<100){hctx.shadowBlur=14;hctx.shadowColor='#ffd475';hctx.fillStyle='#ffe7a2';hctx.beginPath();hctx.moveTo(150,-24);hctx.lineTo(180,-40);hctx.lineTo(172,-20);hctx.lineTo(193,-13);hctx.lineTo(171,-7);hctx.lineTo(179,9);hctx.lineTo(150,-8);hctx.closePath();hctx.fill();}hctx.restore();return;
  }
  // A compact illustrated shotgun aligned with the index finger.
  hctx.fillStyle='#a16d3d';hctx.beginPath();hctx.moveTo(-85,-7);hctx.lineTo(-30,-3);hctx.lineTo(-12,5);hctx.lineTo(-24,21);hctx.lineTo(-75,34);hctx.lineTo(-89,26);hctx.closePath();hctx.fill();hctx.stroke();hctx.shadowBlur=0;
  hctx.fillStyle='#354341';hctx.beginPath();hctx.roundRect(-28,-15,91,23,5);hctx.fill();hctx.stroke();hctx.fillStyle='#596862';hctx.beginPath();hctx.roundRect(22,-22,105,10,3);hctx.fill();hctx.stroke();hctx.fillStyle='#344540';hctx.beginPath();hctx.roundRect(22,-12,105,10,3);hctx.fill();hctx.stroke();
  hctx.strokeStyle='#aab9a6';hctx.lineWidth=2;hctx.beginPath();hctx.moveTo(28,-19);hctx.lineTo(122,-19);hctx.stroke();hctx.fillStyle='#b78047';hctx.strokeStyle='#142b23';hctx.beginPath();hctx.roundRect(36,-1,54,14,4);hctx.fill();hctx.stroke();hctx.lineWidth=1;hctx.strokeStyle='#785330';for(let x=43;x<85;x+=7){hctx.beginPath();hctx.moveTo(x,2);hctx.lineTo(x,10);hctx.stroke();}
  hctx.strokeStyle='#e1d6b6';hctx.lineWidth=3;hctx.beginPath();hctx.roundRect(-24,10,25,16,7);hctx.stroke();
  if(now-shotAt<100){hctx.fillStyle='#ffe49a';hctx.beginPath();hctx.moveTo(125,-18);hctx.lineTo(158,-35);hctx.lineTo(150,-16);hctx.lineTo(172,-8);hctx.lineTo(149,-4);hctx.lineTo(155,11);hctx.lineTo(125,-5);hctx.closePath();hctx.fill();}
  hctx.restore();
}
const demoBirds=[{x:230,y:180,vx:1,size:75,phase:0},{x:1170,y:175,vx:-1,size:128,phase:1},{x:1400,y:385,vx:1,size:83,phase:2},{x:850,y:110,vx:1,size:58,phase:3}];
function tick(now){
  const dt=clamp((now-lastTick)/1000,0,.05);lastTick=now;if(now-lastUiUpdate>=80){lastUiUpdate=now;if(qaTelemetry)qaTelemetry.value=JSON.stringify({phase,aimX:aim.x/W,aimY:aim.y/H,armed:aimController.armed,aimVisible:fresh(now),aimValid:aimController.aimValid,pose:aimController.pose,gripVariant:handDescription?.gripVariant??null,aimHeld:fresh(now)&&!aimPresence.current,shotTracking:liveShotTracking(now),release:!!aimController.release,shots:game.shots,samples:aimController.samples.length,history:aimController.history.length,directions:aimController.directionWindow.length,delegate:camera.delegate,frameAge:camera.frameAgeMs,recovering:camera.recovering});const calibrating=mode==='camera'&&phase==='waiting'&&!calibration.complete;$('arena').classList.toggle('calibrating',calibrating);setHidden('calibrationGuide',!calibrating);setHidden('aimSetupTarget',!calibrating);
  if(calibrating){const target=calibration.target,marker=$('aimSetupTarget');const position=target.name;if(marker.dataset.position!==position){marker.dataset.position=position;marker.style.left=`${target.x*100}%`;marker.style.top=`${target.y*100}%`;setText('aimSetupLabel',target.label);announce('Point comfortably at the centre. Small movement is fine.');}const progress=Math.round(calibration.progress*100);if(marker.dataset.progress!==String(progress)){marker.dataset.progress=String(progress);marker.style.setProperty('--progress',`${progress}%`);}}
  if(mode==='camera'&&camera.active){
    setText('trackingRate',camera.sampleCount>=2?`${Math.round(1000/camera.resultInterval)} fps`:'—');$('trackingRate').title=`${camera.delegate??'Tracker'} · inference ${Math.round(camera.inferenceMs??0)} ms · frame age ${Math.round(camera.frameAgeMs??0)} ms`;
    const visible=fresh(now);if(phase!=='waiting'){if(visible&&!aimPresence.current){setCameraStatus('AIM HELD','warn');setText('trackingHint','FINDING YOUR HAND · AIM HELD BRIEFLY');}else if(visible&&!aimController.pose){setCameraStatus('AIM ONLY','warn');setText('trackingHint','THUMB UP · 1 OR 2 FINGERS FORWARD · FOLD RING & LITTLE');}else if(visible){const shotJustFired=now-shotAt<650,weaponReady=game.cooldown<=0&&game.reload<=0;setCameraStatus(game.reload>0?'RELOAD':shotJustFired?'SHOT!':!weaponReady?'CYCLING':aimController.armed?'READY':aimController.release?'LOWER HAND':'GETTING READY',weaponReady&&aimController.armed||shotJustFired?'ready':'warn');setText('trackingHint',game.reload>0?'RELOADING · KEEP AIMING':shotJustFired?'SHOT FIRED · LET YOUR HAND REST':!weaponReady?'SHOTGUN CYCLING · WAIT FOR READY':aimController.armed?'QUICK UPWARD FLICK · KEEP HAND IN VIEW':aimController.release?'LOWER OR RELAX YOUR HAND TO READY':'KEEP YOUR FINGER GUN VISIBLE');}else{const handFound=now-lastHandAt<180,registered=now-shotAt<650;setCameraStatus(registered?'SHOT!':handFound?'HAND FOUND':'TRACKING LOST',registered?'ready':'warn');setText('trackingHint',registered?'SHOT REGISTERED · BRING HAND BACK':handFound?(handDescription?.thumb?'FOLD RING & LITTLE · 1 OR 2 FINGERS FORWARD':'RAISE YOUR THUMB · KEEP INDEX FORWARD'):'KEEP WHOLE HAND AND WRIST IN VIEW');}
    }
    if(phase==='waiting'){
      if($('calibrationProgress'))$('calibrationProgress').style.width=`${calibration.progress*100}%`;
      if($('calibrationHint'))setText('calibrationHint',calibration.complete?'✓ Calibrated — ready to hunt!':`${calibration.reason} · ${Math.max(0,(calibration.target.hold-calibration.duration)/1000).toFixed(1)}s`);$('calibrationGuide').classList.toggle('position-ok',calibration.duration>0);
      setCameraStatus(calibration.complete?'CALIBRATED':'CALIBRATING',calibration.complete?'ready':'warn');setText('trackingHint',calibration.complete?'CALIBRATED · READY TO PLAY':`POINT ${calibration.target.label} · HOLD TO CAPTURE`);
      if(visible&&calibration.complete&&!$('helpDialog').open)startCountdown();
    }
    if(phase==='countdown'&&!visible)showWaiting();
    if(phase==='running'){
      if(!visible){lossSince??=now;setHidden('trackingWarning',false);setText('trackingWarning',now-shotAt<700?'Shot registered · bring your hand back':'Hand out of view · return to aim');if(now-lossSince>1200&&!debugProtocolMode)pause({automatic:true,recovery:camera.recovering});}
      else{lossSince=null;setHidden('trackingWarning',true);}
    }
    if(phase==='paused'&&autoPaused&&visible&&aimController.armed&&!$('helpDialog').open)resume();
    if(camera.recovering){setCameraStatus('OPTIMIZING','warn');setText('trackingHint','ADJUSTING TRACKER · KEEP HAND VISIBLE');}
  }
  }
  if(phase==='countdown'){
    const n=Math.ceil((countdownEnd-now)/1000);if(n>0){$('countdown').hidden=false;if(n!==countNumber){countNumber=n;$('countdown').textContent=n;audio.ready();}}else{phase='running';$('countdown').hidden=true;$('statusText').textContent=mode==='camera'?'HAND CONTROL · HUNT IS LIVE':'MOUSE PRACTICE · HUNT IS LIVE';announce('Go!');}
  }
  if(phase==='running'){const wasReloading=game.reload>0;game.update(dt,{holdRound:!!debugProtocolMode});if(wasReloading&&game.reload===0)audio.chamber();if(game.done)finish();}
  updateHud();render(now);requestAnimationFrame(tick);
}
function mouseAim(event){if(mode!=='practice'||!['running','countdown'].includes(phase))return;const rect=canvas.getBoundingClientRect();aim={x:clamp((event.clientX-rect.left)/rect.width*W,0,W),y:clamp((event.clientY-rect.top)/rect.height*H,0,H)};}
canvas.addEventListener('pointermove',mouseAim);canvas.addEventListener('pointerdown',event=>{if(mode!=='practice')return;event.preventDefault();mouseAim(event);fire();});
$('startCamera').addEventListener('click',startCamera);$('startPractice').addEventListener('click',startPractice);
$('welcomeCard').addEventListener('click',event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(action==='practice')startPractice();if(action==='camera')startCamera();if(action==='resume')resume();if(action==='restart'){if(mode==='camera'&&camera.active){resetRound();showWaiting();}else startPractice();}});
$('reloadButton').addEventListener('click',()=>{if(phase==='running'&&game.reloadWeapon())audio.reload();});
$('pauseButton').addEventListener('click',()=>phase==='paused'?resume():pause());
$('soundButton').addEventListener('click',()=>{audio.init();const muted=audio.toggle();$('soundButton').textContent=muted?'♪̸':'♫';$('soundButton').setAttribute('aria-label',muted?'Enable sound':'Mute sound');});
$('volume').addEventListener('input',event=>audio.setVolume(Number(event.target.value)/100));
$('recenterButton').addEventListener('click',recalibrate);
$('cameraToggle').addEventListener('click',()=>{if(camera.active||camera.pending){camera.stop();phase='idle';$('cameraPlaceholder').hidden=false;setHidden('trackingWarning',true);$('countdown').hidden=true;$('pauseButton').disabled=true;setOverlay('<span class="welcome-tag">YOUR CAMERA IS OFF</span><h1>Ready for<br>another <em>shot?</em></h1><p>Turn on hand control or practice with your mouse.</p><button class="primary-button" data-action="camera">Enable camera & play ↗</button><button class="text-button" data-action="practice">Try mouse practice →</button>');}else startCamera();});
$('helpButton').addEventListener('click',()=>{pause();$('helpDialog').showModal();});
for(const button of document.querySelectorAll('.dialog-close'))button.addEventListener('click',()=>$('helpDialog').close());
$('helpDialog').addEventListener('close',()=>{if(phase==='paused'&&resumePhase==='waiting')showWaiting();});
$('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.game-app').requestFullscreen();}catch{announce('Fullscreen is unavailable in this browser.');}});
document.addEventListener('keydown',event=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||$('helpDialog').open)return;const key=event.key.toLowerCase();if(key==='p'){event.preventDefault();phase==='paused'?resume():pause();}if(key==='r'&&phase==='running'&&game.reloadWeapon())audio.reload();if(key==='c'||key===' '||event.code==='Space'){event.preventDefault();recalibrate();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>camera.stop());
updateHud();requestAnimationFrame(tick);
