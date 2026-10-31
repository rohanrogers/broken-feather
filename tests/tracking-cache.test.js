import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../dist/tracking-cache-worker.js',import.meta.url),'utf8');
test('runtime cache serves saved assets while leaving game code and unrelated requests uncached',async()=>{
 const handlers={},saved=new Map();let requests=0;
 const cache={match:async req=>saved.get(req.url)?.clone(),put:async(req,response)=>saved.set(req.url,response)};
 vm.runInNewContext(source,{URL,self:{location:{href:'https://game.test/tracking-cache-worker.js',origin:'https://game.test'},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>cache},fetch:async()=>{requests++;return new Response('runtime');}});
 const events=[];const read=async url=>{let response;handlers.fetch({request:new Request(url),respondWith:p=>response=p,waitUntil:p=>events.push(p)});if(!response)return null;const text=await(await response).text();await Promise.all(events);return text;};
 assert.equal(await read('https://game.test/assets/mediapipe/wasm/engine.wasm'),'runtime');assert.equal(await read('https://game.test/assets/mediapipe/wasm/engine.wasm'),'runtime');assert.equal(requests,1);
 for(const url of ['https://game.test/index.html','https://game.test/app.js?v=new','https://game.test/camera.js','https://other.test/assets/mediapipe/model.wasm'])assert.equal(await read(url),null);
});
