'use client';
import { useEffect, useState } from 'react';
/** Keep the existing popup in the DOM while its contour winds back into the trigger. */
export function useLinePresence(open: boolean, duration = 240) {
  const [retained, setRetained] = useState(false);
  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => setRetained(true));
      return () => cancelAnimationFrame(frame);
    }
    const timer = window.setTimeout(() => setRetained(false), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration);
    return () => clearTimeout(timer);
  }, [open, duration]);
  return open || retained;
}
