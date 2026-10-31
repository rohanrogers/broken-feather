// Cache only versioned tracking assets. App HTML/JS remains fresh on every deploy.
let registration;
export function ensureTrackingCache(){
  if(!globalThis.navigator?.serviceWorker||!globalThis.isSecureContext)return Promise.resolve();
  return registration??=connect().catch(()=>{});
}
async function connect(){
  await navigator.serviceWorker.register(new URL('./tracking-cache-worker.js',import.meta.url),{scope:new URL('./',import.meta.url).pathname});
  if(navigator.serviceWorker.controller)return;
  await new Promise(resolve=>{
      const ready=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',ready);resolve();};
      const timer=setTimeout(ready,2000);navigator.serviceWorker.addEventListener('controllerchange',ready,{once:true});
      if(navigator.serviceWorker.controller)ready();
  });
}
