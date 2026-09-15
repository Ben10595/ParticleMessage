'use client';
import { useEffect } from 'react';

/** Suppress accidental page selection while keeping editing, secrets and link copying usable. */
export function useContentSelection() {
  useEffect(() => {
    const editable = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea, [contenteditable="true"]');
    const prevent = (event: Event) => { if (!editable(event.target)) event.preventDefault(); };
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && !editable(event.target)) event.preventDefault();
    };
    const controller = new AbortController();
    for (const type of ['selectstart', 'copy', 'cut', 'dragstart']) document.addEventListener(type, prevent, { signal: controller.signal });
    document.addEventListener('keydown', key, { signal: controller.signal });
    return () => controller.abort();
  }, []);
}
