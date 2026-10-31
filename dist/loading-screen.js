export function loadingView({cameraReady=false,stage='runtime',loaded=0,total=null,slow=false}={}){
  if(!cameraReady)return {title:'Allow your camera',detail:'Choose Allow in your browser’s camera prompt. We’re preparing hand tracking while you decide.',step:'01 / CAMERA ACCESS',indeterminate:true};
  const views={
    cached:['Using saved hand tracking','The hand model is already on this device. No model download needed.'],
    runtime:['Loading the tracking engine','Camera connected. Getting the hand-tracking engine ready.'],
    download:['Downloading hand tracking','The hand model is downloading to your browser. Future visits may use the browser cache.'],
    initializing:['Starting hand tracking','Preparing the tracking runtime and your device’s graphics. Your camera is connected.'],
    fallback:['Trying compatibility mode','Switching to a compatible tracker for this device. Your camera is already connected.'],
    'tracker-ready':['Opening the field','The tracker is ready. Next, point comfortably at centre for the quick aim setup.']
  };
  const [title,detail]=views[stage]??views.runtime;
  const percent=stage==='download'&&total>0?Math.min(100,Math.max(0,Math.floor(loaded/total*100))):null;
  return {title,detail:slow?detail+' Taking longer than usual? You can switch to mouse play below.':detail,step:stage==='tracker-ready'?'03 / ALMOST READY':'02 / HAND TRACKING',percent,bytes:stage==='download'?`${(loaded/1e6).toFixed(1)}${total>0?' / '+(total/1e6).toFixed(1):''} MB`:'',indeterminate:percent===null};
}

export class LoadingScreen {
  constructor({onPractice}){
    this.root=document.createElement('section');this.root.className='field-loader';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-labelledby','loaderHeading');
    this.root.innerHTML=`<img class="field-loader-art" src="./assets/meadow.png" alt="" aria-hidden="true"><div class="field-loader-top"><span class="field-loader-brand">BROKEN <b>FEATHER</b><i>✦</i></span><span class="field-loader-edition">YOUR HAND. YOUR SHOT.</span></div><div class="field-loader-intro"><p class="field-loader-eyebrow">THE MEADOW IS CALLING</p><h1 id="loaderHeading">A little aim.<br>A lot of <em>feathers.</em></h1><p>One hand. Six shells.<br>Let’s get you into the field.</p></div><div class="field-loader-bottom"><div class="field-loader-label"><span id="loaderStep">01 / CAMERA ACCESS</span><span>ON-DEVICE HAND CONTROL</span></div><div class="field-loader-status"><h2 id="loaderStatus" role="status" aria-live="polite"></h2><span id="loaderAmount"></span></div><div class="field-loader-meter" id="loaderMeter" role="progressbar" aria-label="Hand model download"><span id="loaderFill"></span></div><p class="field-loader-detail" id="loaderDetail"></p><div class="field-loader-actions"><button type="button" id="loaderPractice">Play with mouse instead <span>↗</span></button><span class="field-loader-private">◉ &nbsp; CAMERA FRAMES STAY ON YOUR DEVICE</span></div><div class="field-loader-footer"><span>THE HANDS-FREE HUNT</span><span>NO AIMING YET. JUST GET COMFORTABLE.</span></div></div>`;
    document.body.append(this.root);this.root.querySelector('#loaderPractice').addEventListener('click',onPractice);
  }
  show(){this.state={cameraReady:false,stage:'runtime'};this.lastRender=-Infinity;this.root.hidden=false;document.querySelector('.game-app').inert=true;this.render();this.root.querySelector('button').focus({preventScroll:true});clearTimeout(this.slowTimer);this.slowTimer=setTimeout(()=>{this.state.slow=true;this.render();},12000);}
  update(detail){if(this.root.hidden)return;if(detail.stage==='camera-ready')this.state.cameraReady=true;else this.state={...this.state,...detail};const now=performance.now();if(detail.stage!=='download'||now-this.lastRender>100||detail.loaded===detail.total)this.render();}
  render(){this.lastRender=performance.now();const view=loadingView(this.state),find=id=>this.root.querySelector('#'+id);for(const [id,value] of Object.entries({loaderStep:view.step,loaderStatus:view.title,loaderDetail:view.detail,loaderAmount:view.percent!=null?`${view.percent}% · ${view.bytes}`:view.bytes||'PREPARING'})){const node=find(id);if(node.textContent!==value)node.textContent=value;}
    const meter=find('loaderMeter');meter.classList.toggle('is-indeterminate',view.indeterminate);if(view.percent!=null)meter.setAttribute('aria-valuenow',view.percent);else meter.removeAttribute('aria-valuenow');find('loaderFill').style.width=view.percent!=null?view.percent+'%':'';
  }
  hide(){clearTimeout(this.slowTimer);this.root.hidden=true;document.querySelector('.game-app').inert=false;}
}
