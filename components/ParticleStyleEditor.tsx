'use client';
import { DEFAULT_PARTICLE_STYLE, type MessageSettings, type ParticleStyle } from '@/types/message';
import ParticleSelect from './ParticleSelect';
export default function ParticleStyleEditor({ settings, onChange, busy }: { settings: MessageSettings; onChange: (value: MessageSettings) => void; busy: boolean }) {
  const style = { ...DEFAULT_PARTICLE_STYLE, ...settings.particles };
  const update = (patch: Partial<ParticleStyle>) => onChange({ ...settings, particles: { ...style, ...patch } });
  return <details className="advanced feature-section matter-settings"><summary>Die Partikelwelt <span>Physik & Atmosphäre</span></summary><div className="feature-content">
    <div className="control-row"><span>Charakter</span><ParticleSelect label="Partikelphysik" value={style.preset} disabled={busy} onChange={preset => update({ preset: preset as ParticleStyle['preset'] })} options={[{ value:'spring',label:'Sanfte Feder' },{ value:'soft',label:'Soft Float' },{ value:'magnetic',label:'Magnetic' },{ value:'explosive',label:'Explosive' }]} /></div>
    <div className="control-row"><span>Partikelmenge</span><ParticleSelect label="Partikelmenge" value={style.density} disabled={busy} onChange={density => update({ density: density as ParticleStyle['density'] })} options={[{ value:'light',label:'Leicht' },{ value:'balanced',label:'Ausgewogen' },{ value:'rich',label:'Dicht' }]} /></div>
    <label className="range-control"><span>Geschwindigkeit <output>{style.speed.toLocaleString('de-DE')}×</output></span><input aria-label="Animationsgeschwindigkeit" type="range" min="0.5" max="2" step="0.1" value={style.speed} disabled={busy} onChange={e => update({ speed:Number(e.target.value) })} /></label>
    <div className="control-row"><span>Berührung</span><ParticleSelect label="Partikelinteraktion" value={style.interaction} disabled={busy} onChange={interaction => update({ interaction: interaction as ParticleStyle['interaction'] })} options={[{ value:'repel',label:'Ausweichen' },{ value:'attract',label:'Anziehen' },{ value:'none',label:'Ruhen' }]} /></div>
    {([['trails','Bewegungsspuren'],['ripples','Klickwellen'],['wind','Leichter Wind'],['gravity','Schwerkraft']] as const).map(([key,label]) => <label className="control-row" key={key}><span>{label}</span><input className="switch" role="switch" type="checkbox" aria-label={label} checked={style[key]} disabled={busy} onChange={e => update({ [key]:e.target.checked })} /></label>)}
  </div></details>;
}
