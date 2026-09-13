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

Die angeforderte `.env.local` ist bereits eingerichtet und von Git ausgeschlossen. Das angeforderte Passwort wird ausschließlich serverseitig in `.env.local` gesetzt. Für andere Installationen `.env.example` nach `.env.local` kopieren:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
PARTICLE_MESSAGE_PASSWORD=choose-a-password
PARTICLE_MESSAGE_SESSION_SECRET=generate-a-long-random-value
```

`PARTICLE_MESSAGE_PASSWORD` schützt Startseite und Editor. Nach erfolgreicher serverseitiger Prüfung setzt die App ein mit HMAC signiertes HttpOnly-Cookie mit zufälliger Nonce, SameSite=Strict und serverseitig geprüfter Frist von höchstens sieben Tagen. Es ist ein Browser-Sitzungscookie; in Production wird zusätzlich Secure gesetzt. Geteilte Routen unter `/p/[slug]` bleiben direkt und ohne Passwort erreichbar. Für `PARTICLE_MESSAGE_SESSION_SECRET` sollte pro Installation ein langer zufälliger Wert verwendet werden.

Es wird ausschließlich der öffentliche Publishable Key verwendet. Er ist absichtlich im Browser verfügbar. **Keinen Secret Key oder Service Role Key einsetzen.** Es gibt keine Auth-Sitzungen. Nach Änderungen an der Umgebung den Entwicklungsserver neu starten.

## Supabase

Die vorhandene Tabelle `public.messages` wird weiterverwendet:

| Spalte | PostgreSQL-Typ | Vorgabe |
| --- | --- | --- |
| id | bigint / int8 | Primary Key, automatisch erzeugt |
| created_at | timestamptz | `now()` |
| content | jsonb | Nachrichtenformat unten |
| slug | text | Unique |

RLS muss aktiviert bleiben. Die vorhandenen Policies müssen der Rolle `anon` SELECT und INSERT erlauben; auch die entsprechenden Tabellenrechte und bei sequenzbasierten IDs gegebenenfalls Sequenzrechte müssen vorliegen. Der Browser benötigt weder UPDATE noch DELETE. Die Ablauf-Migration unten ergänzt ausschließlich Zugriffsschutz, Zeitstempel-Trigger, Index und Bereinigungsjob.

```json
{
  "version": 1,
  "slides": [
    { "text": "Na du", "duration": 2200 },
    { "text": "Schön, dass es dich gibt.", "duration": 3000 }
  ]
}
```

`Link erstellen` validiert die Daten, erzeugt mit `crypto.getRandomValues` einen zwölfstelligen URL-sicheren Slug (72 Bit Zufall) und speichert `{ content, slug }`. Bei PostgreSQL-Fehler `23505` werden maximal fünf Slugs versucht. Die Route `/p/[slug]` fragt `content` und `created_at` für den exakt passenden Slug ab. Daten aus der Datenbank werden erneut validiert. Abfragen haben ein 15-Sekunden-Zeitlimit.

Die vorhandenen öffentlichen SELECT/INSERT-Policies sind **keine Zugriffskontrolle anhand des Links**: Nachrichten sind öffentlich lesbar und werden nicht verschlüsselt. Zufallsslugs erschweren das Erraten einzelner URLs. Ein Link läuft nach 72 Stunden ab; erneutes Speichern erzeugt einen neuen Link. Entwürfe bleiben während der geöffneten Sitzung im Speicher und werden erst beim Erstellen des Links gespeichert. Missbrauchsschutz und verbindliche serverseitige Größenlimits sollten für einen öffentlichen Betrieb zusätzlich in Supabase eingerichtet werden; Clientvalidierung allein kann direkte API-Aufrufe nicht begrenzen.

## Ablauf nach 3 Tagen

`supabase/migrations/202609090001_message_expiry.sql` einmal im SQL Editor des bestehenden Supabase-Projekts als `postgres` ausführen. **Im Rahmen der lokalen Überarbeitung noch nicht auf der entfernten Datenbank angewendet.** Die Migration sperrt abgelaufene Nachrichten per restriktiver RLS-Policy, schützt `created_at` gegen Manipulation und entfernt Nachrichten nach 72 Stunden im 15-Minuten-Takt mit Supabase Cron. Das betrifft auch bereits gespeicherte, abgelaufene Nachrichten. Es werden keine Inhalte oder Slugs in einer separaten Ablauftabelle behalten.

Keine neuen Environment Variables, Service-Role-Keys, Vercel-Cron-Endpunkte oder kostenpflichtigen Zusatzdienste. Die App prüft `created_at` außerdem beim Laden und stoppt auch eine bereits geöffnete Wiedergabe am Ablaufzeitpunkt. Nicht mehr vorhandene Links erhalten dieselbe Ablaufseite.

Grundlage: [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart) und [restriktive RLS-Policies](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Schrift und Partikel

Das bestehende Layout, die dunkle Farbwelt, die vier eigenen Schriftgeometrien und die offenen Editorflächen bleiben erhalten. Große Beschriftungen, Konturen, Nachrichtentexte, Emoji, Geschenk und Finale werden als Punkte gezeichnet. Kleine Beschriftungen und Eingabefelder bleiben für Lesbarkeit und Bedienbarkeit native HTML-Elemente. Umlaute, Akzente, Satzzeichen und Unicode-Grapheme bleiben erhalten; lange Texte werden passend zum verfügbaren Platz umgebrochen und skaliert.

16 Reveals plus Zufallsauswahl stehen pro Abschnitt zur Verfügung: Linienfluss, Verstreut, Wirbel, Welle, Regen, Zusammenziehen, Sanft einblenden, Aufsteigen, Aufblühen, Schreibmaschine, Explosion, Spirale, Magnet, Zoom von außen, Von links nach rechts und Punkte einsammeln. Gespeicherte ältere Effektnamen bleiben lesbar. Schreibgeschwindigkeit und getrennte Satzzeichenpausen bleiben konfigurierbar. Die Haltezeit beginnt erst nach dem vollständigen Formen.

Die Live-Vorschau zeigt Schrift und Reveal mit dem bestehenden Debouncing. „Gesamtes Erlebnis testen“ bzw. „Vorschau“ spielt alle Abschnitte einschließlich ihrer Interaktionen und des Finales ab. Escape und × kehren mit erhaltenem Entwurf zum Editor zurück.

## Optionale Erlebnisse

Im Editor lassen sich unter „Diesen Abschnitt besonders machen“ die Extras je Abschnitt kombinieren. Die Reihenfolge ist **Rätsel → Geschenk → Reveal → Nachricht und Geheimnisse**. Nicht aktivierte Schritte werden übersprungen.

- **Gedrückt halten:** Touch, primäre Maustaste, Leertaste oder Enter sammeln die Punkte über etwa 2,6 Sekunden. Loslassen lässt sie langsamer zurückdriften. Vollständig enthüllt bleibt der Text für seine Haltezeit stabil. Pointer-Abbruch, Fokusverlust und Hintergrundwechsel lösen das Halten zuverlässig. Bei reduzierter Bewegung genügt ein bewusster Tipp oder Tastendruck.
- **Rätsel:** Frage mit zwei bis vier unterschiedlichen Antworten und markierter richtiger Lösung oder Zahlencode mit zwei bis acht Ziffern. Führende Nullen bleiben erhalten. Falsche Antworten lassen beliebig viele weitere Versuche zu. Die Nachricht wird vorher weder als sichtbarer HTML-Text noch über den Screenreader enthüllt.
- **Geschenk:** Partikelbox mit eigenem Deckel und Schleife. Öffnen per Antippen, Klick oder Tastatur. Varianten: Schleife & Licht, Sternenstaub und umlaufende Punkte.
- **Handy-Neigung:** Optional global als Standard und pro Abschnitt überschreibbar. Auf unterstützten Touch-Geräten bietet der Viewer „Neigung aktivieren“ an. Eine vom Browser verlangte Berechtigung wird ausschließlich nach dieser Aktion angefragt. Ablehnung oder fehlende Sensoren blockieren die Nachricht nicht. Der erste Sensorwert kalibriert die Bewegung; Orientierung wird berücksichtigt. Gelesener Text wird höchstens um 0,65 CSS-Pixel je Achse verschoben. Bei reduzierter Bewegung wird die Neigung deaktiviert.
- **Geheime Worte:** Im Text einen Bereich markieren und „Auswahl geheim“ wählen. Bis zu vier Zusatztexte mit je höchstens 100 Zeichen. Markierte Wörter erhalten im Viewer eine dezente Punktunterstreichung und tastaturbedienbare Trefferflächen. Nur ihre Punkte formen den Zusatztext; die übrige Nachricht bleibt bestehen. Rückkehr automatisch oder per Taste. Abschnitte mit Geheimnissen bleiben bis „Weiter“ offen. Textänderungen vor einer Markierung verschieben sie mit; Änderungen innerhalb entfernen die betroffene Markierung mit einem Hinweis.
- **Abschluss:** Unter „Für die ganze Nachricht“ aktivieren. Nach der letzten Szene fliegen die Punkte auseinander und bilden Herz, Stern, Unendlichkeit oder bis zu 80 Zeichen eigenen Text. Haltezeit 2–10 Sekunden, anschließend Verblassen, Weiterschweben oder Explosion. Beim Weiterschweben bleibt die Form hinter dem Wiederholen-Button erhalten. Die Gesamtvorschau kehrt anschließend zum Editor zurück.

Rätsel und versteckte Texte sind Teil der Inszenierung. Wie bisher stehen Inhalte im öffentlichen JSONB-Datensatz; sie sind keine Verschlüsselung oder serverseitige Zugriffssperre.

## Architektur und Speicherformat

Die vorhandene Tabelle und Formatversion 1 werden weiterverwendet; **keine neue Datenbankmigration** ist nötig. Neue Felder sind optional und werden beim Speichern und Laden strikt validiert. Unbekannte Zusatzfelder werden verworfen. Bestehende Links ohne Extras spielen wie gewohnt automatisch ab.

```json
{
  "version": 1,
  "slides": [{
    "text": "Hallo Welt.",
    "duration": 3000,
    "font": "handwriting",
    "effect": "spiral",
    "features": {
      "hold": true,
      "gift": "ribbon",
      "tilt": true,
      "puzzle": { "kind": "code", "question": "Unser Code?", "code": "007" },
      "secrets": [{ "start": 0, "end": 5, "text": "Nur für dich.", "returnAfter": 5000 }]
    }
  }],
  "settings": {
    "effect": "morph",
    "finale": true,
    "writing": { "enabled": false, "speed": 75, "punctuationPause": 420, "paragraphPause": 800 },
    "finaleConfig": { "shape": "heart", "ending": "float", "duration": 4000 }
  }
}
```

`secrets.start/end` sind UTF-16-Offsets wie bei Textarea-Auswahlen. Der Validator schützt Graphemgrenzen, prüft Überlappungen und passt Offsets beim Trimmen an. `returnAfter: 0` bedeutet manuelle Rückkehr. Rätselantworten werden über den nullbasierten Index `correct` bestimmt. Deaktivierte Finales brauchen keine vollständig ausgefüllte Abschlusskonfiguration.

- `lines/OneLineEngine.ts`: Bestehender Canvas-Lebenszyklus, UI-Konturen, Schriftlayout, Timing und Koordination des Partikel-Pools.
- `particles/SceneParticles.ts`: Wiederverwendung von Punkten, Glyph-Sampling, Geschenk- und Abschlussformen, lokale Geheimnisse und gebündeltes Zeichnen.
- `particles/reveal.ts`: Reproduzierbare, kontinuierliche Reveal-Pfade und reversible Hold-Fortschritte mit exakt ruhenden Endpunkten.
- `lib/ScenePlayer.ts`: Gemeinsame abbrechbare Szenenfolge für Vorschau und öffentliche Wiedergabe, Interaktionsschritte und Lesepausen.
- `types/experience.ts`: Optionale Datenmodelle, Validierung und Anpassung von Textmarkierungen.
- `components/SceneFeatureEditor.tsx`, `SceneControls.tsx`, `DeviceTilt.tsx`: Editoreinstellungen, zugängliche Bedienung und Sensorzugriff.

Es bleibt bei einem Canvas und einem requestAnimationFrame-Zyklus. Nachrichten-Geometrie entsteht bei Text- oder Layoutänderungen, niemals pro Frame. Der Nachrichten-Pool ist auf 4.200 Punkte auf schmalen Displays und 7.000 auf Desktop begrenzt; Schrift- und Emoji-Sampling wird zwischengespeichert. Die Canvas-Auflösung ist auf DPR 2 begrenzt. Gebündelte Zeichenaufrufe vermeiden Glow-Filter pro Punkt. Partikel der kleinen Live-Vorschau werden auf deren Fläche begrenzt. Unsichtbare Tabs pausieren die Animationszeit; alle Listener und wartenden Schritte werden bei Abbruch aufgeräumt. Ohne Canvas bleiben auch Rätsel, Geschenk, Halten und Geheimnisse über HTML bedienbar.

## Prüfungen

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser
npm start
```

Unit-Tests prüfen Format, Unicode, Slugs, Authentifizierung, Pausen, Ablaufgrenzen und Partikelbewegungen. Die Browser-Tests verwenden Chrome, starten den Production-Build mit ausschließlich lokalen Test-Zugangsdaten und simulieren Supabase-Antworten. Der Testserver läuft isoliert auf Port 3200. Der echte Supabase-Rundlauf wurde zusätzlich geprüft; Details stehen in `TESTING.md`. Die entfernte SQL-Migration wurde nicht verändert oder ausgeführt.

## Deployment auf Vercel

1. Dieses Projekt in ein eigenes Git-Repository übernehmen und bei Vercel importieren; Framework Next.js auswählen.
2. Beide `NEXT_PUBLIC_SUPABASE_*`-Variablen unter Project Settings → Environment Variables für die benötigten Umgebungen setzen.
3. Mit dem normalen Build-Befehl `npm run build` bereitstellen.
4. Die bereitgestellte HTTPS-Domain öffnen und dort einen Link erzeugen. Die App verwendet automatisch die aktuelle Domain.

Lokale Links mit `localhost` sind nur auf dem jeweiligen Computer erreichbar. Für andere Personen die App bereitstellen und die öffentliche Domain nutzen; bereits gespeicherte Slugs lassen sich auch unter der neuen Domain mit `/p/<slug>` öffnen. Es werden keine Supabase-Secrets und keine zusätzlichen Backend-Endpunkte benötigt.
