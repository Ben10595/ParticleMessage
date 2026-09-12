'use client';
import type { MessageFont } from '@/types/message';
export default function ParticleViewer({ text, font, preview, onClose, current, total }: { text: string; font: MessageFont; preview: boolean; onClose: () => void; current: number; total: number }) {
  return <section className="viewer" aria-label={preview ? 'Vorschau' : 'Nachricht'}>
    <p className="viewer-text" data-message-font={font} aria-live="polite" aria-atomic="true">{text}</p>
    {preview && <button data-particle="button" data-icon="close" className="preview-close" onClick={onClose} aria-label="Vorschau beenden">×</button>}
    <span className="sr-only">Abschnitt {current + 1} von {total}</span>
  </section>;
}
