'use client';
import { useEffect, type RefObject } from 'react';
import type { ParticleEngine } from '@/particles/ParticleEngine';
export function useParticleSurface(engine: ParticleEngine | null, surface: RefObject<HTMLElement | null>, scene: string, suspended = false) {
  useEffect(() => {
    const root = surface.current;
    if (!engine || !root || suspended) return;
    let timer = 0;
    const update = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => engine.formUI(root), 45);
    };
    update();
    const mutation = new MutationObserver(update);
    mutation.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'aria-current', 'open', 'checked', 'data-text'] });
    const resize = new ResizeObserver(() => engine.refresh());
    resize.observe(root);
    for (const event of ['input', 'change', 'focusin', 'focusout', 'pointerover', 'pointerout', 'pointerdown', 'pointerup', 'toggle']) root.addEventListener(event, update, true);
    return () => {
      clearTimeout(timer); mutation.disconnect(); resize.disconnect();
      for (const event of ['input', 'change', 'focusin', 'focusout', 'pointerover', 'pointerout', 'pointerdown', 'pointerup', 'toggle']) root.removeEventListener(event, update, true);
    };
  }, [engine, surface, scene, suspended]);
}
