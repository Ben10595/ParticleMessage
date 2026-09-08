export interface Slide { text: string; duration: number }
export interface MessageContent { version: 1; slides: Slide[] }
export const MAX_SLIDES = 15;
export const MAX_TEXT_LENGTH = 150;
export const MIN_DURATION = 1000;
export const MAX_DURATION = 10000;
export function validateMessage(value: unknown): MessageContent {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('slides' in value) || !Array.isArray(value.slides)) {
    throw new Error('Das Nachrichtenformat ist ungültig.');
  }
  if (value.slides.length < 1 || value.slides.length > MAX_SLIDES) throw new Error('Erstelle zwischen 1 und 15 Abschnitte.');
  const slides = value.slides.map((slide: unknown, index: number) => {
    if (!slide || typeof slide !== 'object' || !('text' in slide) || typeof slide.text !== 'string') throw new Error(`Abschnitt ${index + 1}: Der Text fehlt.`);
    const text = slide.text.trim();
    if (!text) throw new Error(`Abschnitt ${index + 1} ist noch leer.`);
    if (Array.from(slide.text).length > MAX_TEXT_LENGTH) throw new Error(`Abschnitt ${index + 1}: Maximal 150 Zeichen.`);
    if (!('duration' in slide) || typeof slide.duration !== 'number' || !Number.isFinite(slide.duration) || slide.duration < MIN_DURATION || slide.duration > MAX_DURATION) throw new Error(`Abschnitt ${index + 1}: Wähle 1 bis 10 Sekunden.`);
    return { text, duration: Math.round(slide.duration) };
  });
  return { version: 1, slides };
}
