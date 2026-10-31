import test from 'node:test';
import assert from 'node:assert/strict';
import {AimPresence} from '../dist/aim-presence.js';
test('brief tracking loss holds a stationary visible cursor but immediately removes live shot authorization',()=>{const p=new AimPresence();assert.equal(p.visible(0),false);p.observe(true,100);p.observe(false,130);assert.equal(p.visible(300),true);assert.equal(p.live(130),false);assert.equal(p.visible(350),false);p.observe(true,360);assert.equal(p.live(360),true);p.reset();assert.equal(p.visible(361),false);});
test('slow regular delivery keeps its existing freshness allowance without inventing live tracking during loss',()=>{const p=new AimPresence();p.observe(true,0);assert.equal(p.visible(400,450),true);p.observe(false,405);assert.equal(p.visible(410,450),true);assert.equal(p.live(410,450),false);assert.equal(p.visible(450,450),false);});
