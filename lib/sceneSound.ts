import type { MessageMood } from '@/types/message';
import type { StagePhase } from './ScenePlayer';

/** A brief, quiet tone made locally in the browser; no audio asset or network request. */
export function playSceneTone(context: AudioContext, phase: StagePhase, mood: MessageMood = 'calm') {
  if (context.state !== 'running' || !['forming', 'reading', 'finale', 'opening'].includes(phase)) return;
  const base = mood === 'energy' || mood === 'chaos' ? 220 : mood === 'digital' ? 330 : mood === 'dream' || mood === 'memory' ? 262 : 294;
  const note = phase === 'finale' ? base * 1.5 : phase === 'reading' ? base * 1.25 : base;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = mood === 'digital' ? 'triangle' : 'sine';
  oscillator.frequency.setValueAtTime(note, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(note * .98, context.currentTime + .45);
  gain.gain.setValueAtTime(.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.025, context.currentTime + .04);
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .55);
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.start(); oscillator.stop(context.currentTime + .56);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
