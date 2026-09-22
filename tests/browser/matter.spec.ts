import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_PARTICLE_STYLE, DEFAULT_SETTINGS, type MessageContent } from '../../types/message';
async function message(page:Page,content:MessageContent){
 await page.route('**/rest/v1/messages*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content,created_at:new Date().toISOString()})}));
 await page.goto('/m/matterTest12');
}
const hello:MessageContent={version:1,slides:[{text:'Ein Moment. Nur für dich.',duration:10000,font:'classic'}]};
test('new public route renders through WebGL2 and recovers the same canvas after context loss',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await message(page,hello);
 const canvas=page.locator('canvas');await expect(canvas).toHaveAttribute('data-renderer','webgl2');await expect(page.locator('.viewer-text')).toHaveText(hello.slides[0].text);
 const handle=await canvas.elementHandle();
 const supported=await canvas.evaluate(el=>!!(el as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context'));
 test.skip(!supported,'The browser does not expose context-loss simulation.');
 await canvas.evaluate(el=>{const ext=(el as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!;ext.loseContext();setTimeout(()=>ext.restoreContext(),350);});
 await expect(canvas).toHaveAttribute('data-renderer','recovering');
 await expect(canvas).toHaveAttribute('data-renderer','webgl2');await expect(canvas).toHaveAttribute('data-phase','holding');
 expect(await handle?.evaluate(el=>el===document.querySelector('canvas'))).toBe(true);expect(errors).toEqual([]);
});
test('WebGL-unavailable devices use the actual Canvas2D particle fallback',async({page},info)=>{
 await page.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){if(type==='webgl2')return null;return Reflect.apply(getContext,this,[type,...args]);} as typeof getContext;});
 await message(page,hello);await expect(page.locator('.viewer-text')).toHaveText(hello.slides[0].text);await expect(page.locator('canvas')).toHaveAttribute('data-renderer','canvas2d');await expect(page.locator('canvas')).toHaveAttribute('data-phase','holding');
 await expect.poll(async()=>Number(await page.locator('canvas').getAttribute('data-text-target-count'))).toBeGreaterThan(100);
 await page.screenshot({path:`test-results/matter-canvas-fallback-${info.project.name}.png`});
});
test('new reveal paths and physics settings survive public playback',async({page},info)=>{
 const effects=['portal','gravity','shockwave','dust','orbit','chaos','pixel'] as const;
 await message(page,{version:1,slides:effects.map(effect=>({text:effect,duration:1000,effect,font:'classic'})),settings:{...DEFAULT_SETTINGS,particles:{...DEFAULT_PARTICLE_STYLE,preset:'magnetic',interaction:'attract',wind:true,gravity:true,density:'light',speed:1.4}}});
 for(const effect of effects){await expect(page.locator('.viewer-text')).toHaveText(effect,{timeout:6000});await expect(page.locator('canvas')).toHaveAttribute('data-text-effect',effect);}
 await expect(page.getByRole('button',{name:'Nochmal'})).toBeVisible({timeout:7000});
 await page.screenshot({path:`test-results/matter-ended-${info.project.name}.png`});
});
test('particle controls persist in the saved message',async({page})=>{
 await page.goto('/');await page.getByLabel('Passwort',{exact:true}).fill('particle-test');await page.getByRole('button',{name:'Öffnen',exact:true}).click();await page.getByRole('button',{name:'Nachricht erstellen',exact:true}).click();
 await page.getByRole('textbox',{name:'ABSCHNITT 01'}).fill('Du fehlst.');
 await page.locator('summary').filter({hasText:'Bewegung & Atmosphäre'}).click();
 await page.getByRole('combobox',{name:'Partikelphysik',exact:true}).click();await page.getByRole('option',{name:'Magnetic',exact:true}).click();
 await page.getByRole('combobox',{name:'Partikelmenge',exact:true}).click();await page.getByRole('option',{name:'Leicht',exact:true}).click();
 await page.getByLabel('Animationsgeschwindigkeit').fill('1.5');await page.getByRole('switch',{name:'Leichter Wind',exact:true}).check();
 let saved:MessageContent|undefined;
 await page.route('**/rest/v1/messages*',route=>{saved=route.request().postDataJSON().content;return route.fulfill({status:201,body:''});});
 await page.getByRole('button',{name:'Nachricht senden',exact:true}).click();await expect(page.getByLabel('Link zu deiner Nachricht')).toHaveValue(/\/m\/[A-Za-z0-9_-]{12}$/);
 expect(saved?.settings?.particles).toMatchObject({preset:'magnetic',density:'light',speed:1.5,wind:true});
});
test('homepage keeps the particle canvas dormant behind the responsive Message Core',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Passwort',{exact:true}).fill('particle-test');await page.getByRole('button',{name:'Öffnen',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Was möchtest du sagen?'})).toBeVisible();
 await expect(page.locator('.message-core')).toBeVisible();
 await expect.poll(async()=>Number(await page.locator('canvas').getAttribute('data-ui-target-count'))).toBe(0);
 await page.waitForTimeout(2000);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/matter-home-${info.project.name}.png`});
 expect(await page.locator('canvas').count()).toBe(1);
});
