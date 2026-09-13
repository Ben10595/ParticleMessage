# Neue gemeinsame Particle Engine – 13. September 2026

Die frühere Linien-Engine und die beiden separaten Partikelimplementierungen sind durch `particles/matter/` ersetzt. Ein persistenter TypedArray-Pool versorgt UI, Nachricht, Geschenk, Geheimnisse und Finale; WebGL2 zeichnet instanzierte Quads. Die neue Oberfläche verwendet dunkle Flächen, warme Goldakzente und gerasterte Partikelschrift. Der Editor behält native, zugängliche Bedienelemente.

- Production Build mit TypeScript, ESLint und `git diff --check`: erfolgreich.
- `npm test`: **26 Tests bestanden**. Die Tests der entfernten Engines wurden durch Prüfungen der tatsächlich verwendeten Pool-/Physik-/Samplingmodule ersetzt. Abdeckung: beständige IDs, begrenzte Budgets, Federkonvergenz bei 30/60/120 Hz, Rückkehr nach Cursorinteraktion, Hold/Reduced Motion, Geschenkflächen, Qualitätsregelung, Unicode und gespeicherte Einstellungen.
- Vollständige Browser-Suite: **54 bestanden, 2 erwartete Desktop-Skips**. Chrome Desktop (1440 × 1000) und Chromium mit iPhone-13-Emulation. Die zwei Sensorprüfungen sind ausschließlich im mobilen Projekt aktiv.
- Geprüft: Erstellerpasswort und signierte Sitzung, Erstellen/Bearbeiten/Reihenfolge/Emoji, alle Schriftarten, 23 Reveals plus Zufall, Live-Vorschau, Speichern/Kopieren, alte `/p/`- und neue `/m/`-Links, Ablauf/Offline/Fehler, Rätsel/Geschenk/Halten/Geheimnis/Finale/Wiederholung, Tastatur, Resize, 150-Zeichen-Umbrüche, Sensorfreigabe/-ablehnung, Reduced Motion, WebGL-Kontextverlust mit Wiederherstellung sowie echte Canvas2D- und HTML-Ausweichdarstellung.
- Zusätzliche Sichtprüfung im In-App-Browser bei einfacher Pixeldichte: kleine Buttonschrift, Geschenk, Abbruch und Startseite. Subpixel-Kantenglättung und korrekt vormultipliziertes Alpha verhindern verschwindende beziehungsweise zu dunkle Punktbuchstaben. Lange Geheimtexte erhalten Unterstützung aus vorhandenen freien Partikeln, während die markierten Original-IDs erhalten bleiben.
- Nach der Geheimtext- und Kantenglättungskorrektur: **14 betroffene Desktop-/Mobile-Browsertests erneut bestanden**.
- Echte Supabase-Speicherung separat mit `scripts/check-storage.ts` überprüft: ein neutraler technischer Testdatensatz wurde erfolgreich gespeichert und zurückgelesen, einschließlich Partikeleinstellungen und Ablaufdatum. Keine persönlichen Inhalte, keine Schemaänderung, kein Deployment. Der Testdatensatz läuft nach 72 Stunden ab.

Die Browser-Suite simuliert Supabase-Antworten und Sensorereignisse; der oben genannte Speichertest nutzt die echte Verbindung. Mobile-Tests sind Emulationen. Physische iOS-/Android-Geräte und leistungsschwache Hardware wurden nicht vermessen; 60 FPS sind ein Entwicklungsziel, keine geräteübergreifende Garantie. Die lokale Vorschau läuft unter `http://localhost:3201/`.

Die direkte Quellcode- und Lizenzprüfung aller fünf vorgegebenen Repositories steht in [docs/OPEN_SOURCE_REVIEW.md](docs/OPEN_SOURCE_REVIEW.md). Keine Fremdengine oder Grafikbibliothek wurde eingebaut.

Die folgenden Einträge dokumentieren frühere Entwicklungsstände und deren damalige Testergebnisse.

---

# Partikel-Erlebnisse – 13. September 2026

Die sieben Erweiterungen sind in die vorhandene Website integriert: sechs zusätzliche Reveals (insgesamt 16 plus Zufall), reversibles Hold-to-Reveal, Multiple-Choice- und Code-Rätsel, drei Geschenkvarianten, optionale Handy-Neigung, lokale Geheimnisse und konfigurierbare Abschlussformen samt drei Endverhalten. Vorhandene Schriften, Routen, Zugangsschutz, Speicherung und 72-Stunden-Ablauf bleiben erhalten.

- TypeScript, ESLint, Production Build und `git diff --check`: erfolgreich.
- `npm test`: 37 Tests bestanden. Neue Abdeckung für validiertes Roundtripping, alte Links, führende Leerzeichen und Graphemgrenzen, überlappende Geheimnisse, ungültige Rätsel und Finales, Textänderungen vor/in Markierungen, stetige Reveal-Pfade, exakte Endpunkte, reversibles Halten, Reduced Motion, Partikelbudgets, Trefferflächen und begrenzte Neigung.
- Vollständige Browser-Suite: **44 bestanden, 2 erwartete Desktop-Skips**. Sensorprüfungen laufen ausschließlich im mobilen Projekt. Chrome Desktop und Chromium mit iPhone-13-Emulation.
- Nach der abschließenden Anpassung von Haltefläche und Zusatzschrift: alle acht betroffenen Desktop-/Mobile-Interaktionstests erneut bestanden.
- Geprüft: kombinierte Folge Rätsel → Geschenk → Halten → lokales Geheimnis → Finale → Wiederholung; falsche Antworten und führende Nullen; Speichern sämtlicher Optionen; unveränderter Entwurf nach Abbruch eines Rätsels; partielles Halten/Loslassen; Tastatur; automatische und manuelle Geheimnis-Rückkehr; Resize während eines Geheimnisses; sechs zusätzliche Reveal-Arten; Text/Herz/Stern/Unendlichkeit und sämtliche Abschluss-Enden; erteilter sowie abgelehnter Sensorzugriff; Canvas-Fallback und Reduced Motion.
- Sichtprüfung anhand von Desktop- und Mobile-Screenshots: ursprüngliche Schriftkonturen aus Punkten, lange Nachrichten, Geschenk, Rätsel, lokale Zusatznachricht, Editorfelder und schwebendes Finale. Beispiele unter `test-results/features-*.png` (durch spätere Testläufe neu erzeugt). Die Zusatzschrift auf schmalen Displays wurde für angenehmere Wortumbrüche verkleinert; der Haltebereich umfasst den Bildschirm, während Vorschau-Abbruch und Sensorsteuerung erreichbar bleiben.

Supabase-Antworten und Sensorberechtigungen/-ereignisse wurden in den Browserprüfungen simuliert. Keine entfernte Datenbankänderung und kein Deployment. Echte iOS-/Android-Sensoren, physische Bildschirmtastaturen und die Leistung auf leistungsschwacher Hardware wurden nicht gemessen. Lokale FPS-Stichproben der Suite lagen bei 60; daraus folgt keine Garantie für andere Geräte.

Die neue Logik nutzt die vorhandene JSONB-Spalte und benötigt keine zusätzliche Migration. Die frühere Ablaufmigration weiter unten bleibt davon unabhängig.

---

# Schriftauswahl und zusätzliche Animationen – 12. September 2026

Vier Strichschriften (Handschrift, Klar, Editorial, Mono), Schriftproben im Menü und zehn Animationen plus Zufallsauswahl sind pro Abschnitt verfügbar. Die Auswahl wird in Vorschau, Gesamtwiedergabe und geteiltem Link übernommen. Bestehende Nachrichten ohne Schriftangabe bleiben lesbar.

- `npm test`: 29 Tests bestanden. Neue Abdeckung: Schrift-/Animationskombinationen im validierten Speicherformat, ungültige Schriftwerte, alte Standardwerte, unterschiedliche Schriftgeometrie, mobile Umbrüche, konstante Mono-Abstände, exakt ruhende Eintrittsbewegungen und Reduced Motion für alle Effekte.
- `npm run lint` und `npm run build`: erfolgreich, einschließlich TypeScript-Prüfung.
- `npm run test:browser`: alle 30 Tests bestanden, 15 je Desktop und iPhone-13-Emulation. Neue Abdeckung: jede Schrift live auswählen, Abschnittseinstellungen beim Verschieben erhalten, speichern und im geteilten Link mit derselben Schrift/Animation abspielen; alle elf Animationsoptionen abschließen.
- Sichtprüfung: Schriftproben im Dropdown, alle vier Vorschau-Schriften und die formatierte öffentliche Nachricht auf Desktop und Mobile. Screenshots unter `test-results/font-*.png` und `test-results/styled-message-*.png`.

Supabase-Antworten wurden in den Browsertests simuliert. Keine entfernte Migration oder Veröffentlichung. Physische Smartphones wurden nicht getestet.

---

# One-Line-Prüfung — 11. September 2026

Die bestehende Next.js-Anwendung verwendet jetzt `lines/OneLineEngine.ts` über dieselben Komponenten und Abläufe. Routen, Passwort-/Sessionfunktionen, Supabase-Anbindung, Slugs, Nachrichtenformat, Timing, Editorzustand und Deployment-Konfiguration wurden nicht verändert. Die bisherige Partikel-Engine bleibt im Repository; der aktive Client importiert die Linien-Engine.

## Aktuelle Prüfungen

- TypeScript und ESLint: erfolgreich, keine Warnungen.
- Unit-Tests: 25 bestanden. Neue Abdeckung für originale Strichschrift, deutsche Sonderzeichen, Emoji-Grapheme, Unicode-Fallback, mobile Textbegrenzung, Pfadlängen, unverändertes Satzzeichen-Timing bei Resize, Reduced Motion und vollständiges Engine-Cleanup.
- Production Build: erfolgreich; bestehende dynamische Routen `/` und `/p/[slug]` erhalten.
- Vollständige Browser-Suite: 28 bestanden, je 14 in Desktop Chrome und mobiler Chromium-Emulation (iPhone 13). Passwortfehler/Login, signierte HttpOnly/Secure/SameSite-Sitzung, Reload, Editorfunktionen, Emoji am Cursor, individuelle Timings, Reihenfolge/Löschung/Limits, alle Übergänge, Vorschau-Abbruch/-Rückkehr, Linkerzeugung/Kopieren, öffentliche Wiedergabe ohne Passwort, Fehler/Offline/Ablauf, Tastatur-Dropdowns, Resize, lange Texte, Canvas-Fallback und Reduced Motion geprüft.
- Nach der letzten Anpassung der Fadenführung wurden die acht betroffenen Desktop-/Mobile-Tests zusätzlich erfolgreich wiederholt.
- Supabase-Antworten werden in der automatisierten Browser-Suite simuliert.

## Echte Speicherung und Sichtprüfung

Über die bestehende lokale Anwendung wurde die neutrale Testnachricht „Schön, dass es dich gibt. ❤️“ tatsächlich gespeichert. Der erzeugte Slug `txR7z3dEIhzb` wurde über `/p/[slug]` geöffnet; Wiedergabe, Abschluss und Wiederholung funktionierten. Der Testdatensatz unterliegt dem vorhandenen 72-Stunden-Ablauf. Keine Daten wurden gelöscht, keine Migrationen ausgeführt.

Startseite, Editor, Dropdown, Live-Vorschau, Erfolgsmeldung, öffentlicher Viewer und lange Nachrichten wurden visuell geprüft. Desktop- und mobile Screenshots entstehen in `test-results/`. Der freie Faden ist außerhalb der ruhenden Nachricht geführt. Das Branding überlagert im scrollenden Editor keine Eingabefelder.

Die Engine arbeitet mit requestAnimationFrame, gespeicherter Geometrie und einem fortbestehenden Federzug; keine React-Zustandsänderungen pro Frame. Layoutmessungen erfolgen bei UI-Ereignissen, Scroll und Resize. DPR ist auf 2 begrenzt. Lokale Stichprobe im integrierten Browser: 144 FPS bei der ruhenden öffentlichen Ansicht. Das ist keine Garantie für andere Geräte; physische Smartphones und Bildschirmtastaturen wurden nicht getestet. Kein Deployment vorgenommen.

---

# Prüfprotokoll

Stand: 10. September 2026. Gezielte Überarbeitung der bestehenden Oberfläche: eigene Dropdowns, Punktraster, Text-Sampling und Übergänge. Layout, Supabase-Integration und Nachrichtenschema unverändert.

## Automatisierte Prüfungen

- `npm run typecheck`: erfolgreich.
- `npm run lint`: erfolgreich.
- `npm test`: 19 Tests bestanden. Zusätzlich geprüft: wort- und graphemgerechte Umbrüche, zweidimensionale Skalierung ohne Stauchung, positionsunabhängiger Sampling-Cache, Cursor nach abschließendem Zeilenumbruch und eindeutige Rahmenpunkte. Format- und Größenvalidierung, alte Nachrichten, optionale Abschnittseinstellungen, getrennte Satzzeichenpausen, reproduzierbares natürliches Schreibtiming, Unicode-Grapheme, sichere Slugs, Kollisionen, Insertfehler, 72-Stunden-Ablauf, exakte Passwortprüfung, signierte individuelle Sessions, Tokenablauf/Manipulation, Partikelwiederverwendung, Bewegungen ohne Teleportation, Einrasten, reduzierte Bewegung, DPR und Cleanup.
- `npm run build`: erfolgreich. `/` und `/p/[slug]` werden dynamisch bereitgestellt.
- `npm run test:browser`: 28 Tests bestanden, jeweils vierzehn mit Desktop Chrome (1440 × 1000) und mobiler Chromium-Emulation (iPhone 13). Separater Production-Testserver auf Port 3200 mit ausschließlich lokalen Test-Zugangsdaten. Supabase-Antworten werden in diesen Tests simuliert.

Nach der letzten visuellen Feinabstimmung wurden acht betroffene Desktop-/Mobile-Tests zusätzlich erfolgreich wiederholt (Dropdowns, Live-Vorschau, Debouncing, Szenenwechsel und Reduced Motion). TypeScript, Lint, Produktionsbuild und `git diff --check` sind ebenfalls erfolgreich.

Browserabdeckung: falsches/richtiges Passwort, HttpOnly/Secure/SameSite-Cookie, Session nach Reload, identischer Canvas über Szenen hinweg, Emoji an Cursorposition, individuelle Schreiboptionen, Reihenfolge, Abschnittsgrenzen, Löschung, Vorschau-Abbruch, automatische Editor-Rückkehr, echtes Live-Schreibtiming/Haltezeit, Linkerzeugung/Kopieren, öffentliche Wiedergabe ohne Login, alle sieben Übergänge, Wiederholung, Satzzeichenpause über Resize hinweg, fehlende/abgelaufene/offline Nachrichten, Speicherausfall mit erhaltenem Entwurf, fehlender Canvas und Reduced Motion. Zusätzlich: Dropdown-Tastaturbedienung einschließlich Escape/Tab/Typeahead, Outside-Click, 150 Zeichen ohne Wortabstand, Edit-Debouncing und weiterhin montierter Editor während des Partikelübergangs.

## Frühere Prüfung mit der konfigurierten Supabase-Instanz (9. September)

Diese Prüfung stammt vom 9. September; am 10. September wurden Supabase-Antworten ausschließlich simuliert. Im integrierten Browser wurde die Hauptseite mit dem konfigurierten Passwort geöffnet. Der neue Editor speicherte „Schön, dass es dich gibt. ❤️“ über den echten Publishable-Key-INSERT. Der erzeugte Slug `GikMGEV-63ur` wurde anschließend unter `/p/GikMGEV-63ur` aus Supabase geladen und einschließlich Emoji auf einem 390 × 844 großen Viewport abgespielt. Wiederholung funktionierte; die Rückkehr zur Hauptseite erforderte innerhalb der Sitzung kein erneutes Passwort.

Der einzelne Testdatensatz bleibt in der bestehenden Tabelle und unterliegt der vorhandenen 72-Stunden-Ablauflogik. Es wurden keine Daten gelöscht und keine SQL-Migrationen ausgeführt.

## Visuelle Prüfung und Grenzen

Passwortseite, große Partikelschrift, offene Editorstruktur, kleine Beschriftungen, mobile Umbrüche, öffentliche Nachricht, Branding und Wiederholung wurden visuell geprüft. Zu enge Umbrüche kleiner Labels wurden korrigiert. Kleine Texte werden dichter gesampelt; Eingabetexte bleiben zur Bedienbarkeit nativ.

Desktop und iPhone-13-Emulation zeigten in einer lokalen Stichprobe jeweils 60 FPS (rund 18.300 bzw. 9.800 Partikel). Das ist keine Garantie für alle Geräte. Der Editor braucht wegen der vollständig aus Punkten dargestellten Beschriftungen mehr Partikel als die Grundbudgets von 1.400/3.000; bei Last werden zuerst freie Hintergrundpunkte reduziert. Physische Smartphones und ihre Bildschirmtastaturen wurden nicht getestet. Kein Deployment wurde vorgenommen.

## Cozy-Partikelüberarbeitung

Die bestehende Engine nutzt jetzt ein deterministisches Perlin-Noise-Feld, weiches Anziehen/Loslassen mit erhaltenem Impuls, wiederverwendete Partikel und warme, zwischengespeicherte Staub-Sprites. Eingerastete Schriftpunkte haben Opazität 1, einen scharfen Kern und einen gemeinsam gezeichneten, dezenten Glow. Kleine ruhende Kerne werden für klare Kontraste an Bildschirmpixeln ausgerichtet. Schrift-Sampling ist dichter; Hintergrundpartikel werden bei Überbelegung weich ausgeblendet, bevor sie aus dem Pool entfernt werden.

TypeScript, Lint, Build und 20 Unit-Tests bestanden. Neue Prüfungen decken die Stetigkeit des Noise-Felds, Impulserhaltung beim Loslassen, Rückkehr zu weichem Ambient Floating und vollständig opake Schriftkerne ab. Alle 28 Desktop-/Mobile-Browsertests bestanden; nach der abschließenden Schärfekorrektur werden acht betroffene Vorschau-/Resize-Tests erneut geprüft. Der Desktop-Test prüft zusätzlich helle Schriftkern-Pixel direkt im Canvas.

Visuelle Prüfung: Editor, öffentliche Nachricht und mobile Darstellung. Lokale FPS-Stichprobe während paralleler Browsertests: Desktop 46/60/60, iPhone-13-Emulation 60/60/60. Keine Messung auf physischen Smartphones, keine Garantie für jedes Gerät. Supabase-Antworten simuliert; kein Deployment.
