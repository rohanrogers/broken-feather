export function sessionStore(test=false){
  let connection;
  const open=()=>connection??=new Promise((resolve,reject)=>{if(!globalThis.indexedDB){reject(Error('Local database unavailable'));return;}const request=indexedDB.open(test?'chickenshot-debug-qa-v2':'chickenshot-debug-v2',1);request.onupgradeneeded=()=>request.result.createObjectStore('sessions');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  async function transaction(mode,action){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('sessions',mode),store=tx.objectStore('sessions'),request=action(store);let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  return {load:kind=>transaction('readonly',store=>store.get(kind)),save:(kind,data)=>transaction('readwrite',store=>store.put(data,kind)),clear:()=>transaction('readwrite',store=>store.clear())};
}
