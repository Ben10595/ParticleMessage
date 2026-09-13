export const GIFT_STYLES = ['ribbon', 'burst', 'orbit'] as const;
export type GiftStyle = typeof GIFT_STYLES[number];
export const GIFT_LABELS: Record<GiftStyle, string> = { ribbon: 'Schleife & Licht', burst: 'Sternenstaub', orbit: 'Umlaufende Punkte' };
export type Puzzle = { kind: 'choice'; question: string; answers: string[]; correct: number } | { kind: 'code'; question: string; code: string };
/** UTF-16 offsets match textarea selections; validation enforces grapheme boundaries. */
export interface Secret { start: number; end: number; text: string; returnAfter: number }
export interface SceneFeatures { hold?: boolean; puzzle?: Puzzle; gift?: GiftStyle; secrets?: Secret[]; tilt?: boolean }
export const FINALE_SHAPES = ['text', 'heart', 'star', 'infinity'] as const;
export const FINALE_ENDINGS = ['fade', 'float', 'explode'] as const;
export interface Finale { shape: typeof FINALE_SHAPES[number]; text?: string; ending: typeof FINALE_ENDINGS[number]; duration: number }
export const DEFAULT_FINALE: Finale = { shape: 'heart', ending: 'float', duration: 4000 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && Number(v) >= min && Number(v) <= max;
function text(v: unknown, max: number, label: string) {
  if (typeof v !== 'string' || !v.trim() || Array.from(v).length > max) throw new Error(`${label}: Bitte 1 bis ${max} Zeichen eingeben.`);
  return v.trim();
}
export function validateFeatures(v: unknown, message: string): SceneFeatures {
  if (!record(v)) throw new Error('Die Erlebniseinstellungen sind ungültig.');
  const result: SceneFeatures = {};
  for (const key of ['hold', 'tilt'] as const) if (v[key] !== undefined) {
    if (typeof v[key] !== 'boolean') throw new Error('Die Erlebniseinstellungen sind ungültig.');
    result[key] = v[key];
  }
  if (v.gift !== undefined) {
    if (!GIFT_STYLES.includes(v.gift as GiftStyle)) throw new Error('Diese Geschenkanimation ist ungültig.');
    result.gift = v.gift as GiftStyle;
  }
  if (v.puzzle !== undefined) {
    const p = v.puzzle;
    if (!record(p)) throw new Error('Das Rätsel ist ungültig.');
    const question = text(p.question, 120, 'Rätselfrage');
    if (p.kind === 'choice') {
      if (!Array.isArray(p.answers) || p.answers.length < 2 || p.answers.length > 4 || !integer(p.correct, 0, p.answers.length - 1)) throw new Error('Wähle zwei bis vier Antworten und eine richtige Lösung.');
      const answers = p.answers.map(a => text(a, 60, 'Antwort'));
      if (new Set(answers.map(a => a.toLocaleLowerCase('de'))).size !== answers.length) throw new Error('Die Rätselantworten müssen unterschiedlich sein.');
      result.puzzle = { kind: 'choice', question, answers, correct: p.correct };
    } else if (p.kind === 'code' && typeof p.code === 'string' && /^\d{2,8}$/.test(p.code)) result.puzzle = { kind: 'code', question, code: p.code };
    else throw new Error('Der Zahlencode muss aus 2 bis 8 Ziffern bestehen.');
  }
  if (v.secrets !== undefined) {
    if (!Array.isArray(v.secrets) || v.secrets.length > 4) throw new Error('Pro Abschnitt sind bis zu vier Geheimnisse möglich.');
    const boundaries = new Set([0, message.length, ...Array.from(new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(message), s => s.index)]);
    result.secrets = v.secrets.map(s => {
      if (!record(s) || !integer(s.start, 0, message.length - 1) || !integer(s.end, Number(s.start) + 1, message.length) || !boundaries.has(s.start) || !boundaries.has(s.end) || !message.slice(s.start, s.end).trim()) throw new Error('Eine geheime Textmarkierung passt nicht mehr zum Abschnitt. Bitte erneut markieren.');
      if (!integer(s.returnAfter, 0, 15000) || (s.returnAfter > 0 && s.returnAfter < 3000)) throw new Error('Die Geheimnisdauer muss 3–15 Sekunden oder manuell sein.');
      return { start: s.start, end: s.end, text: text(s.text, 100, 'Zusatznachricht'), returnAfter: s.returnAfter };
    });
    const ordered = [...result.secrets].sort((a, b) => a.start - b.start);
    if (ordered.some((s, i) => i > 0 && s.start < ordered[i - 1].end)) throw new Error('Geheime Textbereiche dürfen sich nicht überschneiden.');
  }
  return result;
}
export function validateFinale(v: unknown): Finale {
  if (!record(v) || !FINALE_SHAPES.includes(v.shape as Finale['shape']) || !FINALE_ENDINGS.includes(v.ending as Finale['ending']) || !integer(v.duration, 2000, 10000)) throw new Error('Die Abschlussanimation ist ungültig.');
  return { shape: v.shape as Finale['shape'], ending: v.ending as Finale['ending'], duration: v.duration, ...(v.shape === 'text' ? { text: text(v.text, 80, 'Abschlusstext') } : {}) };
}
/** Preserve selections after edits before them; remove only secrets whose marked text was edited. */
export function remapSecrets(before: string, after: string, secrets: Secret[] = []): Secret[] {
  let start = 0;
  while (start < Math.min(before.length, after.length) && before[start] === after[start]) start++;
  let end = before.length, nextEnd = after.length;
  while (end > start && nextEnd > start && before[end - 1] === after[nextEnd - 1]) { end--; nextEnd--; }
  const delta = after.length - before.length;
  return secrets.flatMap(s => s.end <= start ? [s] : s.start >= end ? [{ ...s, start: s.start + delta, end: s.end + delta }] : []);
}
