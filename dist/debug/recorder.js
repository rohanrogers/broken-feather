import {createStillness,observeStillness,summarizeStillness} from './stillness.js?v=grip-16';
export const SHOT_ATTEMPTS=10;
const spiralPath=()=>Array.from({length:217},(_,i)=>{const t=i/216,r=42*t,a=-Math.PI/2+6*Math.PI*t;return `${i?'L':'M'}${(50+r*Math.cos(a)).toFixed(2)} ${(50+r*Math.sin(a)).toFixed(2)}`;}).join(' ')+' L50 50';
export const AIM_STAGES=[
  {id:'rectangle',title:'Rectangle edges',instruction:'Do not shoot. Trace all four edges of the frame, then return to centre.',path:'M50 50 L8 8 L92 8 L92 92 L8 92 L8 8 L50 50'},
  {id:'x',title:'X across the frame',instruction:'Do not shoot. Centre → top left → bottom right → centre → top right → bottom left → centre.',path:'M50 50 L8 8 L92 92 L50 50 L92 8 L8 92 L50 50'},
  {id:'circle',title:'Large circle',instruction:'Do not shoot. Move out to the edge, draw a large circle around the frame, then return to centre.',path:'M50 50 L50 8 A42 42 0 1 1 49.99 8 L50 50'},
  {id:'spiral',title:'Expanding spiral',instruction:'Do not shoot. Move the crosshair from centre in tiny circles. Make three slow clockwise turns, gradually widening into a spiral until you reach the edges. Return to centre, then press Done. Small natural tremor is fine; take your time.',path:spiralPath(),geometry:{shape:'spiral',centre:{x:.5,y:.5},startRadius:0,endRadius:.42,turns:3,clockwise:true,returnToCentre:true,timing:'self-paced'}},
  {id:'plus',title:'Plus across the frame',instruction:'Do not shoot. Centre → top edge → centre → right edge → centre → bottom edge → centre → left edge → centre.',path:'M50 50 L50 8 L50 50 L92 50 L50 50 L50 92 L50 50 L8 50 L50 50'},
  {id:'random',title:'Random free aiming',instruction:'Do not shoot. Aim randomly across the frame. Mix small and large moves, slow and fast moves, and changes of direction. Return to centre when finished.',path:''},
  {id:'center',title:'Return to centre',instruction:'Do not shoot. Bring the crosshair to centre, relax your hand, then press Done.',path:'M8 8 L50 50 M92 8 L50 50 M8 92 L50 50 M92 92 L50 50'}
];
export const INTENT_MATCH={beforeDoneMs:1200,afterDoneCaptureMs:150,lateArrivalMs:800};
const MODES=['shooting','aim-only','stillness'];
const schemaFor=mode=>mode==='shooting'?'chickenshot-shooting-debug-v2':mode==='stillness'?'chickenshot-stillness-debug-v1':'chickenshot-aim-debug-v2';
export class GuidedRecorder {
  constructor({timeOriginEpochMs=null}={}){this.timeOriginEpochMs=timeOriginEpochMs;this.frames=[];this.diagnostics=[];this.sessions={'shooting':null,'aim-only':null,stillness:null};this.active=null;this.trailingCapture=null;}
  push(frame){
    this.frames.push(frame);this.frames=this.frames.filter(f=>frame.arrivedAt-f.arrivedAt<=1500).slice(-80);
    if(this.trailingCapture&&frame.arrivedAt<=this.trailingCapture.until){this.trailingCapture.session.postConfirmationFrames.push(frame);if(frame.fired)this.reclassify(frame.arrivedAt);}
    const part=this.active?.part;if(!part)return;part.frames.push(frame);part.rawFramesSeen++;if(part.stillness)observeStillness(part.stillness,frame,part.cueAt);
    // Preserve the whole path and event samples if a manual attempt is long.
    if(part.frames.length>3600){part.frames=part.frames.filter((f,i,a)=>i===0||i===a.length-1||i%2===0||f.fired);part.resampled=true;}
    if(frame.fired&&this.active.mode==='shooting')this.reclassify(frame.arrivedAt);
  }
  diagnose(event){this.diagnostics.push(event);this.diagnostics=this.diagnostics.filter(e=>event.arrivedAt-e.arrivedAt<=1500).slice(-40);if(this.active)this.active.part.diagnostics.push(event);}
  start(mode,now){
    if(!MODES.includes(mode))throw Error('Unknown recording mode.');if(this.active||this.trailingCapture)throw Error('Finish the current session and wait for its last tracking results.');
    const session={schema:schemaFor(mode),mode,purpose:mode==='stillness'?'Comfortable stationary hand and finger hold; crosshair drift and unintended-shot analysis':mode==='shooting'?'User-confirmed shot attempts, including missed detections':'Non-shooting aim movements for aim accuracy and accidental-trigger analysis',createdAt:new Date().toISOString(),mediaIncluded:false,status:'recording',tracking:{landmarksPerHand:21,coverage:'wrist, palm knuckles, thumb, index, middle, ring and little fingers',coordinates:['imageLandmarks','worldLandmarks'],note:'Estimated MediaPipe landmarks; no image or video data.'},protocol:{manualDone:mode!=='stillness',manualStop:mode==='stillness',intendedMovement:mode==='stillness'?'hold-hand-and-finger-still':'aim-or-shoot',controlIntent:'move-screen-crosshair-not-physical-pointing',singleShotPerDone:mode==='shooting',intendedShotsPerDone:mode==='shooting'?1:0,allOtherDetectionsUnwanted:true,intentMatching:mode==='shooting'?INTENT_MATCH:undefined,expectedParts:mode==='stillness'?1:mode==='shooting'?SHOT_ATTEMPTS:AIM_STAGES.length,stages:mode==='aim-only'?AIM_STAGES.map(({id,title,instruction,geometry})=>({id,title,instruction,geometry})):undefined},parts:[]};
    this.sessions[mode]=session;this.active={mode,session,part:null};return this.beginPart(now);
  }
  beginPart(now){const {mode,session}=this.active,index=session.parts.length,stage=mode==='aim-only'?AIM_STAGES[index]:null;
    const part={number:index+1,mode,intendedShot:mode==='shooting',stage:stage?.id??null,guidePath:stage?.path??null,guideGeometry:stage?.geometry??null,instruction:mode==='stillness'?'Hold a comfortable finger-gun pose. Keep your hand and finger direction still as comfortably possible. Do not follow or correct the crosshair. Natural tremor is expected. Do not shoot. Use your other hand to press Stop when finished.':stage?.instruction??'Move the crosshair to aim. Make exactly ONE shooting gesture, then immediately press Done, even if nothing fires. All other shots are unwanted.',startedAt:now,cueAt:now+1500,endAt:null,timeOriginEpochMs:this.timeOriginEpochMs,frames:[],diagnostics:[],rawFramesSeen:0,resampled:false,note:''};if(mode==='stillness'){part.stage='stationary-hold';part.stillness=createStillness();}this.active.part=part;return part;
  }
  done(now,note=''){
    if(!this.active)throw Error('Start a session first.');if(this.active.mode==='stillness')throw Error('Keep holding until you press Stop; Done does not end a stationary hold.');const {session,part,mode}=this.active;if(now<part.cueAt)throw Error('Wait for the cue before completing this attempt.');
    part.endAt=now;part.userConfirmedAttemptAt=mode==='shooting'?now:null;part.note=note.slice(0,500);part.summary=summarizePart(part);part.trackingLoss=analyzeTrackingLoss(part);part.outcome=mode==='shooting'?(part.summary.shotsAfterCue===0?'undetected-user-shot':part.summary.shotsAfterCue===1?'registered-user-shot':'multiple-shots-for-one-attempt'):(part.summary.actualShots?'unwanted-shot-during-aim':'aim-only-no-shot');session.parts.push(part);
    const complete=session.parts.length===session.protocol.expectedParts;
    if(complete){session.status='complete';session.completedAt=new Date().toISOString();this.active=null;if(mode==='shooting'){session.postConfirmationFrames=[];this.trailingCapture={session,until:now+INTENT_MATCH.lateArrivalMs};}}else this.beginPart(now);
    if(mode==='shooting')this.reclassify(now);
    return {mode,complete,part,session};
  }
  stop(now,note=''){if(!this.active)return null;const {session,part,mode}=this.active;part.note=note.slice(0,500);part.endAt=now;part.summary=summarizePart(part);part.trackingLoss=analyzeTrackingLoss(part);if(mode==='stillness'){part.summary.stillness=summarizeStillness(part.stillness);part.outcome=part.summary.stillness.unwantedShots?'unwanted-shot-during-hold':'stationary-hold';session.parts.push(part);session.status='complete';session.stoppedByUser=true;session.completedAt=new Date().toISOString();}else{session.unfinishedPart=part;session.status='stopped';}this.active=null;this.reclassify(now);return {mode,session};}
  reclassify(now){const session=this.sessions.shooting;if(session?.protocol.singleShotPerDone)classifyShootingSession(session,{extraPart:this.active?.mode==='shooting'?this.active.part:null,now});}
  finalize(now){if(this.trailingCapture&&now>=this.trailingCapture.until)this.trailingCapture=null;this.reclassify(now);}
  export(mode){if(!MODES.includes(mode))throw Error('Choose shooting, aim-only, or stationary-hold export.');return this.sessions[mode];}
  restore(mode,session){if(MODES.includes(mode)&&session?.mode===mode&&session.schema===schemaFor(mode)&&Array.isArray(session.parts))this.sessions[mode]=session;}
}
export function summarizePart(part){
  const frames=part.frames.filter(f=>f.arrivedAt>=part.startedAt&&f.arrivedAt<=part.endAt),reasons={};let previous=null,peakUpwardSpeed=0;
  for(const f of frames){reasons[f.reason]=(reasons[f.reason]??0)+1;if(f.hand){if(previous){const dt=(f.capturedAt-previous.capturedAt)/1000;if(dt>0&&dt<.65)peakUpwardSpeed=Math.max(peakUpwardSpeed,(previous.hand.center.y-f.hand.center.y)/dt);}previous=f;}}
  const actualShots=frames.filter(f=>f.fired).length;
  return {samples:frames.length,actualShots,unwantedShots:part.intendedShot?0:actualShots,shotsAfterCue:frames.filter(f=>f.fired&&f.arrivedAt>=part.cueAt).length,shotsBeforeCue:frames.filter(f=>f.fired&&f.arrivedAt<part.cueAt).length,missingSamples:frames.filter(f=>!f.imageLandmarks?.length).length,unusableSamples:frames.filter(f=>f.imageLandmarks?.length&&!f.hand).length,maxFrameAgeMs:Math.max(0,...frames.map(f=>f.frameAgeMs??0)),peakUpwardSpeed:+peakUpwardSpeed.toFixed(3),reasons};
}

function palmOf(frame){if(frame.hand?.center)return frame.hand.center;const p=frame.imageLandmarks;if(p?.length!==21)return null;return {x:1-[0,5,9,13,17].reduce((n,i)=>n+p[i][0]/5,0),y:[0,5,9,13,17].reduce((n,i)=>n+p[i][1]/5,0)};}
function exitEvidence(visible){
 const latest=visible.at(-1),older=visible.filter(f=>latest.capturedAt-f.capturedAt>0&&latest.capturedAt-f.capturedAt<=350).at(-2)??visible.at(-2);
 if(!latest||!older)return {direction:'unknown',upwardSpeed:null,reason:'Not enough visible movement samples'};
 const dt=(latest.capturedAt-older.capturedAt)/1000,a=palmOf(older),b=palmOf(latest);if(!a||!b||dt<=0||dt>.65)return {direction:'unknown',upwardSpeed:null,reason:'Visible movement samples too far apart'};
 const upwardSpeed=(a.y-b.y)/dt,sidewaysSpeed=(b.x-a.x)/dt,coherent=[0,5,9,13,17].filter(i=>older.imageLandmarks[i][1]-latest.imageLandmarks[i][1]>.002).length;
 const pitchSpeed=latest.hand?.direction&&older.hand?.direction?(latest.hand.direction.pitch-older.hand.direction.pitch)/dt:null;
 let turned=0;if(older.worldLandmarks?.length===21&&latest.worldLandmarks?.length===21){const unit=(p,i)=>{const v=p[i].map((n,k)=>n-p[0][k]),l=Math.hypot(...v);return v.map(n=>n/Math.max(l,.00001));};for(const i of [5,9,17]){const x=unit(older.worldLandmarks,i),y=unit(latest.worldLandmarks,i),angle=Math.acos(Math.max(-1,Math.min(1,x.reduce((n,v,k)=>n+v*y[k],0))));if(angle>.035)turned++;}}
 const direction=upwardSpeed>.08&&coherent>=4?'upward':pitchSpeed!==null&&pitchSpeed<-1&&turned>=2?'upward-wrist-tilt':'unknown';
 return {direction,upwardSpeed:+upwardSpeed.toFixed(4),sidewaysSpeed:+sidewaysSpeed.toFixed(4),pitchSpeed,coherentPalmPoints:coherent,rotatingPalmAxes:turned,fromCapturedAt:older.capturedAt,toCapturedAt:latest.capturedAt,reason:direction==='unknown'?'Upward movement was not established before tracking loss':'Upward movement observed before tracking loss'};
}
export function analyzeTrackingLoss(part){
 const losses=[],gaps=[],visible=[];let open=null,previous=null;
 for(const [index,f] of part.frames.entries()){
  if(f.arrivedAt<part.startedAt||f.arrivedAt>part.endAt)continue;
  if(previous&&f.arrivedAt-previous.arrivedAt>650)gaps.push({kind:'delivery-gap',lastReceivedAt:previous.arrivedAt,nextReceivedAt:f.arrivedAt,durationMs:f.arrivedAt-previous.arrivedAt,directionBeforeGap:exitEvidence(visible),lastVisibleFrameIndex:visible.at(-1)?.frameIndex??null});
  if(f.imageLandmarks?.length===21&&f.hand){if(open){open.reacquiredAt=f.arrivedAt;open.durationMs=f.arrivedAt-open.lostAt;open=null;}visible.push({...f,frameIndex:index});if(visible.length>5)visible.shift();}
  else if(!open){open={kind:f.imageLandmarks?.length?'unusable-hand-landmarks':'hand-not-detected',firstRejectedFrameIndex:index,lostAt:f.arrivedAt,firstMissingCapturedAt:f.capturedAt,lastVisibleAt:visible.at(-1)?.capturedAt??null,lastVisibleFrameIndex:visible.at(-1)?.frameIndex??null,lastVisiblePalm:visible.length?palmOf(visible.at(-1)):null,directionBeforeLoss:exitEvidence(visible),reacquiredAt:null,durationMs:0};losses.push(open);}
  previous=f;
 }
 if(open)open.durationMs=Math.max(0,part.endAt-open.lostAt);
 if(previous&&part.endAt-previous.arrivedAt>650)gaps.push({kind:'delivery-gap',lastReceivedAt:previous.arrivedAt,nextReceivedAt:null,durationMs:part.endAt-previous.arrivedAt,directionBeforeGap:exitEvidence(visible),lastVisibleFrameIndex:visible.at(-1)?.frameIndex??null});
 return {events:losses,deliveryGaps:gaps,staleResultEvents:part.diagnostics.filter(d=>d.type==='stale-tracking-frame'),note:'Direction is based only on observed samples. Invisible positions are not reconstructed. Full last-visible landmarks remain in frames at the referenced index.'};
}

export function classifyShootingSession(session,{extraPart=null,now=Infinity}={}){
 const parts=[...session.parts,...(session.unfinishedPart?[session.unfinishedPart]:[]),...(extraPart?[extraPart]:[])],events=[],seen=new Set();
 for(const part of parts)for(const f of part.frames){if(!f.fired)continue;const id=`${f.capturedAt}:${f.arrivedAt}`;if(seen.has(id))continue;seen.add(id);events.push({id,capturedAt:f.capturedAt,detectedAt:f.arrivedAt,sourcePart:part.number,label:'unwanted-shot',matchedAttempt:null,frame:f});}
 for(const f of session.postConfirmationFrames??[]){if(!f.fired)continue;const id=`${f.capturedAt}:${f.arrivedAt}`;if(seen.has(id))continue;seen.add(id);events.push({id,capturedAt:f.capturedAt,detectedAt:f.arrivedAt,sourcePart:session.parts.at(-1)?.number??null,label:'unwanted-shot',matchedAttempt:null,frame:f});}
 const used=new Set();let matched=0,missing=0,pending=0;
 for(const part of session.parts){
  const confirmed=part.userConfirmedAttemptAt;
  const candidates=events.filter(e=>!used.has(e.id)&&e.capturedAt>=Math.max(part.cueAt,confirmed-INTENT_MATCH.beforeDoneMs)&&e.capturedAt<=confirmed+INTENT_MATCH.afterDoneCaptureMs&&e.detectedAt<=confirmed+INTENT_MATCH.lateArrivalMs).sort((a,b)=>Math.abs(a.capturedAt-confirmed)-Math.abs(b.capturedAt-confirmed));
  const match=candidates[0],waiting=now<confirmed+INTENT_MATCH.lateArrivalMs;
  if(match){used.add(match.id);match.label='timing-candidate-for-intended-shot';match.matchedAttempt=part.number;matched++;}else if(waiting)pending++;else missing++;
  part.intentAssociation={expectedShots:1,confirmedAt:confirmed,status:match?'timing-candidate':waiting?'awaiting-late-frame':'no-matching-detection',candidateId:match?.id??null,candidateIds:candidates.map(e=>e.id),ambiguous:candidates.length>1,method:'Closest captured shot to immediate Done confirmation; timing is evidence, not proof of intent.'};
 }
 if(extraPart)for(const event of events)if(event.sourcePart===extraPart.number&&!used.has(event.id))event.label='awaiting-done-confirmation';
 for(const part of session.parts){const unwanted=events.filter(e=>e.sourcePart===part.number&&e.label==='unwanted-shot');part.summary.unwantedShots=unwanted.length;part.intentAssociation.unwantedDetectionIds=unwanted.map(e=>e.id);part.outcome=part.intentAssociation.status==='timing-candidate'?(unwanted.length?'timing-matched-user-shot-with-unwanted-shots':'timing-matched-user-shot'):part.intentAssociation.status==='awaiting-late-frame'?'awaiting-late-detection':unwanted.length?'undetected-user-shot-with-unwanted-shots':'undetected-user-shot';}
 session.shotReview={confirmedAttempts:session.parts.length,matchedByTiming:matched,unmatchedAttempts:missing,pendingAttempts:pending,unwantedShots:events.filter(e=>e.label==='unwanted-shot').length,detections:events,matchingWindow:INTENT_MATCH,note:'Each Done confirms one intended shot. Only one nearby detection can match it. All remaining detections are unwanted; raw timing and full-hand frames are preserved.'};
 return session.shotReview;
}
