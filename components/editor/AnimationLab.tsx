'use client';

import {
  LIVING_TYPE_CONTROLS,
  LIVING_TYPE_ENGINES,
  LIVING_TYPE_PARAM_META,
  type LivingTypeEngine,
  type LivingTypeParams,
} from '@/types/message';
import styles from './AnimationLab.module.css';

const ENGINE_DETAILS: Record<LivingTypeEngine, { name: string; mark: string; description: string }> = {
  line: { name: 'LINE', mark: '⌁', description: 'Eine Linie schreibt und wird zur Schrift.' },
  particle: { name: 'PARTICLE', mark: '⋰', description: 'Punkte finden zu deinen Worten.' },
  liquid: { name: 'LIQUID', mark: '≈', description: 'Flüssige Formen verbinden sich.' },
  thread: { name: 'THREAD', mark: '╱', description: 'Feine Fäden verweben den Text.' },
  signal: { name: 'SIGNAL', mark: '▦', description: 'Scanlinien entschlüsseln die Worte.' },
  orbit: { name: 'ORBIT', mark: '◌', description: 'Bahnen setzen Buchstaben zusammen.' },
  shatter: { name: 'SHATTER', mark: '◇', description: 'Fragmente schließen sich zu Text.' },
  echo: { name: 'ECHO', mark: '◎', description: 'Konturen fallen ineinander.' },
  draw: { name: 'DRAW', mark: '〰', description: 'Eine leichte Handschrift entsteht.' },
  void: { name: 'VOID', mark: '◍', description: 'Worte öffnen sich aus der Dunkelheit.' },
};

function valueLabel(value: number, unit?: string) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${unit ? ` ${unit}` : ''}`;
}

export default function AnimationLab({ engine, params, disabled, onEngineChange, onParamChange }: {
  engine: LivingTypeEngine;
  params: LivingTypeParams;
  disabled: boolean;
  onEngineChange: (engine: LivingTypeEngine) => void;
  onParamChange: (patch: Partial<LivingTypeParams>) => void;
}) {
  return <section className={styles.lab} aria-label="Animation Lab">
    <div className={styles.heading}><div><span className={styles.index}>02 /</span><h2>Animation Lab</h2></div><span>ENGINE FÜR DIESEN ABSCHNITT</span></div>
    <div className={styles.engines} role="group" aria-label="Message Engine wählen">
      {LIVING_TYPE_ENGINES.map((item, index) => <button
        className={styles.engine}
        key={item}
        type="button"
        aria-label={`${ENGINE_DETAILS[item].name} Engine`}
        aria-pressed={engine === item}
        disabled={disabled}
        onClick={() => onEngineChange(item)}
      ><span className={styles.engineTop}><span className={styles.mark} aria-hidden="true">{ENGINE_DETAILS[item].mark}</span><span className={styles.number}>{String(index + 1).padStart(2, '0')}</span></span><strong>{ENGINE_DETAILS[item].name}</strong></button>)}
    </div>
    <p className={styles.description}>{ENGINE_DETAILS[engine].description}</p>
    <div className={styles.controls} role="group" aria-label={`${ENGINE_DETAILS[engine].name} Einstellungen`}>
      {LIVING_TYPE_CONTROLS[engine].map(key => {
        const meta = LIVING_TYPE_PARAM_META[key];
        return <label className={styles.control} key={key}>
          <span><span>{meta.label}</span><output>{valueLabel(params[key], meta.unit)}</output></span>
          <input type="range" aria-label={meta.label} min={meta.min} max={meta.max} step={meta.step} value={params[key]} disabled={disabled} onChange={event => onParamChange({ [key]: Number(event.currentTarget.value) })} />
        </label>;
      })}
    </div>
  </section>;
}
