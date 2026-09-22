'use client';
import ParticleSelect from './ParticleSelect';
import type { Slide, MessageSettings } from '@/types/message';
import { DEFAULT_FINALE, GIFT_STYLES, GIFT_LABELS, type SceneFeatures, type GiftStyle, type Finale } from '@/types/experience';
interface Props { slide: Slide; settings: MessageSettings; busy: boolean; update: (features: SceneFeatures) => void; onSettingsChange: (settings: MessageSettings) => void }
export default function SceneFeatureEditor({ slide, settings, busy, update, onSettingsChange }: Props) {
  const features = slide.features ?? {}, puzzle = features.puzzle, finale = settings.finaleConfig ?? DEFAULT_FINALE;
  const change = (patch: Partial<SceneFeatures>) => update({ ...features, ...patch });
  const finish = (patch: Partial<Finale>) => onSettingsChange({ ...settings, finaleConfig: { ...finale, ...patch } });
  return <div className="experience-options">
    <details className="advanced feature-section"><summary data-particle="button">Diesen Abschnitt besonders machen <span className="feature-count">{[features.hold, features.puzzle, features.gift, features.tilt].filter(Boolean).length || '+'}</span></summary>
      <div className="feature-content">
        <label className="control-row"><span>Gedrückt halten zum Enthüllen</span><input data-particle="switch" className="switch" type="checkbox" role="switch" aria-label="Hold-to-Reveal" checked={features.hold ?? false} disabled={busy} onChange={e => change({ hold: e.target.checked })} /></label>
        <p className="setting-note">Punkte sammeln sich beim Halten. Loslassen lässt sie zurückdriften. Vollständig enthüllt bleibt der Text ruhig.</p>
        <div className="control-row"><span>Als Geschenk verpacken</span><ParticleSelect label="Geschenkanimation" value={features.gift ?? 'none'} disabled={busy} onChange={value => change({ gift: value === 'none' ? undefined : value as GiftStyle })} options={[{ value: 'none', label: 'Ohne Geschenk' }, ...GIFT_STYLES.map(value => ({ value, label: GIFT_LABELS[value] }))]} /></div>
        <label className="control-row"><span>Sanfte Handy-Neigung</span><input data-particle="switch" className="switch" type="checkbox" role="switch" aria-label="Neigung dieses Abschnitts" disabled={busy} checked={features.tilt ?? settings.tilt ?? false} onChange={e => change({ tilt: e.target.checked })} /></label>
        <label className="control-row"><span>Ein Rätsel vorab</span><input data-particle="switch" className="switch" type="checkbox" role="switch" aria-label="Rätsel aktivieren" disabled={busy} checked={!!puzzle} onChange={e => change({ puzzle: e.target.checked ? { kind: 'choice', question: '', answers: ['', ''], correct: 0 } : undefined })} /></label>
        {puzzle && <div className="puzzle-editor">
          <div className="control-row"><span>Rätselart</span><ParticleSelect label="Rätselart" disabled={busy} value={puzzle.kind} onChange={kind => change({ puzzle: kind === 'code' ? { kind, question: puzzle.question, code: '' } : { kind: 'choice', question: puzzle.question, answers: ['', ''], correct: 0 } })} options={[{ value: 'choice', label: 'Antwort auswählen' }, { value: 'code', label: 'Zahlencode' }]} /></div>
          <label className="feature-field">Deine Rätselfrage<textarea disabled={busy} maxLength={120} value={puzzle.question} placeholder="Was ist unser Lieblingsort?" onChange={e => change({ puzzle: { ...puzzle, question: e.target.value } })} /></label>
          {puzzle.kind === 'code' ? <label className="feature-field">Richtiger Zahlencode<input inputMode="numeric" autoComplete="off" maxLength={8} disabled={busy} value={puzzle.code} placeholder="2 bis 8 Ziffern" onChange={e => change({ puzzle: { ...puzzle, code: e.target.value.replace(/\D/g, '') } })} /></label> : <>
            <fieldset className="answer-editor"><legend>Antworten · Kreis markiert die richtige Lösung</legend>{puzzle.answers.map((answer, index) => <div className="answer-edit-row" key={index}><input type="radio" name="correct-answer" aria-label={`Antwort ${index + 1} ist richtig`} disabled={busy} checked={puzzle.correct === index} onChange={() => change({ puzzle: { ...puzzle, correct: index } })} /><input aria-label={`Antwort ${index + 1}`} maxLength={60} disabled={busy} value={answer} placeholder={`Antwort ${index + 1}`} onChange={e => change({ puzzle: { ...puzzle, answers: puzzle.answers.map((a, i) => i === index ? e.target.value : a) } })} />{puzzle.answers.length > 2 && <button aria-label={`Antwort ${index + 1} entfernen`} disabled={busy} onClick={() => change({ puzzle: { ...puzzle, answers: puzzle.answers.filter((_, i) => i !== index), correct: puzzle.correct === index ? 0 : puzzle.correct > index ? puzzle.correct - 1 : puzzle.correct } })}>×</button>}</div>)}</fieldset>
            {puzzle.answers.length < 4 && <button data-particle="button" disabled={busy} onClick={() => change({ puzzle: { ...puzzle, answers: [...puzzle.answers, ''] } })}>Antwort hinzufügen +</button>}
          </>}
          <p className="setting-note">Bei mehreren Extras: Rätsel → Geschenk → Enthüllen.</p>
        </div>}
      </div>
    </details>
    <details className="advanced feature-section" open={features.secrets?.length ? true : undefined}><summary data-particle="button">Geheime Worte <span className="feature-count">{features.secrets?.length || '+'}</span></summary>
      <p className="setting-note">Markiere ein Wort oder einen kurzen Bereich im Nachrichtentext und wähle „Auswahl geheim“. Bis zu vier Zusatznachrichten.</p>
      {features.secrets?.map((secret, i) => <div className="secret-editor" key={i}>
        <div className="secret-editor-heading"><span>„{slide.text.slice(secret.start, secret.end)}“</span><button data-particle="button" aria-label={`Geheimnis ${i + 1} entfernen`} disabled={busy} onClick={() => change({ secrets: features.secrets?.filter((_, index) => i !== index) })}>×</button></div>
        <label className="feature-field">Zusatznachricht {i + 1}<textarea maxLength={100} disabled={busy} placeholder="Was nur dein Mensch entdecken soll …" value={secret.text} onChange={e => change({ secrets: features.secrets?.map((s, index) => i === index ? { ...s, text: e.target.value } : s) })} /></label>
        <div className="control-row"><span>Zurück zur Nachricht</span><ParticleSelect label={`Rückkehr von Geheimnis ${i + 1}`} disabled={busy} value={String(secret.returnAfter)} options={[{ value: '5000', label: 'Nach 5 Sekunden' }, { value: '8000', label: 'Nach 8 Sekunden' }, { value: '12000', label: 'Nach 12 Sekunden' }, { value: '0', label: 'Per Antippen' }]} onChange={value => change({ secrets: features.secrets?.map((s, index) => i === index ? { ...s, returnAfter: Number(value) } : s) })} /></div>
      </div>)}
      {!!features.secrets?.length && <p className="setting-note">Der Empfänger wählt „Weiter“, wenn er diesen Abschnitt fertig erkundet hat.</p>}
    </details>
    <details className="advanced feature-section"><summary data-particle="button">Für die ganze Nachricht <span className="feature-count">{settings.finale ? '·' : '+'}</span></summary>
      <label className="control-row"><span>Neigung als Standard</span><input data-particle="switch" className="switch" type="checkbox" role="switch" aria-label="Neigung als Standard" disabled={busy} checked={settings.tilt ?? false} onChange={e => onSettingsChange({ ...settings, tilt: e.target.checked })} /></label>
      <label className="control-row"><span>Ein besonderer Abschluss</span><input data-particle="switch" className="switch" type="checkbox" role="switch" aria-label="Abschlussanimation" disabled={busy} checked={settings.finale} onChange={e => onSettingsChange({ ...settings, finale: e.target.checked })} /></label>
      {settings.finale && <div className="feature-content">
        <div className="control-row"><span>Letzte Form</span><ParticleSelect label="Abschlussform" disabled={busy} value={finale.shape} options={[{ value: 'heart', label: 'Herz' }, { value: 'star', label: 'Stern' }, { value: 'infinity', label: 'Unendlichkeit' }, { value: 'text', label: 'Eigener Text' }]} onChange={value => finish({ shape: value as Finale['shape'], ...(value === 'text' ? { text: finale.text ?? '' } : {}) })} /></div>
        {finale.shape === 'text' && <label className="feature-field">Abschlusstext<textarea disabled={busy} maxLength={80} value={finale.text ?? ''} placeholder="Und das bleibt: Wir." onChange={e => finish({ text: e.target.value })} /></label>}
        <div className="control-row"><span>Danach</span><ParticleSelect label="Ende der Abschlussanimation" disabled={busy} value={finale.ending} options={[{ value: 'float', label: 'Weiter schweben' }, { value: 'fade', label: 'Langsam verblassen' }, { value: 'explode', label: 'Letzte Explosion' }]} onChange={value => finish({ ending: value as Finale['ending'] })} /></div>
        <div className="control-row"><span>Abschluss halten</span><ParticleSelect label="Dauer des Abschlusses" disabled={busy} value={String(finale.duration)} options={[2000, 4000, 6000, 8000, 10000].map(n => ({ value: String(n), label: `${n / 1000} Sekunden` }))} onChange={value => finish({ duration: Number(value) })} /></div>
      </div>}
    </details>
  </div>;
}
