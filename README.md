# ParticleMessage

Eine deutschsprachige Nachrichten-Webanwendung mit Next.js App Router, TypeScript, einem selbst entwickelten Canvas-Partikelsystem und Supabase. Keine Konten, KI, Kamera, Mikrofon oder Partikelbibliothek.

## Lokal starten

Voraussetzung: Node.js 22.13+ (getestet mit Node.js 24) und npm.

```sh
npm install
npm run dev
```

Anschließend http://localhost:3000 öffnen. Die Startseite führt zum Editor. Ein Abschnitt enthält bis zu 150 Unicode-Zeichen; bis zu 15 Abschnitte sind möglich. Mit den Pfeilen lässt sich der ausgewählte Abschnitt verschieben, mit × löschen. Die Dauer beträgt 1–10 Sekunden und bezeichnet die Haltezeit **nach** dem Formen. Formieren und Auflösen kommen hinzu. Die Vorschau lässt sich mit × oder Escape verlassen.

## Umgebungsvariablen

Die angeforderte `.env.local` ist bereits eingerichtet und von Git ausgeschlossen. Für andere Installationen `.env.example` nach `.env.local` kopieren:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Es wird ausschließlich der öffentliche Publishable Key verwendet. Er ist absichtlich im Browser verfügbar. **Keinen Secret Key oder Service Role Key einsetzen.** Es gibt keine Auth-Sitzungen. Nach Änderungen an der Umgebung den Entwicklungsserver neu starten.

## Supabase

Die vorhandene Tabelle `public.messages` wird unverändert verwendet:

| Spalte | PostgreSQL-Typ | Vorgabe |
| --- | --- | --- |
| id | bigint / int8 | Primary Key, automatisch erzeugt |
| created_at | timestamptz | `now()` |
| content | jsonb | Nachrichtenformat unten |
| slug | text | Unique |

RLS muss aktiviert bleiben. Die vorhandenen Policies müssen der Rolle `anon` SELECT und INSERT erlauben; auch die entsprechenden Tabellenrechte und bei sequenzbasierten IDs gegebenenfalls Sequenzrechte müssen vorliegen. Die App benötigt weder UPDATE noch DELETE und führt keine Migrationen aus.

```json
{
  "version": 1,
  "slides": [
    { "text": "Na du", "duration": 2200 },
    { "text": "Schön, dass es dich gibt.", "duration": 3000 }
  ]
}
```

`Link erstellen` validiert die Daten, erzeugt mit `crypto.getRandomValues` einen zwölfstelligen URL-sicheren Slug (72 Bit Zufall) und speichert `{ content, slug }`. Bei PostgreSQL-Fehler `23505` werden maximal fünf Slugs versucht. Die Route `/p/[slug]` fragt ausschließlich `content` für den exakt passenden Slug ab. Daten aus der Datenbank werden erneut validiert. Abfragen haben ein 15-Sekunden-Zeitlimit.

Die vorhandenen öffentlichen SELECT/INSERT-Policies sind **keine Zugriffskontrolle anhand des Links**: Nachrichten sind öffentlich lesbar und werden nicht verschlüsselt. Zufallsslugs erschweren das Erraten einzelner URLs. Da keine Konten oder Löschrechte vorgesehen sind, bleibt ein gespeicherter Link bestehen; erneutes Speichern erzeugt einen neuen Link. Entwürfe bleiben während der geöffneten Sitzung im Speicher und werden erst beim Erstellen des Links gespeichert. Missbrauchsschutz und verbindliche serverseitige Größenlimits sollten für einen öffentlichen Betrieb zusätzlich in Supabase eingerichtet werden; Clientvalidierung allein kann direkte API-Aufrufe nicht begrenzen.

## Partikelsystem

- `particles/ParticleEngine.ts`: ein langlebiger Pool pro geöffnetem Erlebnis, Zustände FLOATING / FORMING / HOLDING / DISPERSING, individuelle Federphysik, gedämpfte Pointer-Reaktion und framebasierter Zeitgeber.
- `particles/textSampler.ts`: unsichtbares Canvas, Alpha-Sampling, Umbruch einschließlich langer Wörter und Unicode, begrenzter Cache für Zielpunkte.
- `particles/targetGenerators.ts`: wiederverwendbare Punkte für Linien, Rahmen und Buttons.
- `components/ParticleCanvas.tsx`: Canvas-Lebenszyklus und Fallback bei fehlendem Kontext.
- `components/ParticleEditor.tsx`: transparente semantische HTML-Steuerelemente. Ihre sichtbaren Texte und Rahmen entstehen auf dem Canvas.
- `components/ParticleExperience.tsx`: Wechsel zwischen Start, Editor, Vorschau, Link-Erfolg und Zuschaueransicht ohne Austausch des Canvas.
- `components/ParticleViewer.tsx`: Screenreader-Ausgabe und Vorschau-Abbruch.
- `lib/messages.ts`, `lib/supabase.ts`: zentrale Speicherung, Slugs, Validierung und Fehlerbehandlung.

Zielpunkte werden nur bei Änderungen an Inhalt oder Layout berechnet, niemals pro Frame. Der Pool passt sich an Bildschirmgröße und gemessene Framezeiten an (Grundbudget Desktop 2.200–3.500, mobil 1.800 Punkte; dichte Editoransichten erweitern denselben Pool bei Bedarf auf maximal 6.000 bzw. 4.200 Punkte, damit Beschriftungen lesbar bleiben; bei niedriger Leistung 20 % weniger). Ein Teil bleibt frei schwebend. DPR wird bis 2 berücksichtigt. Resize und Scroll aktualisieren Zielpositionen. Animationen und Haltezeiten pausieren in unsichtbaren Tabs. `prefers-reduced-motion` hält freie Punkte ruhig und setzt Formen ohne Flugbewegung zusammen. Screenreader erhalten semantische Texte; bei fehlendem Canvas bleibt ein normales, vollständig bedienbares Formular verfügbar. Eingaben werden niemals als HTML interpretiert.

## Prüfungen

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Die automatisierten Tests prüfen Nachrichtenlimits und Format, Unicode, unveränderte Behandlung von HTML-Text, Sluggenerierung, begrenzte Kollisionswiederholungen, nicht wiederholbare Insertfehler sowie responsive Textumbrüche. Funktionstests im Browser und der echte Supabase-Rundlauf sind in `TESTING.md` dokumentiert.

## Deployment auf Vercel

1. Dieses Projekt in ein eigenes Git-Repository übernehmen und bei Vercel importieren; Framework Next.js auswählen.
2. Beide `NEXT_PUBLIC_SUPABASE_*`-Variablen unter Project Settings → Environment Variables für die benötigten Umgebungen setzen.
3. Mit dem normalen Build-Befehl `npm run build` bereitstellen.
4. Die bereitgestellte HTTPS-Domain öffnen und dort einen Link erzeugen. Die App verwendet automatisch die aktuelle Domain.

Lokale Links mit `localhost` sind nur auf dem jeweiligen Computer erreichbar. Für andere Personen die App bereitstellen und die öffentliche Domain nutzen; bereits gespeicherte Slugs lassen sich auch unter der neuen Domain mit `/p/<slug>` öffnen. Es werden keine Supabase-Secrets und keine zusätzlichen Backend-Endpunkte benötigt.
