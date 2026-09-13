'use client';
import { useEffect, type RefObject } from 'react';
import type { ParticleEngine } from '@/particles/matter/ParticleEngine';
export function useParticleSurface(engine: ParticleEngine | null, surface: RefObject<HTMLElement | null>, scene: string, suspended = false) {
  useEffect(() => {
    const root = surface.current;
    if (!engine || !root || suspended) return;
    let timer = 0;
    const update = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => engine.formUI(root), 45);
    };
    timer = window.setTimeout(() => engine.formUI(root), scene === 'home' || scene === 'password' ? 450 : 45);
    const mutation = new MutationObserver(update);
    mutation.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'aria-current', 'open', 'checked', 'data-text', 'aria-expanded', 'aria-selected', 'aria-hidden'] });
    const resize = new ResizeObserver(() => engine.refresh());
    resize.observe(root);
    let lastHovered: HTMLElement | null = null;
    const onPointerOver = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !engine) return;
      const interactive = target.closest<HTMLElement>(
        '[data-particle="button"], [data-particle="control"], button, select, summary, .slide-tabs button, .emoji-picker button, .particle-select, .add-slide'
      );
      if (interactive && interactive !== lastHovered) {
        lastHovered = interactive;
        const rect = interactive.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) engine.triggerHoverSparks(rect);
      }
    };
    const onPointerOut = (event: PointerEvent) => {
      if (lastHovered && !lastHovered.contains(event.relatedTarget as Node | null)) {
        lastHovered = null;
      }
    };
    for (const event of ['input', 'change', 'focusin', 'focusout', 'pointerover', 'pointerout', 'pointerdown', 'pointerup', 'toggle']) root.addEventListener(event, update, true);
    root.addEventListener('pointerover', onPointerOver as EventListener, true);
    root.addEventListener('pointerout', onPointerOut as EventListener, true);
    return () => {
      clearTimeout(timer); mutation.disconnect(); resize.disconnect();
      for (const event of ['input', 'change', 'focusin', 'focusout', 'pointerover', 'pointerout', 'pointerdown', 'pointerup', 'toggle']) root.removeEventListener(event, update, true);
      root.removeEventListener('pointerover', onPointerOver as EventListener, true);
      root.removeEventListener('pointerout', onPointerOut as EventListener, true);
    };
  }, [engine, surface, scene, suspended]);
}
