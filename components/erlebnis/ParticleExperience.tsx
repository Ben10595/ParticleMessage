'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import ParticleCanvas from '../partikel/ParticleCanvas';
import ParticleEditor from '../editor/ParticleEditor';
import { ScenePlayer, type PlaybackStage } from '@/lib/ScenePlayer';
import DeviceTilt from './DeviceTilt';
import SceneControls from './SceneControls';
import ParticleViewer from './ParticleViewer';
import PasswordGate from './PasswordGate';
import Branding from '../ui/Branding';
import MessageCore, { type MessageCoreMode } from '../ui/MessageCore';
import DesignSwitcher from '../ui/DesignSwitcher';
import { useContentSelection } from '../hooks/useContentSelection';
import type { ParticleEngine } from '@/particles/matter/ParticleEngine';
import { loadMessage, saveMessage, MessageExpiredError } from '@/lib/messages';
import { DEFAULT_SETTINGS, slideSettings, validateMessage, type Slide, type MessageSettings } from '@/types/message';
import { DEFAULT_DESIGN_PREFERENCES, nextDesignMode, normalizeDesignPreferences, type DesignMode, type DesignPreferences } from '@/lib/designModes';

type View = 'password' | 'home' | 'editor' | 'loading' | 'playing' | 'ended' | 'success' | 'error';
type SendPhase = 'idle' | 'charging' | 'dispatching' | 'sent';
const initialSlides: Slide[] = [{ text: '', duration: 2500 }];
const designStorageKey = 'particle-message-design-v1';

export default function ParticleExperience({ slug, authenticated = false }: { slug?: string; authenticated?: boolean }) {
  useContentSelection();
  const [engine, setEngine] = useState<ParticleEngine | null>(null);
  const [fallback, setFallback] = useState(false);
  const [view, setView] = useState<View>(slug ? 'loading' : authenticated ? 'home' : 'password');
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [settings, setSettings] = useState<MessageSettings>(DEFAULT_SETTINGS);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [sendPhase, setSendPhase] = useState<SendPhase>('idle');
  const [coreActivity, setCoreActivity] = useState(0);
  const [designMode, setDesignMode] = useState<DesignMode>('core');
  const [designPreferences, setDesignPreferences] = useState<DesignPreferences>(DEFAULT_DESIGN_PREFERENCES);
  const [designHydrated, setDesignHydrated] = useState(false);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [retry, setRetry] = useState(0);
  const [link, setLink] = useState('');
  const [copyStatus, setCopyStatus] = useState('Link kopieren');
  const [playbackText, setPlaybackText] = useState('');
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSlides, setPlaybackSlides] = useState<Slide[]>(initialSlides);
  const [stage, setStage] = useState<PlaybackStage>({ phase: 'forming', index: 0, text: '' });
  const [player, setPlayer] = useState<ScenePlayer | null>(null);
  const surface = useRef<HTMLElement>(null);
  const linkInput = useRef<HTMLTextAreaElement>(null);
  const sequence = useRef<AbortController | null>(null);
  const transitionLock = useRef(false);
  const saving = useRef(false);
  const autoMode = useRef(false);
  const onError = useCallback(() => setFallback(true), []);
  const wait = useCallback((ms: number, signal: AbortSignal) => engine ? engine.wait(ms, signal) : new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  }), [engine]);

  useEffect(() => () => sequence.current?.abort(), []);
  useEffect(() => { autoMode.current = designPreferences.automatic; }, [designPreferences.automatic]);
  useEffect(() => { engine?.configure(settings); }, [engine, settings]);
  useEffect(() => { engine?.setMotionPreference(designPreferences.reducedMotion); }, [engine, designPreferences.reducedMotion]);
  useEffect(() => { engine?.setParticlesEnabled(slug ? true : designPreferences.particles); }, [engine, slug, designPreferences.particles]);

  useEffect(() => {
    let cancelled = false;
    let preferences = DEFAULT_DESIGN_PREFERENCES;
    let mode: DesignMode = DEFAULT_DESIGN_PREFERENCES.defaultMode;
    try {
      const stored = localStorage.getItem(designStorageKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        preferences = normalizeDesignPreferences(parsed);
        const activeMode = parsed && typeof parsed === 'object' && 'mode' in parsed && typeof parsed.mode === 'string'
          ? parsed.mode : preferences.defaultMode;
        mode = ['particle', 'core', 'liquid', 'console', 'minimal'].includes(activeMode) ? activeMode as DesignMode : preferences.defaultMode;
      }
    } catch { /* Invalid or unavailable local storage falls back to defaults. */ }
    queueMicrotask(() => {
      if (cancelled) return;
      setDesignPreferences(preferences);
      setDesignMode(mode);
      setDesignHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!designHydrated) return;
    try { localStorage.setItem(designStorageKey, JSON.stringify({ ...designPreferences, mode: designMode })); }
    catch { /* Private browsing or a full storage quota should not block message creation. */ }
  }, [designHydrated, designMode, designPreferences]);

  const transition = useCallback(async (next: View) => {
    if (transitionLock.current) return;
    transitionLock.current = true;
    setTransitioning(true);
    sequence.current?.abort();
    const controller = new AbortController();
    sequence.current = controller;
    try {
      const reduced = designPreferences.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      await wait(reduced ? 0 : 280, controller.signal);
      if (!controller.signal.aborted) {
        if (designPreferences.automatic && next !== view && ['home', 'editor', 'success'].includes(next)) {
          setDesignMode(current => nextDesignMode(current));
        }
        setView(next);
        setTransitioning(false);
      }
    } catch { /* A newer screen transition owns the surface. */ }
    finally { transitionLock.current = false; }
  }, [designPreferences.automatic, designPreferences.reducedMotion, view, wait]);

  const unlock = useCallback(() => { void transition('home'); }, [transition]);
  const play = useCallback(async (items: Slide[], options: MessageSettings = DEFAULT_SETTINGS) => {
    sequence.current?.abort();
    const controller = new AbortController();
    sequence.current = controller;
    transitionLock.current = true;
    setTransitioning(true);
    setPlaybackText('');
    try {
      await wait(engine?.reducedMotion ? 0 : 280, controller.signal);
      setPlaybackSlides(items);
      setView('playing');
      setTransitioning(false);
      transitionLock.current = false;
      const session = new ScenePlayer(engine, wait, controller.signal, next => {
        setStage(next);
        setPlaybackIndex(next.index);
        setPlaybackText(next.text);
      });
      setPlayer(session);
      await session.run(items, options);
      const floating = options.finale && (options.finaleConfig?.ending ?? 'float') === 'float';
      if (!floating || !slug) engine?.disperseParticles(.4);
      setPlaybackText('');
      if (!floating || !slug) {
        setTransitioning(true);
        await wait(engine?.reducedMotion ? 0 : 700, controller.signal);
      }
      if (!controller.signal.aborted) {
        if (!slug && autoMode.current) setDesignMode(current => nextDesignMode(current));
        setView(slug ? 'ended' : 'editor');
        setTransitioning(false);
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      console.error('Message presentation failed', cause);
      setError('Die Darstellung konnte nicht aufgebaut werden. Bitte lade die Nachricht erneut.');
      setTransitioning(false);
      transitionLock.current = false;
      setView('error');
    }
  }, [engine, wait, slug]);

  useEffect(() => {
    if (!slug || (!engine && !fallback)) return;
    const controller = new AbortController();
    void loadMessage(slug, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (!data) {
        setError('Diese Nachricht existiert nicht.');
        setRetryable(false);
        setView('error');
        return;
      }
      setSlides(data.slides);
      setSettings(data.settings ?? DEFAULT_SETTINGS);
      setExpiresAt(data.expiresAt);
      void play(data.slides, data.settings);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Die Nachricht konnte nicht geladen werden.');
      setRetryable(!(cause instanceof MessageExpiredError));
      setView('error');
    });
    return () => controller.abort();
  }, [slug, engine, fallback, retry, play]);

  useEffect(() => {
    if (!expiresAt) return;
    const expire = () => {
      if (Date.now() < expiresAt) return;
      sequence.current?.abort();
      engine?.disperseParticles();
      setError('Dieser Link ist abgelaufen.');
      setRetryable(false);
      setTransitioning(false);
      setView('error');
    };
    const timer = window.setTimeout(expire, Math.max(0, expiresAt - Date.now()));
    document.addEventListener('visibilitychange', expire);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', expire); };
  }, [expiresAt, engine]);

  useEffect(() => {
    if (view !== 'playing' || slug) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') void transition('editor'); };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [view, slug, transition]);

  function preview() {
    try {
      const content = validateMessage({ version: 1, slides, settings });
      setError('');
      void play(content.slides, content.settings);
    } catch (cause) { setError((cause as Error).message); }
  }

  async function save() {
    if (saving.current) return;
    try {
      const content = validateMessage({ version: 1, slides, settings });
      saving.current = true;
      setBusy(true);
      setError('');
      setSendPhase('charging');
      const result = await saveMessage(content);
      setLink(`${window.location.origin}/m/${result}`);
      setCopyStatus('Link kopieren');
      setSendPhase('dispatching');
      await transition('success');
      setSendPhase('sent');
    } catch (cause) {
      setSendPhase('idle');
      setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(link);
      setCopyStatus('Kopiert ✓');
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setCopyStatus('Link markiert — bitte kopieren');
    }
  }

  const showChrome = !slug && view !== 'playing' && view !== 'ended';
  const draftCharacters = slides.reduce((total, slide) => total + Array.from(slide.text).length, 0);
  const profile = designPreferences.profiles[designMode];
  const designStyle = {
    '--design-intensity': profile.intensity / 100,
    '--design-glow': profile.glow / 100,
    '--design-glow-soft': profile.glow / 100 * .16,
    '--design-glow-primary': profile.glow / 100 * .35,
    '--design-glow-inset': profile.glow / 100 * .1,
    '--design-glow-outer': profile.glow / 100 * .14,
    '--design-transition-duration': `${Math.round(1300 - profile.speed * 6)}ms`,
    '--draft-signal-strength': `${Math.max(12, Math.min(100, Math.round(draftCharacters / 4)))}%`,
  } as CSSProperties;
  const coreMode: MessageCoreMode = sendPhase === 'charging' ? 'charging'
    : sendPhase === 'dispatching' ? 'dispatching'
      : view === 'success' || sendPhase === 'sent' ? 'sent'
        : view === 'editor' ? 'listening'
          : view === 'password' ? 'locked'
            : view === 'error' ? 'error'
              : view === 'home' ? 'resting' : 'open';

  return (
    <main
      data-scene={view}
      data-design-mode={designMode}
      data-background-effects={designPreferences.backgroundEffects}
      data-particles-enabled={slug ? true : designPreferences.particles}
      data-reduced-motion={designPreferences.reducedMotion}
      data-focus-mode={designPreferences.focusMode}
      data-send-phase={sendPhase}
      style={designStyle}
      className={`experience ${engine && !fallback ? 'canvas-ready' : ''} ${transitioning ? 'transitioning' : ''} ${!engine && !fallback ? 'canvas-pending' : ''}`}
      ref={surface}
      aria-busy={transitioning || busy}
      onKeyDownCapture={event => { if (transitioning) event.preventDefault(); }}
    >
      <div className={`ambient-field ambient-${designMode}`} aria-hidden="true"><i /><i /><i /><i /></div>
      <ParticleCanvas onReady={setEngine} onError={onError} />
      {!slug && view !== 'playing' && view !== 'ended' && (
        <div className="core-presence">
          <MessageCore activity={coreActivity} mode={coreMode} label={coreMode === 'sent' ? 'Nachricht erfolgreich gesendet' : coreMode === 'locked' ? 'Geschützter Message Core' : 'Aktiver Message Core'} />
        </div>
      )}
      {fallback && view === 'editor' && <p className="fallback-note" role="status">Die animierte Vorschau ist hier nicht verfügbar. Du kannst die Nachricht trotzdem schreiben, teilen und lesen.</p>}

      {showChrome && (
        <header className="masthead">
          <button className="wordmark" aria-label="Zur Startseite" disabled={view === 'home' || view === 'password' || busy} onClick={() => void transition('home')}>
            <span className="brand-glyph" aria-hidden="true"><i /><i /></span>
            <span>Particle <b>Message</b></span>
          </button>
          <div className="system-state" aria-hidden="true"><i /> {view === 'editor' ? 'Composer aktiv' : view === 'success' ? 'Übertragung komplett' : 'System bereit'}</div>
          {view === 'editor' ? <button className="back" disabled={busy} onClick={() => void transition('home')}><span aria-hidden="true">←</span> Start</button> : <span className="edition">PRIVATE MESSAGE SYSTEM / 01</span>}
        </header>
      )}

      {!slug && ['password', 'home', 'editor', 'success', 'error'].includes(view) && (
        <DesignSwitcher
          mode={designMode}
          preferences={designPreferences}
          draftCharacters={view === 'editor' ? draftCharacters : 0}
          onModeChange={setDesignMode}
          onPreferencesChange={setDesignPreferences}
        />
      )}

      {view === 'password' && <PasswordGate onUnlock={unlock} />}

      {view === 'home' && (
        <section className="landing home-landing">
          <div className="hero-copy">
            <p className="eyebrow"><span className="signal-mark" aria-hidden="true" /> MESSAGE CORE / BEREIT</p>
            <h1>Was möchtest<br />du sagen?</h1>
            <p className="landing-description">Erstelle eine persönliche Nachricht und teile einen Moment, der sich nicht wie eine gewöhnliche Nachricht anfühlt.</p>
            <div className="landing-actions">
              <button className="primary" aria-label="Nachricht erstellen" onClick={() => void transition('editor')}><span>Nachricht erstellen</span><i aria-hidden="true">↗</i></button>
              <button className="text-action" onClick={() => void play([{ text: 'Hey, du.', duration: 1700, effect: 'dust' }, { text: 'Schön, dass es dich gibt.', duration: 2500, effect: 'magnet', features: { hold: true, gift: 'ribbon' } }], { ...DEFAULT_SETTINGS, finale: true, finaleConfig: { shape: 'heart', ending: 'float', duration: 2500 } })}>Erlebnis ansehen <span aria-hidden="true">▶</span></button>
            </div>
            <p className="privacy-note"><span aria-hidden="true">⌁</span> Persönlich erstellt · als Link geteilt · 3 Tage verfügbar</p>
          </div>
          <div className="core-callout" aria-hidden="true"><span>LIVE CORE</span><i /><p>REAGIERT AUF<br />DEINE EINGABE</p></div>
        </section>
      )}

      {view === 'editor' && (
        <ParticleEditor
          previewActive={!transitioning}
          particlesEnabled={designPreferences.particles}
          engine={engine}
          settings={settings}
          onSettingsChange={setSettings}
          slides={slides}
          active={active}
          onSelect={setActive}
          onChange={next => { setSlides(next); setError(''); }}
          onActivity={() => setCoreActivity(value => value + 1)}
          onPreview={preview}
          onSave={() => void save()}
          busy={busy}
          error={error}
        />
      )}

      {view === 'playing' && <><ParticleViewer text={playbackText} font={slideSettings(playbackSlides[playbackIndex] ?? playbackSlides[0], settings).font} preview={!slug} onClose={() => void transition('editor')} current={playbackIndex} total={playbackSlides.length} /><SceneControls key={playbackIndex} engine={engine} player={player} stage={stage} slide={playbackSlides[playbackIndex] ?? playbackSlides[0]} /><DeviceTilt engine={engine} enabled={playbackSlides[playbackIndex]?.features?.tilt ?? settings.tilt ?? false} /></>}

      {view === 'ended' && <section className={`landing end ${settings.finale && (settings.finaleConfig?.ending ?? 'float') === 'float' ? 'floating-end' : ''}`}><button className="primary" onClick={() => void play(slides, settings)}>Nochmal ↺</button>{!slug && <button onClick={() => void transition('editor')}>← Zurück zum Editor</button>}</section>}

      {view === 'success' && (
        <section className="landing success">
          <div className="success-copy">
            <p className="eyebrow"><span className="success-check" aria-hidden="true">✓</span> ÜBERTRAGUNG ABGESCHLOSSEN</p>
            <h1>Deine Nachricht<br />ist unterwegs.</h1>
            <p className="intro">Der Link ist bereit. Teile ihn mit deinem Menschen – er bleibt 3 Tage lang gültig.</p>
            <div className="share-link">
              <span className="link-label">DEIN PRIVATER LINK</span>
              <textarea ref={linkInput} readOnly value={link} aria-label="Link zu deiner Nachricht" onFocus={event => event.target.select()} />
              <button className="copy-icon" aria-label={copyStatus === 'Kopiert ✓' ? 'Link wurde kopiert' : 'Link über Symbol kopieren'} onClick={() => void copy()}>{copyStatus === 'Kopiert ✓' ? '✓' : '⧉'}</button>
            </div>
            <button className="primary copy" onClick={() => void copy()}>{copyStatus}</button>
            <div className="success-actions"><button onClick={() => { setSendPhase('idle'); void transition('editor'); }}>← Weiter bearbeiten</button><a href={link}>Nachricht öffnen ↗</a></div>
            <span className="sr-only" aria-live="polite">{copyStatus}</span>
          </div>
        </section>
      )}

      {view === 'loading' && <section className="landing loading-screen"><p role="status"><span className="loading-line" aria-hidden="true" /> Nachricht wird geladen.</p></section>}
      {view === 'error' && <section className="landing error-screen"><p className="eyebrow">SYSTEMHINWEIS</p><h1 className="status-title">{error}</h1><p className="sr-only" role="alert">{error}</p>{retryable && <button className="primary" onClick={() => { setView('loading'); setRetry(value => value + 1); }}>Erneut versuchen</button>}<Link className="home-link" href="/">Eigene Nachricht schreiben ↗</Link></section>}
      <Branding />
    </main>
  );
}
