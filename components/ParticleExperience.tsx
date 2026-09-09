'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ParticleCanvas from './ParticleCanvas';
import ParticleEditor from './ParticleEditor';
import ParticleViewer from './ParticleViewer';
import Branding from './Branding';
import { useParticleSurface } from './useParticleSurface';
import type { ParticleEngine } from '@/particles/ParticleEngine';
import { loadMessage, saveMessage, MessageExpiredError } from '@/lib/messages';
import { DEFAULT_SETTINGS, validateMessage, type Slide, type MessageSettings } from '@/types/message';
type View = 'home' | 'editor' | 'loading' | 'playing' | 'ended' | 'success' | 'error';
const initialSlides: Slide[] = [{ text: '', duration: 2500 }];
export default function ParticleExperience({ slug }: { slug?: string }) {
  const [engine, setEngine] = useState<ParticleEngine | null>(null);
  const [fallback, setFallback] = useState(false);
  const [view, setView] = useState<View>(slug ? 'loading' : 'home');
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [settings, setSettings] = useState<MessageSettings>(DEFAULT_SETTINGS);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [retry, setRetry] = useState(0);
  const [link, setLink] = useState('');
  const [copyStatus, setCopyStatus] = useState('Link kopieren');
  const [playbackText, setPlaybackText] = useState('');
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const surface = useRef<HTMLElement>(null);
  const linkInput = useRef<HTMLTextAreaElement>(null);
  const sequence = useRef<AbortController | null>(null);
  const transitionLock = useRef(false);
  const saving = useRef(false);
  const onError = useCallback(() => setFallback(true), []);
  const wait = useCallback((ms: number, signal: AbortSignal) => engine ? engine.wait(ms, signal) : new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  }), [engine]);
  useEffect(() => () => sequence.current?.abort(), []);
  useParticleSurface(engine, surface, view, transitioning);
  const transition = useCallback(async (next: View) => {
    if (transitionLock.current) return;
    transitionLock.current = true; setTransitioning(true); sequence.current?.abort();
    const controller = new AbortController(); sequence.current = controller;
    engine?.disperseParticles();
    try { await wait(engine?.reducedMotion ? 100 : 750, controller.signal); if (!controller.signal.aborted) { setView(next); setTransitioning(false); } }
    catch { /* A newer scene owns the particle pool. */ }
    finally { transitionLock.current = false; }
  }, [engine, wait]);
  const play = useCallback(async (items: Slide[], options: MessageSettings = DEFAULT_SETTINGS) => {
    sequence.current?.abort(); const controller = new AbortController(); sequence.current = controller;
    transitionLock.current = false; setTransitioning(false); setPlaybackText(''); setView('playing');
    try {
      for (let index = 0; index < items.length; index++) {
        if (controller.signal.aborted) return;
        const finale = options.finale && index === items.length - 1;
        if (finale || (options.writing.enabled && index > 0)) {
          engine?.disperseParticles(finale ? 3 : 1); setPlaybackText('');
          await wait(engine?.reducedMotion ? 0 : finale ? 650 : 450, controller.signal);
        }
        setPlaybackIndex(index); setPlaybackText(items[index].text);
        const formation = engine?.formText(items[index].text, { writing: options.writing, effect: items[index].effect ?? options.effect, finale }) ?? 0;
        await wait(formation + items[index].duration, controller.signal);
      }
      engine?.disperseParticles();
      if (!controller.signal.aborted) setView('ended');
    } catch { /* Cancelled by back, expiry, navigation, or unmount. */ }
  }, [engine, wait]);
  useEffect(() => {
    if (!slug || (!engine && !fallback)) return;
    const controller = new AbortController();
    void loadMessage(slug, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (!data) { setError('Dieser Link ist abgelaufen.'); setRetryable(false); setView('error'); return; }
      setSlides(data.slides); setSettings(data.settings ?? DEFAULT_SETTINGS); setExpiresAt(data.expiresAt); void play(data.slides, data.settings);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Die Nachricht konnte nicht geladen werden.'); setRetryable(!(cause instanceof MessageExpiredError)); setView('error');
    });
    return () => controller.abort();
  }, [slug, engine, fallback, retry, play]);
  useEffect(() => {
    if (!expiresAt) return;
    const expire = () => {
      if (Date.now() < expiresAt) return;
      sequence.current?.abort(); engine?.disperseParticles();
      setError('Dieser Link ist abgelaufen.'); setRetryable(false); setTransitioning(false); setView('error');
    };
    const timer = window.setTimeout(expire, Math.max(0, expiresAt - Date.now()));
    document.addEventListener('visibilitychange', expire);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', expire); };
  }, [expiresAt, engine]);
  useEffect(() => {
    if (view !== 'playing' || slug) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') void transition('editor'); };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [view, slug, transition]);
  function preview() {
    try { const content = validateMessage({ version: 1, slides, settings }); setError(''); void play(content.slides, content.settings); }
    catch (cause) { setError((cause as Error).message); }
  }
  async function save() {
    if (saving.current) return;
    try {
      const content = validateMessage({ version: 1, slides, settings });
      saving.current = true; setBusy(true); setError('');
      const result = await saveMessage(content);
      setLink(`${window.location.origin}/p/${result}`); setCopyStatus('Link kopieren'); await transition('success');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen. Bitte versuche es erneut.'); }
    finally { saving.current = false; setBusy(false); }
  }
  async function copy() {
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(link); setCopyStatus('Kopiert ✓'); }
    catch { linkInput.current?.focus(); linkInput.current?.select(); setCopyStatus('Link markiert — bitte kopieren'); }
  }
  const showChrome = view !== 'playing' && view !== 'ended';
  return <main className={`experience ${engine && !fallback ? 'canvas-ready' : ''} ${transitioning ? 'transitioning' : ''} ${!engine && !fallback ? 'canvas-pending' : ''}`} ref={surface}>
    <ParticleCanvas onReady={setEngine} onError={onError} />
    {fallback && <p className="fallback-note" role="status">Canvas ist hier nicht verfügbar. Du kannst die Nachricht trotzdem schreiben, teilen und lesen.</p>}
    {showChrome && <header className="masthead"><span data-particle="text" className="wordmark">PARTICLEMESSAGE</span>{view === 'editor' ? <button data-particle="button" className="back" disabled={busy} onClick={() => void transition('home')}>← Zurück</button> : <span className="edition">WORTE IN BEWEGUNG</span>}</header>}
    {view === 'home' && <section className="landing"><p className="eyebrow">EIN PAAR WORTE. NUR FÜR DICH.</p><h1 data-particle="hero">Schreib etwas.</h1><p data-particle="text" className="intro">Worte, die bleiben. Auch wenn die Punkte weiterziehen.</p><button data-particle="button" className="primary" onClick={() => void transition('editor')}>Nachricht schreiben ↗</button></section>}
    {view === 'editor' && <ParticleEditor previewActive={!transitioning} engine={engine} settings={settings} onSettings={setSettings} slides={slides} active={active} onSelect={setActive} onChange={next => { setSlides(next); setError(''); }} onPreview={preview} onSave={() => void save()} busy={busy} error={error} />}
    {view === 'playing' && <ParticleViewer text={playbackText} preview={!slug} onClose={() => void transition('editor')} current={playbackIndex} total={slides.length} />}
    {view === 'ended' && <section className="landing end"><button data-particle="button" className="primary" onClick={() => void play(slides, settings)}>Nochmal ↺</button>{!slug && <button data-particle="button" onClick={() => void transition('editor')}>← Zurück zum Editor</button>}</section>}
    {view === 'success' && <section className="landing success"><p className="eyebrow">BEREIT FÜR EINEN BESONDEREN MENSCHEN.</p><h1 data-particle="hero">Deine Worte reisen.</h1><p data-particle="text" className="intro">Teile diesen Link mit deinem Menschen. Er ist 3 Tage gültig.</p><div data-particle="frame" className="share-link"><textarea ref={linkInput} readOnly value={link} aria-label="Link zu deiner Nachricht" onFocus={event => event.target.select()} /></div><button data-particle="button" className="primary copy" onClick={() => void copy()}>{copyStatus}</button><div className="success-actions"><button data-particle="button" onClick={() => void transition('editor')}>← Weiter bearbeiten</button><a data-particle="button" href={link}>Nachricht öffnen ↗</a></div><span className="sr-only" aria-live="polite">{copyStatus}</span></section>}
    {view === 'loading' && <section className="landing"><h1 data-particle="hero" className="status-title">Ein Moment.</h1><p className="sr-only" role="status">Nachricht wird geladen.</p></section>}
    {view === 'error' && <section className="landing"><h1 data-particle="hero" className="status-title">{error}</h1><p className="sr-only" role="alert">{error}</p>{retryable && <button data-particle="button" className="primary" onClick={() => { setView('loading'); setRetry(n => n + 1); }}>Erneut versuchen</button>}<Link data-particle="button" className="home-link" href="/">Eigene Nachricht schreiben ↗</Link></section>}
    {showChrome && <footer><span>PERSÖNLICH. FLÜCHTIG. BESONDERS.</span><span>WORTE IN BEWEGUNG</span></footer>}
    <Branding />
  </main>;
}
