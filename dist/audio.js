export class ArcadeAudio {
  constructor(){this.volume=.65;this.muted=false;this.context=null;}
  init(){if(!this.context){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=this.muted?0:this.volume;this.master.connect(this.context.destination);}this.context.resume().catch(()=>{});}
  setVolume(value){this.volume=value;if(this.master)this.master.gain.setTargetAtTime(this.muted?0:value,this.context.currentTime,.02);}
  toggle(){this.muted=!this.muted;this.setVolume(this.volume);return this.muted;}
  tone(freq,end,duration,gain=.15,type='sine',delay=0){if(!this.context)return;const c=this.context,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.01);}
  shot(){if(!this.context)return;const c=this.context,n=Math.floor(c.sampleRate*.2),buffer=c.createBuffer(1,n,c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(n*.14));const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=1800;gain.gain.value=.4;source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start();this.tone(125,35,.2,.25,'triangle');}
  mechanicalNoise(duration,startHz,endHz,gain,delay=0){
    if(!this.context)return;const c=this.context,t=c.currentTime+delay,n=Math.ceil(c.sampleRate*duration),buffer=c.createBuffer(1,n,c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*(.65+.35*Math.sin(i/c.sampleRate*2*Math.PI*95));
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),envelope=c.createGain();source.buffer=buffer;filter.type='bandpass';filter.Q.value=.7;filter.frequency.setValueAtTime(startHz,t);filter.frequency.exponentialRampToValueAtTime(endHz,t+duration);envelope.gain.setValueAtTime(.001,t);envelope.gain.linearRampToValueAtTime(gain,t+.004);envelope.gain.exponentialRampToValueAtTime(.001,t+duration);source.connect(filter);filter.connect(envelope);envelope.connect(this.master);source.start(t);source.stop(t+duration);
  }
  cycle({chamber=true}={}){
    // Pull back/eject, followed by the forward slide and locking clack.
    this.mechanicalNoise(.085,1300,3200,.19,.19);this.tone(190,85,.045,.14,'triangle',.265);this.tone(2500,900,.025,.035,'square',.27);
    if(chamber)this.chamber(.37);
  }
  chamber(delay=0){this.mechanicalNoise(.075,2800,750,.18,delay);this.tone(150,55,.065,.18,'triangle',delay+.065);this.tone(3400,1400,.022,.035,'square',delay+.075);}
  hit(){this.tone(640,1000,.1,.09,'sine',.03);this.tone(1000,1400,.13,.07,'sine',.1);}
  reload(delay=0){this.tone(170,95,.055,.05,'square',delay);this.tone(290,180,.065,.05,'square',delay+.17);}
  ready(){this.tone(520,520,.12,.08,'sine');}
  finish(){[440,554,659,880].forEach((f,i)=>this.tone(f,f,.35,.08,'triangle',i*.12));}
}
