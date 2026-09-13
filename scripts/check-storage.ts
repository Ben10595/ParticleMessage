// Opt-in integration check: inserts one neutral test message through the public app API.
// It expires normally after 72h; this script never changes schema, permissions or existing rows.
import assert from 'node:assert/strict';
import { loadMessage, saveMessage } from '../lib/messages';
import { DEFAULT_PARTICLE_STYLE, DEFAULT_SETTINGS, type MessageContent } from '../types/message';
async function main() {
 const content:MessageContent={version:1,slides:[{text:'Technischer Funktionstest. Keine persönliche Nachricht.',duration:1500,font:'classic',effect:'portal'}],settings:{...DEFAULT_SETTINGS,particles:{...DEFAULT_PARTICLE_STYLE,preset:'magnetic',speed:1.3}}};
 const slug=await saveMessage(content),loaded=await loadMessage(slug);
 assert.ok(loaded);assert.deepEqual(loaded.slides,content.slides);assert.deepEqual(loaded.settings,content.settings);
 console.log(JSON.stringify({saved:true,loaded:true,path:`/m/${slug}`,expiresAt:new Date(loaded.expiresAt).toISOString()}));
}
main().catch(()=>{console.error('Storage round-trip failed. No credentials are printed.');process.exitCode=1;});
