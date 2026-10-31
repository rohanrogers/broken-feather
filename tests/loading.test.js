import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTrackingModel} from '../dist/tracker-assets.js';
import {loadingView} from '../dist/loading-screen.js';

test('streamed model reports received bytes and returns the complete model',async t=>{
 const progress=[];t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.enqueue(new Uint8Array([3,4,5]));c.close();}}),{headers:{'content-length':'5'}}));
 const bytes=await loadTrackingModel('/model',{onProgress:p=>progress.push(p)});assert.deepEqual([...bytes],[1,2,3,4,5]);assert.ok(progress.some(p=>p.loaded===2&&p.total===5));assert.equal(progress.at(-1).loaded,5);
});
test('missing content length shows bytes without inventing a percentage until completion',async t=>{
 const progress=[];t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([1,2,3])));await loadTrackingModel('/model',{onProgress:p=>progress.push(p)});assert.equal(progress[0].total,null);assert.equal(progress.at(-1).total,3);const v=loadingView({cameraReady:true,stage:'download',loaded:2});assert.equal(v.percent,null);assert.equal(v.indeterminate,true);
});
test('failed and empty downloads never advance to model initialization',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('not found',{status:404}));await assert.rejects(loadTrackingModel('/model'),/404/);
 globalThis.fetch=async()=>new Response(new Uint8Array());await assert.rejects(loadTrackingModel('/model'),/empty/);
});
test('download abort signal is passed through and cancellation rejects',async t=>{
 const abort=new AbortController();abort.abort();t.mock.method(globalThis,'fetch',async(url,{signal})=>{assert.equal(signal,abort.signal);signal.throwIfAborted();});await assert.rejects(loadTrackingModel('/model',{signal:abort.signal}),{name:'AbortError'});
});
test('camera permission remains distinct from a downloaded model and engine initialization',()=>{
 assert.match(loadingView({stage:'tracker-ready',cameraReady:false}).title,/Allow your camera/);
 const downloading=loadingView({cameraReady:true,stage:'download',loaded:30,total:100});assert.equal(downloading.percent,30);assert.equal(downloading.indeterminate,false);
 const initializing=loadingView({cameraReady:true,stage:'initializing',loaded:100,total:100});assert.equal(initializing.percent,null);assert.equal(initializing.indeterminate,true);assert.match(initializing.title,/Starting/);
 assert.match(loadingView({cameraReady:true,stage:'fallback'}).title,/compatibility/);
});

test('a saved model is reused without a network request on the next load',async t=>{
 const saved=new Map();const original=Object.getOwnPropertyDescriptor(globalThis,'caches');
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{open:async()=>({match:async key=>saved.get(key)?.clone(),put:async(key,response)=>{saved.set(key,response.clone());},delete:async key=>saved.delete(key)})}});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'caches',original);else delete globalThis.caches;});
 let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;return new Response(new Uint8Array([7,8,9]));});
 const first=await loadTrackingModel('https://example.test/model');const progress=[];const second=await loadTrackingModel('https://example.test/model',{onProgress:p=>progress.push(p)});
 assert.equal(requests,1);assert.deepEqual(second,first);assert.equal(progress[0].stage,'cached');
});
