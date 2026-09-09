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

## Partikelsystem

Ein persistenter Canvas-Pool verbindet Passwortseite, Startseite, Editor, Vorschau und Erfolg. Die Zustände FLOATING, FORMING, HOLDING, MORPHING und DISPERSING beschreiben den Lebenszyklus jedes Punktes. Ein dichtes Textraster mit präzisen Ruhepositionen ersetzt das flimmernde Schriftbild. Titel, kleine Beschriftungen, Rahmen, Buttons, Eingabekanten, Navigation, Schalter, Slider, Link und Branding entstehen aus demselben Partikelpool. Transparente HTML-Controls bleiben als barrierefreie Bedienfläche erhalten. Während der Eingabe bleiben Textarea und Passwortfeld nativ lesbar; Emoji-Auswahl und Unicode-Emoji werden optimiert nativ dargestellt. Emojis werden als vollständige Unicode-Grapheme nativ gezeichnet. Die Textziele und Umbrüche werden pro Inhalt/Layout berechnet und zwischengespeichert, Schreibanimationen laufen ohne React-Updates pro Zeichen.

Der Editor bündelt Textänderungen für 380 ms und lockert die Vorschau für 180 ms, ohne die zugewiesenen Partikel zu verwerfen. Anschließend werden kurze Wege zu den neuen Buchstaben bevorzugt. Die Live-Vorschau wiederholt den aktuellen Abschnitt mit echtem Schreibtiming, Partikelcursor, Übergang und Haltezeit. Die Gesamtvorschau kehrt nach dem letzten Abschnitt automatisch zum Editor zurück. Bestehende Partikel werden über stabile Schlüssel und räumliche Zuordnung wiederverwendet. Sieben Übergänge (Smooth Morph, Scatter, Wave, Whirl, Rain, Collapse, Random), vier Schreibpresets, getrennte Pausen für Komma/Punkt/Fragezeichen/Ausrufezeichen/Zeilenumbruch und Haltezeiten werden pro Abschnitt gespeichert: `slides[].effect`, `slides[].writing` und `slides[].duration`. Bestehende globale `settings`, das frühere Finale und alte Übergangsnamen werden weiterhin gelesen. Die Datenbankstruktur und Formatversion 1 bleiben unverändert. Alte Nachrichten verwenden Smooth Morph ohne Schreibanimation.

Offscreen-Sampling mit doppelter Auflösung, adaptive Punktabstände und ein Layout-Cache sorgen für scharfe Konturen. Die Engine nutzt sanft beschleunigte Pfade und gedämpfte Federn; gehaltene Textpunkte stehen exakt still. Textpartikel haben Vorrang vor Hintergrundpartikeln. Der Grundpool umfasst etwa 1.400 Punkte mobil und 3.000 am Desktop; dichte Partikelschrift und sämtliche Editorbeschriftungen erweitern ihn bei Bedarf deutlich über 4.000 Punkte. Diese bewusste Ausnahme priorisiert Lesbarkeit. Bei schlechter Bildrate reduziert die Engine den Hintergrund und entfernt überzählige freie Partikel; ruhende Textpunkte werden gemeinsam gezeichnet. DPR ist auf 2 begrenzt, unsichtbare Tabs pausieren die Animationszeit. `prefers-reduced-motion` überspringt Flug- und Schreibbewegungen. Ohne Canvas bleiben Editor und Nachrichten als HTML nutzbar.

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
