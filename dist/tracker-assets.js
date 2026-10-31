// Stream the model once so loading UI reflects real bytes, including cached responses.
export async function loadTrackingModel(url,{onProgress=()=>{},signal}={}){
  let cache;
  try{cache=await globalThis.caches?.open('broken-feather-tracking-v1');}catch{}
  if(signal?.aborted)signal.throwIfAborted();
  if(cache){
    try{const saved=await cache.match(url);if(saved?.ok){const bytes=new Uint8Array(await saved.arrayBuffer());if(bytes.length){onProgress({stage:'cached',loaded:bytes.length,total:bytes.length});return bytes;}await cache.delete(url);}}catch(error){if(signal?.aborted)throw error;}
  }
  const response=await fetch(url,{signal});
  if(!response.ok)throw Error(`Hand model download failed (${response.status}). Check your connection and retry.`);
  const cacheCopy=cache?response.clone():null;
  const save=async()=>{if(cacheCopy)try{await cache.put(url,cacheCopy);}catch{}};
  const length=Number(response.headers.get('content-length'));
  const total=Number.isFinite(length)&&length>0?length:null;
  let loaded=0;onProgress({stage:'download',loaded,total});
  if(!response.body?.getReader){const bytes=new Uint8Array(await response.arrayBuffer());if(!bytes.length)throw Error('The hand model download was empty. Please retry.');onProgress({stage:'download',loaded:bytes.byteLength,total:bytes.byteLength});await save();return bytes;}
  const reader=response.body.getReader(),chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;onProgress({stage:'download',loaded,total});}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  if(!loaded)throw Error('The hand model download was empty. Please retry.');
  const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  onProgress({stage:'download',loaded,total:loaded});await save();return bytes;
}
