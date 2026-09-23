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
test('spatial matching avoids crossed paths when text moves across the old row boundary',()=>{
 const p=new ParticlePool(2,800,600);
 p.x[0]=100;p.x[1]=200;p.y[0]=p.y[1]=23;
 const ids=p.form(2,[{x:100,y:25},{x:200,y:25}],0,1200,'morph');
 assert.equal(new Set(ids).size,2);
 for(const i of ids) assert.equal(Math.hypot(p.tx[i]-p.fx[i],p.ty[i]-p.fy[i]),2);
});
test('unperturbed particles reach their assigned glyphs by the reveal deadline at every refresh rate',()=>{
 for(const effect of EFFECTS.filter(e=>e!=='random')) for(const hz of [30,60,90,120,144]) {
  const p=new ParticlePool(16,800,600);
  const ids=p.form(2,[{x:320,y:240},{x:450,y:380}],0,1200,effect);
  run(p,hz,1300);
  for(const i of ids)assert.ok(Math.hypot(p.x[i]-p.tx[i],p.y[i]-p.ty[i])<.05,`${effect}/${hz} arrives without trailing behind`);
 }
});
test('nearby dots follow coherent spiral paths independent of the screen position',()=>{
 const targets=[{x:300,y:250},{x:301,y:250},{x:500,y:350}];
 const p=new ParticlePool(32,800,600), shifted=new ParticlePool(32,800,600);
 const ids=p.form(2,targets,0,1100,'spiral');
 const other=shifted.form(2,targets.map(t=>({x:t.x+80,y:t.y-60})),0,1100,'spiral');
 ids.forEach(id=>{
  const match=other.find(i=>shifted.tx[i]===p.tx[id]+80&&shifted.ty[i]===p.ty[id]-60)!;
  assert.ok(Math.abs(p.flowX[id]-shifted.flowX[match])<.001);
  assert.ok(Math.abs(p.flowY[id]-shifted.flowY[match])<.001);
  p.x[id]=p.fx[id]=p.guideX[id]=p.tx[id]-100;p.y[id]=p.fy[id]=p.guideY[id]=p.ty[id]+30;
 });
 run(p,60,600);
 const a=ids.find(i=>p.tx[i]===300)!,b=ids.find(i=>p.tx[i]===301)!;
 assert.ok(Math.hypot(p.x[a]-p.x[b],p.y[a]-p.y[b])<3,'neighbours stay together during the swirl');
});
test('released lettering keeps a visible dissolve before returning to background matter',()=>{
 const p=new ParticlePool(32,800,600),ids=p.form(2,[{x:400,y:300}],0,0,'morph');
 run(p,60,3000);p.release(2,3000,.6);
 for(let t=3016.67;t<=3300;t+=1000/60)stepPhysics(p,interaction,t,1000/60,800,600,options);
 assert.ok(p.alpha[ids[0]]>.65,'letters do not disappear immediately');
 for(let t=3316.67;t<=5200;t+=1000/60)stepPhysics(p,interaction,t,1000/60,800,600,options);
 assert.ok(p.alpha[ids[0]]<.03,'dissolved letters do not leave ghosts');
});
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
test('spring integration stays finite and converges at 30, 60, 90, 120 and 144 Hz for every reveal',()=>{
 for(const effect of EFFECTS.filter(e=>e!=='random')) for(const hz of [30,60,90,120,144]) {
  const p=new ParticlePool(32,800,600);p.form(2,[{x:400,y:300}],0,1100,effect);run(p,hz,4500);
  const id=p.groups.get(2)![0];assert.ok(Number.isFinite(p.x[id]),effect);
  assert.ok(Math.hypot(p.x[id]-400,p.y[id]-300)<.1,`${effect}/${hz} settles`);
 }
});

test('portal starts at existing text geometry and converges to the centre without an initial jump',()=>{
 const p=new ParticlePool(32,800,600);
 const ids=p.form(2,[{x:200,y:230},{x:580,y:320}],0,0,'morph');
 run(p,60,3000);
 const before=ids.map(i=>({x:p.x[i],y:p.y[i]}));
 const portal={...options,portalAt:3000};
 stepPhysics(p,interaction,3000,1000/60,800,600,portal);
 ids.forEach((i,n)=>assert.ok(Math.hypot(p.x[i]-before[n].x,p.y[i]-before[n].y)<.01,'no impulse at portal entry'));
 for(let t=3016.67;t<6500;t+=1000/60) stepPhysics(p,interaction,t,1000/60,800,600,portal);
 ids.forEach(i=>assert.ok(Math.hypot(p.x[i]-400,p.y[i]-264)<.1,'portal reaches its centre'));
});
test('pointer pressure returns home and reversible hold does not leak target text before interaction',()=>{
 const p=new ParticlePool(32,800,600);p.form(2,[{x:400,y:300}],0,1000,'morph');run(p,60,3000);
 const id=p.groups.get(2)![0], active={pointers:new Map([[1,{x:397,y:300,vx:0,vy:0,touch:false,time:0}]]),ripples:[]} as unknown as InteractionSystem;
 run(p,60,4000,options,active);assert.ok(p.x[id]>402);assert.ok(p.x[id]<430,'held text remains within a readable displacement');
 run(p,60,5000);assert.ok(Math.abs(p.x[id]-400)<.1);
 const before=p.x[id];p.form(2,[{x:650,y:500}],0,1000,'spiral');run(p,60,1000,{...options,hold:0});assert.ok(Math.abs(p.x[id]-before)<.1);
 run(p,60,4000,{...options,hold:1});assert.ok(Math.abs(p.x[id]-650)<.1);
});
test('hover shimmer stays local to interface particles and moves them smoothly',()=>{
 const hovered=new ParticlePool(12,800,600),plain=new ParticlePool(12,800,600);
 const target={x:500,y:300,uiElement:1};
 const hoveredIds=hovered.form(1,[target],0,0,'morph'),plainIds=plain.form(1,[target],0,0,'morph');
 run(hovered,60,2600);run(plain,60,2600);
 const wave={pointers:new Map(),ripples:[],hoverWaves:[{x:400,y:260,width:100,height:80,start:2600}]} as unknown as InteractionSystem;
 stepPhysics(hovered,wave,2900,1000/60,800,600,options);
 stepPhysics(plain,interaction,2900,1000/60,800,600,options);
 const shift=Math.hypot(hovered.x[hoveredIds[0]]-plain.x[plainIds[0]],hovered.y[hoveredIds[0]]-plain.y[plainIds[0]]);
 assert.ok(shift>.05&&shift<4,'button contour gets a restrained local shimmer');
 for(let i=0;i<hovered.count;i++) if(!hovered.owner[i]) {
  assert.ok(Math.abs(hovered.x[i]-plain.x[i])<.001&&Math.abs(hovered.y[i]-plain.y[i])<.001,'ambient particles stay untouched');
 }
});
test('reduced motion suppresses pointer, ripple, portal, tilt and drift',()=>{
 const p=new ParticlePool(32,800,600);p.form(2,[{x:400,y:300}],0,1000,'portal');
 run(p,60,100,{...options,reduced:true,floating:true,portalAt:0,tiltX:100,tiltY:100});
 const id=p.groups.get(2)![0];assert.equal(p.x[id],400);assert.equal(p.y[id],300);assert.equal(p.vx[id],0);
});
test('sequenced reveals hide future glyphs and a changed animation replays cleanly',()=>{
 const p=new ParticlePool(1,800,600);
 const [id]=p.form(2,[{x:400,y:300,delay:500}],0,240,'typewriter');
 stepPhysics(p,interaction,100,1000/60,800,600,options);
 assert.equal(p.alpha[id],0,'the next character is fully hidden');
 p.form(2,[{x:400,y:300,delay:0}],100,1000,'fade');
 assert.equal(p.alpha[id],0,'changing the effect starts a fresh reveal');
 stepPhysics(p,interaction,600,1000/60,800,600,options);
 assert.ok(p.alpha[id]>0 && p.alpha[id]<p.opacity[id]);
 run(p,60,2200);
 assert.ok(p.alpha[id]>.9,'the final letter is readable');
 const beforeResize=p.alpha[id];
 p.form(2,[{x:420,y:305,delay:0}],100,1000,'fade',false,false);
 assert.equal(p.alpha[id],beforeResize,'a layout refresh keeps already revealed text visible');
});
test('preview presets take different paths while every effect reaches exact text geometry',()=>{
 const at=(effect:typeof EFFECTS[number])=>{
  const p=new ParticlePool(1,800,600);
  const [id]=p.form(2,[{x:400,y:300,radius:2}],0,1000,effect);
  stepPhysics(p,interaction,500,1000/60,800,600,options);
  return {x:p.x[id],y:p.y[id],alpha:p.alpha[id],radius:p.radius[id]};
 };
 const fade=at('fade'),assemble=at('collect'),typewriter=at('typewriter'),floating=at('floatingWords'),wave=at('wave'),fragment=at('scatter'),glow=at('bloom'),decode=at('pixel');
 assert.ok(Math.abs(fade.x-400)<.01 && Math.abs(fade.y-300)<.01,'reveal forms in place');
 assert.ok(typewriter.y>fade.y+5,'typewriter settles each glyph');
 assert.ok(floating.y>typewriter.y+15,'floating words lift from below');
 assert.ok(Math.abs(wave.y-fade.y)>10,'wave carries text vertically');
 assert.ok(Math.hypot(assemble.x-fade.x,assemble.y-fade.y)>20,'letters assemble from nearby dust');
 assert.ok(Math.hypot(fragment.x-fade.x,fragment.y-fade.y)>10,'fragments spread before joining');
 assert.ok(Math.hypot(fragment.x-assemble.x,fragment.y-assemble.y)>20,'fragments and assemble take different paths');
 assert.ok(glow.radius>3.5,'glow has a distinct particle pulse');
 assert.ok(Math.hypot(decode.x-fade.x,decode.y-fade.y)>8,'decode passes through a scan grid');
 for(const effect of ['fade','collect','pixel','typewriter','wave','scatter','bloom','wordByWord','floatingWords'] as const){
  const p=new ParticlePool(1,800,600),[id]=p.form(2,[{x:400,y:300,delay:300}],0,1000,effect);
  stepPhysics(p,interaction,50,1000/60,800,600,{...options,reduced:true});
  assert.equal(p.x[id],400,effect);assert.equal(p.y[id],300,effect);
  assert.equal(p.alpha[id],p.opacity[id],effect);assert.equal(p.radius[id],p.baseRadius[id],effect);
 }
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
