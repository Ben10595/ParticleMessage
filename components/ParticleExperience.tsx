'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ParticleCanvas from './ParticleCanvas';
import ParticleEditor from './ParticleEditor';
import ParticleViewer from './ParticleViewer';
import type { ParticleEngine } from '@/particles/ParticleEngine';
import { loadMessage, saveMessage } from '@/lib/messages';
import { validateMessage, type Slide } from '@/types/message';
type View = 'home' | 'editor' | 'loading' | 'playing' | 'ended' | 'success' | 'error';
const initialSlides: Slide[] = [{ text: '', duration: 2500 }];
export default function ParticleExperience({ slug }: { slug?: string }) {
  const [engine, setEngine] = useState<ParticleEngine | null>(null);
  const [fallback, setFallback] = useState(false);
  const [view, setView] = useState<View>(slug ? 'loading' : 'home');
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
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
  const lastView = useRef<View | null>(null);
  const onError = useCallback(() => setFallback(true), []);
  const wait = useCallback((ms: number, signal: AbortSignal) => engine ? engine.wait(ms, signal) : new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  }), [engine]);
  useEffect(() => () => sequence.current?.abort(), []);
  useEffect(() => {
    if (!engine || transitioning || view === 'playing') return;
    const newView = lastView.current !== view; lastView.current = view;
    const id = window.setTimeout(() => { if (surface.current) engine.formUI(surface.current, newView); }, view === 'home' && newView ? 500 : 0);
    const observer = new ResizeObserver(() => engine.refresh());
    if (surface.current) observer.observe(surface.current);
    return () => { clearTimeout(id); observer.disconnect(); };
  }, [engine, view, slides, active, busy, error, copyStatus, link, transitioning]);
  const transition = useCallback(async (next: View) => {
    if (transitionLock.current) return;
    transitionLock.current = true; setTransitioning(true); sequence.current?.abort();
    const controller = new AbortController(); sequence.current = controller;
    engine?.disperseParticles();
    try { await wait(engine?.reducedMotion ? 100 : 750, controller.signal); if (!controller.signal.aborted) { setView(next); setTransitioning(false); } }
    catch { /* A newer scene owns the particle pool. */ }
    finally { transitionLock.current = false; }
  }, [engine, wait]);
  const play = useCallback(async (items: Slide[]) => {
    sequence.current?.abort(); const controller = new AbortController(); sequence.current = controller;
    transitionLock.current = false; setTransitioning(true); engine?.disperseParticles(); setPlaybackText('');
    try {
      await wait(engine?.reducedMotion ? 100 : 850, controller.signal);
      if (controller.signal.aborted) return;
      setView('playing'); setTransitioning(false);
      for (let index = 0; index < items.length; index++) {
        if (controller.signal.aborted) return;
        setPlaybackIndex(index); setPlaybackText(items[index].text); engine?.formText(items[index].text, !slug);
        await wait((engine?.reducedMotion || !engine ? 100 : 1900) + items[index].duration, controller.signal);
        engine?.disperseParticles(); setPlaybackText('');
        await wait(engine?.reducedMotion ? 250 : 1200, controller.signal);
      }
      if (!controller.signal.aborted) setView('ended');
    } catch { /* Cancelled by back, navigation, or unmount. */ }
  }, [engine, wait, slug]);
  useEffect(() => {
    if (!slug || (!engine && !fallback)) return;
    const controller = new AbortController();
    void loadMessage(slug, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (!data) { setError('Diese Nachricht existiert nicht.'); setRetryable(false); setView('error'); return; }
      setSlides(data.slides); void play(data.slides);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Die Nachricht konnte nicht geladen werden.'); setRetryable(true); setView('error');
    });
    return () => controller.abort();
  }, [slug, engine, fallback, retry, play]);
  useEffect(() => {
    if (view !== 'error' || !engine) return;
    const controller = new AbortController();
    void engine.wait(6000, controller.signal).then(() => { if (surface.current) engine.formUI(surface.current, false, true); }).catch(() => {});
    return () => controller.abort();
  }, [view, engine, error]);
  useEffect(() => {
    if (view !== 'playing' || slug) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') void transition('editor'); };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [view, slug, transition]);
  function preview() {
    try { const content = validateMessage({ version: 1, slides }); setError(''); void play(content.slides); }
    catch (cause) { setError((cause as Error).message); }
  }
  async function save() {
    if (saving.current) return;
    try {
      const content = validateMessage({ version: 1, slides });
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
  return <main className={`experience ${engine && !fallback ? 'canvas-ready' : ''} ${transitioning ? 'transitioning' : ''} ${!engine && !fallback ? 'canvas-pending' : ''}`} ref={surface} onScrollCapture={() => engine?.refresh()}>
    <ParticleCanvas onReady={setEngine} onError={onError} />
    {fallback && <p className="fallback-note" role="status">Canvas ist hier nicht verfügbar. Du kannst die Nachricht trotzdem schreiben, teilen und lesen.</p>}
    {showChrome && <header className="masthead"><span data-particle="text" className="wordmark">PARTICLEMESSAGE</span>{view === 'editor' ? <button data-particle="text" className="back" disabled={busy} onClick={() => void transition('home')}>← Zurück</button> : <span data-particle="text" className="edition">WORTE IN BEWEGUNG</span>}</header>}
    {view === 'home' && <section className="landing"><p data-particle="text" className="eyebrow">EIN PAAR WORTE. NUR FÜR DICH.</p><h1 data-particle="text">Schreib etwas.</h1><p data-particle="text" className="intro">Eine Nachricht. Tausend kleine Punkte.</p><button data-particle="button" className="primary" onClick={() => void transition('editor')}>Nachricht schreiben ↗</button></section>}
    {view === 'editor' && <ParticleEditor slides={slides} active={active} onSelect={setActive} onChange={next => { setSlides(next); setError(''); }} onPreview={preview} onSave={() => void save()} busy={busy} error={error} />}
    {view === 'playing' && <ParticleViewer text={playbackText} preview={!slug} onClose={() => void transition('editor')} current={playbackIndex} total={slides.length} />}
    {view === 'ended' && <section className="landing end"><button data-particle="button" className="primary" onClick={() => void play(slides)}>Nochmal ↺</button>{!slug && <button data-particle="text" onClick={() => void transition('editor')}>← Zurück zum Editor</button>}</section>}
    {view === 'success' && <section className="landing success"><p data-particle="text" className="eyebrow">BEREIT FÜR EINEN BESONDEREN MENSCHEN.</p><h1 data-particle="text">Deine Worte reisen.</h1><p data-particle="text" className="intro">Teile diesen Link mit deinem Menschen.</p><div className="share-link" data-particle="box"><textarea ref={linkInput} data-particle="text" readOnly value={link} aria-label="Link zu deiner Nachricht" onFocus={event => event.target.select()} /></div><button data-particle="button" className="primary copy" onClick={() => void copy()}>{copyStatus}</button><div className="success-actions"><button data-particle="text" onClick={() => void transition('editor')}>← Weiter bearbeiten</button><a data-particle="text" href={link}>Nachricht öffnen ↗</a></div><span className="sr-only" aria-live="polite">{copyStatus}</span></section>}
    {view === 'loading' && <section className="landing"><h1 className="status-title" data-particle="text">Ein Moment.</h1><p className="sr-only" role="status">Nachricht wird geladen.</p></section>}
    {view === 'error' && <section className="landing"><h1 className="status-title" data-particle="text" data-transient>{error}</h1><p className="sr-only" role="alert">{error}</p>{retryable && <button data-particle="button" className="primary" onClick={() => { setView('loading'); setRetry(n => n + 1); }}>Erneut versuchen</button>}<Link className="home-link" data-particle="text" href="/">Eigene Nachricht schreiben ↗</Link></section>}
    {showChrome && <footer><span data-particle="text">PERSÖNLICH. FLÜCHTIG. BESONDERS.</span><span data-particle="text">01 — ∞</span></footer>}
  </main>;
}
