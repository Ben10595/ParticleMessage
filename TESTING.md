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
