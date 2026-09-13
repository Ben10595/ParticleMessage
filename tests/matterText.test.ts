import test from 'node:test';
import assert from 'node:assert/strict';
import { TextSampler } from '../particles/matter/TextSampler';
// Deterministic font metrics isolate layout/UTF-16 invariants; browser tests exercise real glyph rasters.
test('raster layout wraps long words, preserves grapheme offsets, bounds sample count and caches glyphs',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');let reads=0;
 const canvas={width:0,height:0,getContext:()=>ctx};
 const ctx={font:'',fillStyle:'',textBaseline:'',scale(){},fillText(){},drawImage(){},
  measureText(text:string){const size=Number(this.font.match(/([\d.]+)px/)?.[1]??20);return {width:Array.from(text).length*size*.55};},
  getImageData(){reads++;const data=new Uint8ClampedArray(canvas.width*canvas.height*4);for(let i=3;i<data.length;i+=4)data[i]=255;return{data};}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>canvas}});
 try{
  const sampler=new TextSampler(),box={x:30,y:40,width:290,height:230};
  const sample=sampler.sample('W'.repeat(150),box,45,'classic','center',300);
  assert.ok(sample.lineCount>1);assert.ok(sample.fontSize>=16);assert.equal(sample.targets.length,300);
  const before=reads;sampler.sample('W'.repeat(150),box,45,'classic','center',300);assert.equal(reads,before,'same glyph geometry is reused');
  const text='Ä 👨‍👩‍👧‍👦\nCafé';const unicode=sampler.sample(text,box,25);
  assert.equal(unicode.glyphs.map(g=>text.slice(g.start,g.end)).join(''),text);
  assert.equal(unicode.glyphs.filter(g=>text.slice(g.start,g.end)==='👨‍👩‍👧‍👦').length,1);
  assert.ok(unicode.glyphs.every(g=>g.x>=box.x-.01&&g.x+g.width<=box.x+box.width+.01));
  assert.equal(sampler.sample('Hallo',{...box,width:0}).targets.length,0);
 }finally{if(original)Object.defineProperty(globalThis,'document',original);else Reflect.deleteProperty(globalThis,'document');}
});
