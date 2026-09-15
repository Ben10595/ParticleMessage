import test from 'node:test';
import assert from 'node:assert/strict';
import { ParticlePool } from '../particles/matter/MorphSystem';
import { stepPhysics, type PhysicsOptions } from '../particles/matter/PhysicsSystem';
import { sampleShape } from '../particles/matter/ShapeSampler';
import { DEFAULT_PARTICLE_STYLE, DEFAULT_SETTINGS, EFFECTS, validateMessage } from '../types/message';
import type { InteractionSystem } from '../particles/matter/InteractionSystem';
import { QualityManager } from '../particles/matter/QualityManager';
const interaction = { pointers:new Map(), ripples:[] } as unknown as InteractionSystem;
const options: PhysicsOptions = { reduced:false,hold:null,tiltX:0,tiltY:0,floating:false,giftAt:null,portalAt:null,atmosphere:false,style:DEFAULT_PARTICLE_STYLE };
function run(p:ParticlePool,hz:number,ms:number,opts=options,input=interaction) { for(let t=1000/hz;t<=ms+.1;t+=1000/hz) stepPhysics(p,input,t,1000/hz,800,600,opts); }
test('one persistent pool transfers IDs from UI to scene, retires surplus and never duplicates ownership',()=>{
 const p=new ParticlePool(800,800,600), storage=p.x;
 const targets=Array.from({length:600},(_,i)=>({x:100+i%30*5,y:100+Math.floor(i/30)*5}));
 const ui=p.form(1,targets,0,1000,'morph');run(p,60,2000);p.release(1,2000);
 const before=Array.from(p.x),scene=p.form(2,targets,2000,1000,'spiral');
 assert.equal(p.x,storage);assert.deepEqual(new Set(scene),new Set(ui));
 for(const id of scene) assert.equal(p.fx[id],before[id]);
 p.form(1,targets,2000,1000,'morph');
 const ids=[...p.groups.values()].flat();assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,800);
 p.form(2,targets.slice(0,40),2500,1000,'morph');assert.equal(p.groups.get(2)?.length,40);assert.equal(p.countOwned(),240);
});
test('spring integration stays finite and converges at 30, 60 and 120 Hz for every reveal',()=>{
 for(const effect of EFFECTS.filter(e=>e!=='random')) for(const hz of [30,60,120]) {
  const p=new ParticlePool(32,800,600);p.form(2,[{x:400,y:300}],0,1100,effect);run(p,hz,4500);
  const id=p.groups.get(2)![0];assert.ok(Number.isFinite(p.x[id]),effect);
  assert.ok(Math.hypot(p.x[id]-400,p.y[id]-300)<.1,`${effect}/${hz} settles`);
 }
});
test('pointer pressure returns home and reversible hold does not leak target text before interaction',()=>{
 const p=new ParticlePool(32,800,600);p.form(2,[{x:400,y:300}],0,1000,'morph');run(p,60,3000);
 const id=p.groups.get(2)![0], active={pointers:new Map([[1,{x:397,y:300,vx:0,vy:0,touch:false,time:0}]]),ripples:[]} as unknown as InteractionSystem;
 run(p,60,4000,options,active);assert.ok(p.x[id]>402);assert.ok(p.x[id]<430,'held text remains within a readable displacement');
 run(p,60,5000);assert.ok(Math.abs(p.x[id]-400)<.1);
 const before=p.x[id];p.form(2,[{x:650,y:500}],0,1000,'spiral');run(p,60,1000,{...options,hold:0});assert.ok(Math.abs(p.x[id]-before)<.1);
 run(p,60,4000,{...options,hold:1});assert.ok(Math.abs(p.x[id]-650)<.1);
});
test('reduced motion suppresses pointer, ripple, portal, tilt and drift',()=>{
 const p=new ParticlePool(32,800,600);p.form(2,[{x:400,y:300}],0,1000,'portal');
 run(p,60,100,{...options,reduced:true,floating:true,portalAt:0,tiltX:100,tiltY:100});
 const id=p.groups.get(2)![0];assert.equal(p.x[id],400);assert.equal(p.y[id],300);assert.equal(p.vx[id],0);
});
test('gift has sampled front/side surfaces, depth, and a separate lid and bow',()=>{
 const targets=sampleShape('gift',390,844);const body=targets.filter(p=>!p.part),lid=targets.filter(p=>p.part===1);
 assert.ok(body.length>1000);assert.ok(lid.length>1000);assert.ok(new Set(body.map(p=>p.z)).size>20);
 assert.ok(targets.every(p=>p.x>=0&&p.x<=390&&p.y>=0&&p.y<=844));
});
test('particle settings round-trip and reject malformed untrusted values',()=>{
 const message={version:1,slides:[{text:'Hello',duration:1000}],settings:{...DEFAULT_SETTINGS,particles:DEFAULT_PARTICLE_STYLE}};
 assert.deepEqual(validateMessage(message).settings?.particles,DEFAULT_PARTICLE_STYLE);
 for(const patch of [{speed:0},{speed:Infinity},{density:'unlimited'},{trails:1},{interaction:'script'}]) assert.throws(()=>validateMessage({...message,settings:{...message.settings,particles:{...DEFAULT_PARTICLE_STYLE,...patch}}}));
});
test('sustained slow rendering reduces quality; isolated slow frames do not oscillate it',()=>{
 const q=new QualityManager();for(let i=0;i<10;i++)q.sample(40);assert.equal(q.level,1);
 for(let i=0;i<140;i++)q.sample(40);assert.ok(q.level<1);
 const low=q.level;for(let i=0;i<50;i++)q.sample(16.67);assert.equal(q.level,low);
});

test('scroll translation preserves particle identity, velocity and reveal progress',()=>{
 const p=new ParticlePool(20,800,600);
 const ids=p.form(1,[{x:120,y:240,uiElement:1},{x:150,y:240,uiElement:2}],100,1200,'wave');
 p.vx[ids[0]]=8; p.vy[ids[0]]=-3;
 const snapshot=ids.map(i=>({x:p.x[i],y:p.y[i],tx:p.tx[i],ty:p.ty[i],fx:p.fx[i],fy:p.fy[i],start:p.start[i],duration:p.duration[i]}));
 p.translate(ids,0,-320);
 ids.forEach((i,n)=>{
  assert.equal(p.x[i],snapshot[n].x); assert.ok(Math.abs(p.y[i]-(snapshot[n].y-320))<.001);
  assert.equal(p.tx[i],snapshot[n].tx); assert.equal(p.ty[i],snapshot[n].ty-320);
  assert.equal(p.start[i],snapshot[n].start); assert.equal(p.duration[i],snapshot[n].duration);
 });
 assert.equal(p.vx[ids[0]],8);assert.equal(p.vy[ids[0]],-3);
 assert.deepEqual(p.groups.get(1),ids);assert.equal(p.uiElement[ids[0]],1);
 p.translate(ids,0,320);assert.equal(p.ty[ids[0]],240);
});
