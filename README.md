# ParticleMessage

Eine deutschsprachige Nachrichten-Webanwendung mit Next.js App Router, TypeScript, zehn SVG-basierten Living-Type-Engines, einer eigenen WebGL2-Partikelengine mit Canvas2D-Fallback und Supabase. Keine Konten, KI, Kamera, Mikrofon oder Partikelbibliothek.

## Lokal starten

Voraussetzung: Node.js 22.13+ (getestet mit Node.js 24) und npm.

```sh
npm install
npm run dev
```

Anschließend http://localhost:3000 öffnen. Die Startseite führt zum Editor. Ein Abschnitt enthält bis zu 150 Unicode-Zeichen; bis zu 15 Abschnitte sind möglich. Mit den Pfeilen lässt sich der ausgewählte Abschnitt verschieben, mit × löschen. Die Dauer beträgt 1–10 Sekunden und bezeichnet die Haltezeit **nach** dem Formen. Formieren und Auflösen kommen hinzu. Die Vorschau lässt sich mit × oder Escape verlassen.

## Umgebungsvariablen

`.env.local` enthält lokale Zugangsdaten und gehört nie ins Git-Repository. Für eine neue lokale Installation `.env.example` nach `.env.local` kopieren und die Beispielwerte ersetzen:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
PARTICLE_MESSAGE_PASSWORD=choose-a-password
PARTICLE_MESSAGE_SESSION_SECRET=generate-a-long-random-value
```

`PARTICLE_MESSAGE_PASSWORD` schützt Startseite und Editor. Nach erfolgreicher serverseitiger Prüfung setzt die App ein mit HMAC signiertes HttpOnly-Cookie mit zufälliger Nonce, SameSite=Strict und serverseitig geprüfter Frist von höchstens sieben Tagen. Es ist ein Browser-Sitzungscookie; in Production wird zusätzlich Secure gesetzt. Geteilte Routen unter `/m/[slug]` und `/p/[slug]` bleiben direkt und ohne Passwort erreichbar. Für `PARTICLE_MESSAGE_SESSION_SECRET` sollte pro Installation ein langer zufälliger Wert verwendet werden.

Es wird ausschließlich der öffentliche Publishable Key verwendet. Er ist absichtlich im Browser verfügbar. **Keinen Secret Key oder Service Role Key einsetzen.** Es gibt keine Supabase-Auth-Sitzungen; der Erstellerzugang nutzt die separate signierte Passwort-Sitzung. Nach Änderungen an der Umgebung den Entwicklungsserver neu starten.

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
    { "text": "Na du", "duration": 2200, "engine": "line", "engineParams": { "lineWidth": 2.5 } },
    { "text": "Schön, dass es dich gibt.", "duration": 3000, "engine": "echo", "engineParams": { "count": 4 } }
  ]
}
```

`Nachricht senden` validiert die Daten, erzeugt mit `crypto.getRandomValues` einen zwölfstelligen URL-sicheren Slug (72 Bit Zufall) und speichert `{ content, slug }`. Bei PostgreSQL-Fehler `23505` werden maximal fünf Slugs versucht. Die Routen `/m/[slug]` und `/p/[slug]` fragen `content` und `created_at` für den exakt passenden Slug ab. Daten aus der Datenbank werden erneut validiert. Abfragen haben ein 15-Sekunden-Zeitlimit.

Die vorhandenen öffentlichen SELECT/INSERT-Policies sind **keine Zugriffskontrolle anhand des Links**: Nachrichten sind öffentlich lesbar und werden nicht verschlüsselt. Zufallsslugs erschweren das Erraten einzelner URLs. Ein Link läuft nach 72 Stunden ab; erneutes Speichern erzeugt einen neuen Link. Entwürfe bleiben während der geöffneten Sitzung im Speicher und werden erst beim Erstellen des Links gespeichert. Missbrauchsschutz und verbindliche serverseitige Größenlimits sollten für einen öffentlichen Betrieb zusätzlich in Supabase eingerichtet werden; Clientvalidierung allein kann direkte API-Aufrufe nicht begrenzen.

## Ablauf nach 3 Tagen

`supabase/migrations/202609090001_message_expiry.sql` einmal im SQL Editor des bestehenden Supabase-Projekts als `postgres` ausführen. **Im Rahmen der lokalen Überarbeitung noch nicht auf der entfernten Datenbank angewendet.** Die Migration sperrt abgelaufene Nachrichten per restriktiver RLS-Policy, schützt `created_at` gegen Manipulation und entfernt Nachrichten nach 72 Stunden im 15-Minuten-Takt mit Supabase Cron. Das betrifft auch bereits gespeicherte, abgelaufene Nachrichten. Es werden keine Inhalte oder Slugs in einer separaten Ablauftabelle behalten.

Keine neuen Environment Variables, Service-Role-Keys, Vercel-Cron-Endpunkte oder kostenpflichtigen Zusatzdienste. Die App prüft `created_at` außerdem beim Laden und stoppt auch eine bereits geöffnete Wiedergabe am Ablaufzeitpunkt. Nicht mehr vorhandene Links erhalten dieselbe Ablaufseite.

Grundlage: [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart) und [restriktive RLS-Policies](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Living Type und Nachrichtenwelt

Neue Abschnitte starten mit LINE MORPH. Die Engine zeichnet aus einer einzelnen berechneten Mittellinie die Buchstaben und lässt die Linie in lesbare Schrift übergehen. Im Animation Lab sind pro Abschnitt LINE, PARTICLE, LIQUID, THREAD, SIGNAL, ORBIT, SHATTER, ECHO, DRAW und VOID auswählbar. Die Regler passen sich an die gewählte Engine an; Geschwindigkeit und Linien-, Partikel- oder Echo-Werte werden direkt in der Live-Bühne sichtbar.

Die Engines liegen als SVG-Stage in `components/partikel/LivingTypeStage.tsx`; `particles/matter/livingTypeGeometry.ts` rastert die Schrift nur im Speicher, um Punkte und Mittellinie zu bestimmen. Abschnittswechsel verbinden die alte und neue Form mit Linien-, Kontur- oder Auflösebewegung. Kurze Wörter werden größer, lange Texte ruhiger; ❤️, ✨ und 😂 lösen zurückhaltende Zusatzimpulse aus. Die Stage berücksichtigt `prefers-reduced-motion` und zeigt bei fehlender Canvas-Unterstützung lesbaren Text. Alte Nachrichten ohne `engine` verwenden weiterhin die bisherige Partikelwiedergabe im gleichen JSON-Format `version: 1`.

Geteilte Links beginnen mit einem kurzen dunklen Intro und zeigen während der Nachricht keine Navigation. Nach dem Ende erscheinen „Nochmal ansehen“, „Antworten“ und „Particle Message erstellen“. Dezente synthetische Töne bleiben standardmäßig aus und beginnen erst nach einer Berührung.

Die fünf bestehenden Designwelten betreffen die Produktoberfläche; sie sind unabhängig von den zehn Rendering-Engines für die Nachricht.

Die Produktoberfläche bietet fünf eigenständige Designwelten: Particle, Message Core, Liquid Flow, Console Flow und Minimal Focus. Ein sichtbarer Umschalter bewahrt Composer, Navigation, Live-Vorschau und Wiedergabe. Pro Modus lassen sich Bewegung, Glow und Übergänge abstimmen; Favorit, Auto-Wechsel, Startmodus, Hintergrundeffekte, Partikel und Fokusmodus werden lokal im Browser gespeichert. „Draft Resonance“ reagiert auf die Länge des Entwurfs. Systemeinstellungen und die manuelle Option für reduzierte Bewegung werden berücksichtigt.

Der SVG-/CSS-Message-Core reagiert auf Zeigerbewegung, Eingabe und den echten Speicherstatus. Der bisherige Partikelrenderer bleibt für ältere Nachrichten und optionale Szenenfunktionen verfügbar. Bei ausgeschalteter Partikelvorschau bleibt der Entwurf als Text lesbar; öffentliche geteilte Nachrichten werden durch lokale Anzeigeeinstellungen nicht verändert.

- Dunkle Anthrazit-/Schwarz-Oberfläche mit kühlem Blau, Cyan und dezentem Violett, ruhigem Linienraster und großzügigem Freiraum.
- Der persistente Message Core wechselt zwischen Ruhe, Eingabe, Aufladen, Versand, Erfolg, Sperre und Fehler. Der API-Aufruf startet sofort; es gibt keine künstliche Versandwartezeit.
- Texte entstehen durch echte Glyphraster auf einem unsichtbaren Canvas. Größe, Umbruch, Punktabstand und Dichte passen sich an den verfügbaren Platz an. UTF-16-Graphemgrenzen bleiben für Geheimnisse erhalten.
- Vier Browser-Schriftfamilien: Klar (neuer Standard), Handschrift, Editorial und Mono. Der Editor zeigt dieselben Font-Stacks wie der Sampler. Explizit gespeicherte Schriftwahlen bleiben erhalten.
- Ein fester Pool mit bis zu 18.000 Slots auf Desktop, 11.000 auf schmalen WebGL-Ansichten und 7.000 im Canvas-Fallback. Tatsächlich gezeichnet werden nur sichtbare Punkte. IDs, Positionen und Geschwindigkeiten bleiben beim Formenwechsel erhalten.
- Federphysik mit Sekunden-Zeitbasis und Substeps bis 1/120 s. Maus-/Mehrfinger-Abstoßung oder Anziehung, geschwindigkeitsabhängiger Wind, Shockwaves, schwebende Ruhebewegung, Schwerkraft und Bewegungsspuren sind kombinierbar.
- Die Animation folgt der Bildwiederholrate des Displays. Zeitbasierte Dämpfung hält Transparenz, Tiefe, Neigung und Cursorimpulse bei unterschiedlichen Bildraten konsistent. Reveal-Pfade starten und enden mit weicher Beschleunigung; das Portal zieht die vorhandene Geometrie ohne anfänglichen Positionssprung zusammen.
- Räumliche Zielzuordnung verhindert das bisherige Kreuzen an Zeilengrenzen. Die Punkte folgen ihrer Bahn direkt; Federkräfte legen nur Interaktion und Restimpuls darüber. Textübergänge berechnen ihr Ende aus den tatsächlichen Punktverzögerungen.
- Ruhiges Grundtempo bei 1×: Text 1,9 s, Formen 2,2 s, Geschenköffnung 1,3 s und Portal 1,9 s. Auflösen dauert 1,5 s. Gemeinsame Zeitkonstanten halten Bewegung und Szenenablauf synchron; der vorhandene Geschwindigkeitsregler bleibt verfügbar.
- WebGL2 zeichnet instanzierte Quads in einem Draw Call. Die Shader erzeugen einen weichen Punktkern und geschwindigkeitsabhängige Spuren. Der gebündelte Canvas2D-Fallback verwendet dieselbe Simulation.
- Automatische Qualitätsanpassung mit Hysterese, DPR-Begrenzung, pausierter Animation in unsichtbaren Tabs und WebGL-Context-Recovery. Bei fehlendem Canvas bleibt eine funktionale HTML-Darstellung verfügbar.

## Editor und Szenen

Bis zu 15 Abschnitte mit je 150 Zeichen. Hinzufügen, Löschen und Verschieben erfolgen mit zugänglichen Schaltflächen. Die Living-Type-Bühne reagiert direkt auf Text, Engine und Regler; die ältere Partikelvorschau verwendet 260 ms Debouncing. Auf Desktop bleibt die Bühne beim Scrollen in ihrer Spalte, auf kleinen Displays steht sie nach dem Textbereich. Der Wiederholen-Button spielt den Reveal erneut. „Vorschau“ spielt denselben `ScenePlayer` wie der öffentliche Link; Escape/× kehrt mit erhaltenem Entwurf zurück.

Die bisherigen Partikel-Reveals samt Zufallsauswahl und Schreibanimation bleiben zusätzlich erreichbar: Formwechsel, Verstreut, Wirbel, Welle, Regen, Zusammenziehen, Einblenden, Aufsteigen, Aufblühen, Schreibmaschine, Explosion, Spirale, Magnet, Zoom, Von links nach rechts, Punkte einsammeln, Portal, Gravity Drop, Shockwave, Dust Assemble, Orbit Assemble, Random Chaos, Pixel Sweep, Word by Word und Floating Words. Jeder Abschnitt besitzt eigene Engine, Partikelanimation, Schrift und optional Schreibrhythmus/Satzzeichenpausen. Die Lesedauer beginnt erst nach dem Formieren.

Unter „Bewegung & Atmosphäre“ stehen Dichte, Animationsgeschwindigkeit (0,5–2×), Feder/Soft Float/Magnetic/Explosive, Berührungsmodus und kombinierbare Bewegungs-/Wind-/Gravitationseffekte bereit. Diese Einstellungen werden mitgespeichert.

Die optionalen Interaktionen werden in der Reihenfolge **Rätsel → Geschenk → Hold/Reveal → Nachricht/Geheimnisse → nächste Szene → Finale** abgespielt:

- **Rätsel:** zwei bis vier Antworten oder Zahlencode mit zwei bis acht Ziffern. Führende Nullen bleiben erhalten. Fehler erzeugen eine kleine Partikelwelle; erneute Versuche bleiben möglich.
- **Geschenk:** isometrische Punktflächen, eigener Deckel und Schleife. Öffnen per Touch, Klick oder Tastatur, Lichtimpuls und Explosion, danach sammeln sich die Partikel zur Nachricht.
- **Hold to Reveal:** über etwa 2,6 Sekunden gedrückt halten, loslassen lässt die Punkte langsamer zurückdriften. Sichtbarer Fortschritt und sanfter Hintergrund-Glow. Vollständig enthüllt bleibt die Nachricht sichtbar. Pointer-Abbruch, Fokusverlust und Hintergrundwechsel lösen das Halten. Reduzierte Bewegung braucht weiterhin eine bewusste Geste.
- **Geheime Worte:** Text im Eingabefeld markieren und „Auswahl geheim“ wählen. Bis zu vier Zusatztexte. Die zugehörigen Partikel ziehen nach vorne; übriger Text wird gedimmt. Rückkehr stellt die ursprünglichen Ziele derselben Punkte wieder her. Geheimnisse sind per Tastatur erreichbar. Textänderungen verschieben oder entfernen betroffene Markierungen korrekt.
- **Neigung:** optionale Smartphone-Parallaxe, erst nach direkter Aktivierung. Kalibrierung und Orientierung werden berücksichtigt. Gelesener Text bewegt sich maximal 0,5 CSS-Pixel pro Achse; freie Punkte deutlich mehr. Ohne Sensor oder Freigabe ist die Experience vollständig bedienbar.
- **Finale:** Materie zieht in ein Portal, verdichtet sich, hält kurz inne, explodiert mit Shockwave und formt Herz, Stern, Unendlichkeit oder eigenen Text. Endverhalten: Weiterschweben, Verblassen oder Explosion.

Seitenbeschriftungen lassen sich weder markieren noch über normale Kopierbefehle kopieren. Eingabefelder bleiben für Bearbeitung und Geheimwort-Markierungen auswählbar; der Link-kopieren-Button funktioniert weiterhin. Das ist eine Bedienungsregel, kein Schutz vor Auslesen der öffentlichen Inhalte.

Die gesamte Produktoberfläche bleibt natives HTML und SVG für Lesbarkeit, Tastatur und Screenreader. Neue Living-Type-Nachrichten verwenden eine SVG-Stage, ältere Partikeltexte und Szenenformen den vorhandenen Canvas. Rätsel/Geheimnisse sind Inszenierungen im öffentlichen JSON, keine Verschlüsselung.

## Architektur und Speicherformat

Neue aktive Module unter `particles/matter/`:

| Modul | Aufgabe |
| --- | --- |
| `ParticleEngine.ts` | einziger RAF, Gruppenkoordination, Holds, Geheimnisse, Zeit/Abbruch, Context-Recovery |
| `MorphSystem.ts` | feste TypedArrays und räumliche Zielzuordnung in O(n log n) |
| `PhysicsSystem.ts` | Federn, Reveal-Pfade, Kräfte und Interaktion |
| `ParticleRenderer.ts` | WebGL2-Instancing, eigener Shader, Canvas2D-Fallback |
| `TextSampler.ts` | Glyphraster, mehrzeiliges Layout, Cache, Text-/Bildtargets |
| `ShapeSampler.ts` | räumliches Geschenk und Finaleformen |
| `InteractionSystem.ts` | Pointer, Mehrfinger-Eingaben, begrenzte Shockwaves, Cleanup |
| `QualityManager.ts` | gemessene Qualität mit Hysterese |

`lib/ScenePlayer.ts` steuert die gemeinsame Sequenz für Vorschau und Empfänger. `types/message.ts` und `types/experience.ts` validieren alle gespeicherten Inhalte. `DeviceTilt.tsx` kapselt den optionalen Sensorzugriff.

Formatversion 1 und die vorhandene JSONB-Spalte werden weiterverwendet. Keine neue Migration. `settings.particles` ist optional; alte Nachrichten bleiben lesbar. Neue Links verwenden `/m/<slug>`; bestehende `/p/<slug>`-Links bleiben direkt erreichbar.

```json
{
  "version": 1,
  "slides": [{
    "text": "Hallo Welt.", "duration": 3000, "font": "classic", "effect": "portal",
    "features": { "hold": true, "gift": "ribbon", "secrets": [{ "start": 0, "end": 5, "text": "Nur für dich.", "returnAfter": 5000 }] }
  }],
  "settings": {
    "effect": "morph", "finale": true,
    "writing": { "enabled": false, "speed": 75, "punctuationPause": 420, "paragraphPause": 800 },
    "particles": { "density": "balanced", "speed": 1, "preset": "spring", "interaction": "repel", "trails": true, "ripples": true, "wind": false, "gravity": false },
    "finaleConfig": { "shape": "heart", "ending": "float", "duration": 4000 }
  }
}
```

## Open-Source-Prüfung

Alle fünf ausdrücklich genannten GitHub-Repositories wurden **vor** der Implementierung direkt geklont und untersucht. Commitstände, konkrete Dateien, Lizenzbefunde, technische Vergleiche und Übernahmeentscheidungen stehen in [docs/OPEN_SOURCE_REVIEW.md](docs/OPEN_SOURCE_REVIEW.md).

Wichtig: ParticleFX enthält im geprüften Stand keine LICENSE-Datei; Particles Playground hat eine von der MIT-Angabe im README abweichende `LICENCE` mit Benachrichtigungspflicht. Aus beiden wurde kein Code übernommen. Auch die anderen Projekte dienen als technische Referenzen; die neue Engine, Shader und Formen wurden eigenständig geschrieben. Keine fünf Partikelbibliotheken, Fremdassets oder zusätzliche Grafikabhängigkeiten.

## Prüfen

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser
```

Die Browser-Suite startet einen isolierten Production-Server auf Port 3200 mit lokalen Testzugangsdaten, Desktop Chrome und iPhone-13-Viewport. Supabase-Antworten und Sensorereignisse sind dort simuliert. Sie prüft auch WebGL-Contextverlust/-Wiederherstellung, den echten Canvas2D-Renderer ohne WebGL und den HTML-Fallback ohne Canvas.

Der optionale `scripts/check-storage.ts`-Integrationstest erzeugt **einen echten neutralen Testdatensatz** und lädt ihn über dieselbe Supabase-Anbindung wieder. Nur bewusst mit `node --env-file=.env.local --import tsx scripts/check-storage.ts` ausführen. Der Datensatz läuft regulär nach 72 Stunden ab; der Test verändert keine bestehenden Daten oder Tabellenrechte.

Aktuelle Prüfergebnisse und Grenzen stehen in [TESTING.md](TESTING.md). Physische iOS-/Android-Geräte und reale Low-End-GPUs müssen separat gemessen werden; Browser-Emulation allein garantiert keine 60 FPS auf jeder Hardware.

## Quellcode nach GitHub hochladen

Im Projektordner zuerst `git status` prüfen, damit nur die gewünschten Änderungen hochgeladen werden. Danach:

```sh
git add -A
git status
git commit -m "Prepare ParticleMessage for deployment"
git push -u origin main
```

`git add -A` nimmt sämtliche aktuell geänderten und neuen Projektdateien auf. `.env.local` ist durch `.gitignore` ausgeschlossen; `.env.example` enthält nur Platzhalter und darf mit hochgeladen werden. Vor dem Commit trotzdem `git status` kontrollieren und niemals echte Passwörter, Session-Secrets oder Supabase-Secret-/Service-Role-Keys committen. Dieses Repository ist mit dem Remote `origin` verbunden.

GitHub speichert hier den Quellcode, stellt die Next.js-App aber nicht selbst als Website bereit. Lokale Nachrichtenlinks mit `localhost` sind nur auf deinem Computer erreichbar. Für Links, die andere Personen öffnen können, muss die App zusätzlich auf einem Next.js-Host veröffentlicht werden.

## Deployment auf Vercel

1. Das GitHub-Repository bei Vercel importieren; Framework Next.js auswählen.
2. Unter Project Settings → Environment Variables für die benötigten Umgebungen alle vier Variablen aus `.env.example` setzen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `PARTICLE_MESSAGE_PASSWORD` und `PARTICLE_MESSAGE_SESSION_SECRET`. Das Session-Secret muss ein eigener langer zufälliger Wert sein.
3. Mit dem normalen Build-Befehl `npm run build` bereitstellen. Vorher sicherstellen, dass Supabase-Tabelle und SELECT-/INSERT-Policies vorhanden sind. Die Ablaufmigration oben ist für Ablauf-Sperre und automatische Bereinigung vorgesehen.
4. Nach dem Deployment die HTTPS-Domain öffnen, mit dem eingerichteten Passwort anmelden, eine Testnachricht erstellen und den erzeugten Link öffnen. Die App baut Links aus der aktuellen Domain und verwendet neue `/m/<slug>`-Links; alte `/p/<slug>`-Links bleiben erreichbar.

Die öffentlichen Nachrichtenlinks sind absichtlich ohne Passwort lesbar. Veröffentliche daher keine vertraulichen Inhalte; Links sind nicht verschlüsselt. Es werden keine Supabase-Secret-Keys und keine zusätzlichen Backend-Endpunkte benötigt.
