import type { ParticleEngine as OneLineEngine } from '../particles/matter/ParticleEngine';
import { DEFAULT_SETTINGS, slideSettings, type MessageSettings, type Slide } from '../types/message';
import { DEFAULT_FINALE } from '../types/experience';
import { advanceHold } from '../particles/reveal';
import { MOTION_TIMING } from '../particles/matter/motion';
import { LIVING_TRANSITION_MS, livingDuration } from '../particles/matter/livingType';
export type StagePhase = 'puzzle' | 'gift' | 'opening' | 'hold' | 'forming' | 'reading' | 'secret' | 'finale';
export interface PlaybackStage { phase: StagePhase; index: number; text: string; error?: string; secret?: number }
type Wait = (ms: number, signal: AbortSignal) => Promise<void>;
/** The editor preview and shared links use the same abortable scene sequence. */
export class ScenePlayer {
  private stage: PlaybackStage = { phase: 'forming', index: 0, text: '' };
  private action: (() => void) | null = null;
  private nextRequested = false;
  private secretRequested: number | null = null;
  private returnRequested = false;
  private pressed = false;
  private slide: Slide | null = null;
  constructor(private engine: OneLineEngine | null, private wait: Wait, private signal: AbortSignal, private onStage: (stage: PlaybackStage) => void) {}
  private show(phase: StagePhase, text: string, extra: Partial<PlaybackStage> = {}) { this.stage = { phase, text, index: this.stage.index, ...extra }; this.onStage(this.stage); }
  private async gate() {
    if (this.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { this.action = null; this.signal.removeEventListener('abort', abort); };
      const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
      this.action = () => { cleanup(); resolve(); };
      this.signal.addEventListener('abort', abort, { once: true });
    });
  }
  answer(value: string | number) {
    const puzzle = this.slide?.features?.puzzle;
    if (!puzzle || this.stage.phase !== 'puzzle') return;
    if (puzzle.kind === 'choice' ? value === puzzle.correct : String(value).trim() === puzzle.code) this.action?.();
    else { this.engine?.shockwave(.5); this.show('puzzle', puzzle.question, { error: 'Noch nicht ganz. Versuch es noch einmal.' }); }
  }
  openGift() { if (this.stage.phase === 'gift') this.action?.(); }
  setHeld(pressed: boolean) { this.pressed = pressed; this.engine?.setHeld(pressed); }
  next() { if (this.stage.phase === 'reading') this.nextRequested = true; }
  secret(index: number) {
    if (this.stage.phase === 'secret') { this.returnRequested = true; return; }
    if (this.stage.phase === 'reading' && this.slide?.features?.secrets?.[index]) this.secretRequested = index;
  }
  returnFromSecret() { this.returnRequested = true; }
  private async read(slide: Slide) {
    this.nextRequested = false; this.secretRequested = null;
    this.show('reading', slide.text);
    let remaining = slide.duration;
    const secrets = slide.features?.secrets ?? [];
    // Discoverable secrets keep this scene open until Continue, without racing its timer.
    while (remaining > 0 || (secrets.length > 0 && !this.nextRequested)) {
      await this.wait(80, this.signal);
      if (document.hidden) continue;
      remaining -= 80;
      if (this.secretRequested !== null) {
        const index = this.secretRequested, secret = secrets[index]; this.secretRequested = null; this.returnRequested = false;
        this.engine?.revealSecret(secret); this.show('secret', secret.text, { secret: index });
        await this.wait(this.engine?.reducedMotion ? 0 : 700, this.signal);
        let duration = 0;
        while (!this.returnRequested && (!secret.returnAfter || duration < secret.returnAfter)) { await this.wait(80, this.signal); if (!document.hidden) duration += 80; }
        this.engine?.restoreSecret();
        await this.wait(this.engine?.reducedMotion ? 0 : 700, this.signal); this.show('reading', slide.text);
      }
      if (this.nextRequested) break;
    }
  }
  async run(slides: Slide[], settings: MessageSettings = DEFAULT_SETTINGS) {
    this.engine?.configure(settings);
    const stopHold = () => this.setHeld(false);
    window.addEventListener('blur', stopHold); document.addEventListener('visibilitychange', stopHold);
    try {
      for (const [index, slide] of slides.entries()) {
        this.slide = slide; this.stage.index = index;
        const options = slideSettings(slide, settings), features = slide.features;
        const puzzle = features?.puzzle;
        if (puzzle) {
          this.engine?.formText(puzzle.question, { ...options, writing: { ...options.writing, enabled: false }, bounds: () => new DOMRect(innerWidth * .1, (window.visualViewport?.height ?? innerHeight) * .16, innerWidth * .8, (window.visualViewport?.height ?? innerHeight) * .27) });
          this.show('puzzle', puzzle.question); await this.gate();
          this.show('opening', 'Richtig.'); this.engine?.disperseText(.65); await this.wait(this.engine?.reducedMotion ? 0 : 800, this.signal);
        }
        if (features?.gift) {
          this.engine?.formShape('gift'); this.show('gift', 'Ein Geschenk für dich.'); await this.gate();
          this.show('opening', 'Dein Geschenk öffnet sich.'); this.engine?.openGift(features.gift);
          await this.wait(this.engine?.reducedMotion ? 0 : MOTION_TIMING.gift, this.signal);
          this.engine?.disperseText(features.gift === 'burst' ? 1.5 : .7);
          await this.wait(this.engine?.reducedMotion ? 0 : 450, this.signal);
        }
        const formation = this.engine?.formText(slide.text, { ...options, hold: features?.hold, reserveSpace: !!features?.secrets?.length }) ?? 0;
        const livingFormation = slide.engine && !(this.engine?.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
          ? livingDuration(slide.text, options.engine, options.engineParams) + (index > 0 && slides[index - 1].engine ? LIVING_TRANSITION_MS : 0)
          : 0;
        if (features?.hold) {
          this.pressed = false; this.show('hold', 'Halte gedrückt, um deine Nachricht zu enthüllen.');
          let progress = 0;
          while (progress < 1) {
            await this.wait(40, this.signal);
            if (!document.hidden) progress = this.engine ? this.engine.holdProgress : advanceHold(progress, this.pressed, 40);
          }
          this.setHeld(false);
          if (slide.engine) { this.show('forming', slide.text); await this.wait(livingFormation, this.signal); }
        } else { this.show('forming', slide.text); await this.wait(Math.max(formation, livingFormation), this.signal); }
        await this.read(slide);
      }
      if (settings.finale) {
        const finale = settings.finaleConfig ?? DEFAULT_FINALE;
        this.show('finale', '');
        this.engine?.portal(); await this.wait(this.engine?.reducedMotion ? 0 : MOTION_TIMING.portal, this.signal);
        await this.wait(this.engine?.reducedMotion ? 0 : 220, this.signal);
        this.engine?.shockwave(2); this.engine?.disperseText(2.6); await this.wait(this.engine?.reducedMotion ? 0 : 650, this.signal);
        const formation = finale.shape === 'text' ? this.engine?.formText(finale.text ?? 'Für dich.', { ...slideSettings(slides.at(-1)!, settings), writing: { ...settings.writing, enabled: false }, effect: 'spiral' }) : this.engine?.formShape(finale.shape);
        this.show('finale', finale.shape === 'text' ? finale.text ?? 'Für dich.' : { heart: 'Ein Herz für dich.', star: 'Ein Stern für dich.', infinity: 'Für immer.' }[finale.shape]);
        await this.wait((formation ?? 0) + finale.duration, this.signal);
        if (finale.ending === 'float') this.engine?.floatFinale();
        else { this.engine?.disperseText(finale.ending === 'explode' ? 2 : .15); await this.wait(this.engine?.reducedMotion ? 0 : 1200, this.signal); }
      }
    } finally {
      stopHold(); window.removeEventListener('blur', stopHold); document.removeEventListener('visibilitychange', stopHold); this.action = null;
    }
  }
}
