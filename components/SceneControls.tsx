'use client';
import { useEffect, useRef, useState } from 'react';
import type { ScenePlayer, PlaybackStage } from '@/lib/ScenePlayer';
import type { OneLineEngine } from '@/lines/OneLineEngine';
import type { Slide } from '@/types/message';
import type { SecretBounds } from '@/particles/SceneParticles';
export default function SceneControls({ player, stage, slide, engine }: { player: ScenePlayer | null; stage: PlaybackStage; slide: Slide; engine: OneLineEngine | null }) {
  const [code, setCode] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<SecretBounds[]>([]);
  const firstControl = useRef<HTMLButtonElement | null>(null);
  const secrets = slide.features?.secrets;
  useEffect(() => {
    const resize = () => { root.current?.style.setProperty('--scene-height', `${window.visualViewport?.height ?? innerHeight}px`); engine?.refresh(); };
    resize(); window.visualViewport?.addEventListener('resize', resize);
    return () => window.visualViewport?.removeEventListener('resize', resize);
  }, [engine]);
  useEffect(() => {
    let frame = 0;
    const refresh = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setBounds(engine?.getSecretBounds(secrets ?? []) ?? [])); }); };
    refresh(); window.addEventListener('resize', refresh);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', refresh); };
  }, [engine, secrets, stage.phase]);
  useEffect(() => { firstControl.current?.focus({ preventScroll: true }); }, [stage.phase]);
  const puzzle = slide.features?.puzzle;
  return <div ref={root} data-stage={stage.phase} className="scene-controls">
    {stage.phase === 'puzzle' && puzzle && <div className="puzzle-controls">
      <p className="scene-eyebrow">EIN KLEINES GEHEIMNIS ZUERST</p>
      {puzzle.kind === 'choice' ? <div className="puzzle-answers">{puzzle.answers.map((answer, i) => <button ref={i === 0 ? firstControl : undefined} data-particle="button" key={i} onClick={() => player?.answer(i)}><span className="answer-index">{String(i + 1).padStart(2, '0')}</span>{answer}</button>)}</div> : <form onSubmit={event => { event.preventDefault(); player?.answer(code); }} className="code-form"><label htmlFor="puzzle-code">Dein Zahlencode</label><div data-particle="frame" className="code-input"><input id="puzzle-code" inputMode="numeric" autoComplete="off" maxLength={8} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></div><button data-particle="button" type="submit">Nachricht öffnen</button></form>}
      <p role="status" className="puzzle-feedback">{stage.error ?? 'Die richtige Antwort öffnet deine Nachricht.'}</p>
    </div>}
    {stage.phase === 'gift' && <><button ref={firstControl} className="gift-hit" aria-label="Geschenk öffnen" onClick={() => player?.openGift()}><span className={engine ? 'sr-only' : ''}>Geschenk öffnen</span></button><p className="scene-hint">Ein kleiner Moment. Nur für dich.<br /><span>Tippe auf das Geschenk.</span></p></>}
    {stage.phase === 'hold' && <><button ref={firstControl} className="hold-hit" aria-label="Gedrückt halten zum Enthüllen" onContextMenu={event => event.preventDefault()} onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); player?.setHeld(true); }} onPointerUp={() => player?.setHeld(false)} onPointerCancel={() => player?.setHeld(false)} onLostPointerCapture={() => player?.setHeld(false)} onBlur={() => player?.setHeld(false)} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); player?.setHeld(true); } }} onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); player?.setHeld(false); } }}><span className="sr-only">Gedrückt halten. Auch mit Leertaste oder Enter.</span></button><p className="scene-hint">Halte diesen Moment fest.<br /><span>Bildschirm, Maustaste oder Leertaste gedrückt halten.</span></p></>}
    {stage.phase === 'reading' && !!secrets?.length && <>
      {engine ? bounds.map((box, i) => <button className="secret-hit" key={i} style={{ left: box.x, top: box.y, width: box.width, height: box.height }} aria-label={`Geheimnis in „${slide.text.slice(secrets[box.secret].start, secrets[box.secret].end)}“ öffnen`} onClick={() => player?.secret(box.secret)} />) : <div className="fallback-secrets">{secrets.map((secret, i) => <button key={i} onClick={() => player?.secret(i)}>{slide.text.slice(secret.start, secret.end)} · Geheimnis öffnen</button>)}</div>}
      <div className="scene-hint"><p>In den markierten Worten steckt noch mehr.</p><button data-particle="button" onClick={() => player?.next()}>Weiter →</button></div>
    </>}
    {stage.phase === 'secret' && <div className="scene-hint secret-return"><button ref={firstControl} data-particle="button" onClick={() => player?.returnFromSecret()}>Zur Nachricht zurück ↩</button>{secrets?.[stage.secret ?? 0]?.returnAfter ? <p>Kehrt gleich von selbst zurück.</p> : null}</div>}
  </div>;
}
