// Synthetic startup events only. This module is never imported by production.
import {HandCamera as SyntheticCamera} from './synthetic-camera.js?v=loading-17';
export class HandCamera extends SyntheticCamera {
 async start(video){
  const session=this.session;this.pending=true;this.onState('loading');this.onProgress?.({stage:'permission'});
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  await delay(350);if(session!==this.session)return;this.onProgress?.({stage:'camera-ready'});
  for(let i=0;i<=4;i++){if(session!==this.session)return;this.onProgress?.({stage:'download',loaded:1954776*i,total:7819105});await delay(300);}
  if(session!==this.session)return;
  if(new URLSearchParams(parent.location.search).has('preview')){this.onProgress?.({stage:'download',loaded:4691463,total:7819105});return;}
  this.onProgress?.({stage:'initializing'});await delay(600);if(session!==this.session)return;
  if(new URLSearchParams(parent.location.search).has('error')){this.fail('Synthetic model download failed. Please retry.');return;}
  this.pending=false;await super.start(video);
 }
}
