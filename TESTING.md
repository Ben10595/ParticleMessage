# Prüfprotokoll

Stand: 9. September 2026. Neuaufbau in der bestehenden Next.js-App; vorhandene Supabase-Instanz und Schema unverändert.

## Automatisierte Prüfungen

- `npm install`: erfolgreich.
- `npm run typecheck`: erfolgreich.
- `npm run lint`: erfolgreich.
- `npm test`: 16 Tests bestanden. Format- und Größenvalidierung, alte Nachrichten, optionale Abschnittseinstellungen, getrennte Satzzeichenpausen, reproduzierbares natürliches Schreibtiming, Unicode-Grapheme, sichere Slugs, Kollisionen, Insertfehler, 72-Stunden-Ablauf, exakte Passwortprüfung, signierte individuelle Sessions, Tokenablauf/Manipulation, Partikelwiederverwendung, Bewegungen ohne Teleportation, Einrasten, reduzierte Bewegung, DPR und Cleanup.
- `npm run build`: erfolgreich. `/` und `/p/[slug]` werden dynamisch bereitgestellt.
- `npm run test:browser`: 20 Tests bestanden, jeweils zehn mit Desktop Chrome (1440 × 1000) und mobiler Chromium-Emulation (iPhone 13). Separater Production-Testserver auf Port 3200 mit ausschließlich lokalen Test-Zugangsdaten. Supabase-Antworten werden in diesen Tests simuliert.

Browserabdeckung: falsches/richtiges Passwort, HttpOnly/Secure/SameSite-Cookie, Session nach Reload, identischer Canvas über Szenen hinweg, Emoji an Cursorposition, individuelle Schreiboptionen, Reihenfolge, Abschnittsgrenzen, Löschung, Vorschau-Abbruch, automatische Editor-Rückkehr, echtes Live-Schreibtiming/Haltezeit, Linkerzeugung/Kopieren, öffentliche Wiedergabe ohne Login, alle sieben Übergänge, Wiederholung, Satzzeichenpause über Resize hinweg, fehlende/abgelaufene/offline Nachrichten, Speicherausfall mit erhaltenem Entwurf, fehlender Canvas und Reduced Motion.

## Tatsächlich mit der konfigurierten Supabase-Instanz geprüft

Im integrierten Browser wurde die Hauptseite mit dem konfigurierten Passwort geöffnet. Der neue Editor speicherte „Schön, dass es dich gibt. ❤️“ über den echten Publishable-Key-INSERT. Der erzeugte Slug `GikMGEV-63ur` wurde anschließend unter `/p/GikMGEV-63ur` aus Supabase geladen und einschließlich Emoji auf einem 390 × 844 großen Viewport abgespielt. Wiederholung funktionierte; die Rückkehr zur Hauptseite erforderte innerhalb der Sitzung kein erneutes Passwort.

Der einzelne Testdatensatz bleibt in der bestehenden Tabelle und unterliegt der vorhandenen 72-Stunden-Ablauflogik. Es wurden keine Daten gelöscht und keine SQL-Migrationen ausgeführt.

## Visuelle Prüfung und Grenzen

Passwortseite, große Partikelschrift, offene Editorstruktur, kleine Beschriftungen, mobile Umbrüche, öffentliche Nachricht, Branding und Wiederholung wurden visuell geprüft. Zu enge Umbrüche kleiner Labels wurden korrigiert. Kleine Texte werden dichter gesampelt; Eingabetexte bleiben zur Bedienbarkeit nativ.

Ein Desktop-Stichprobenwert der Canvas-Diagnostik zeigte 60 FPS. Das ist keine Garantie für alle Geräte. Der Editor braucht wegen der vollständig aus Punkten dargestellten Beschriftungen mehr Partikel als die Grundbudgets von 1.400/3.000; bei Last werden zuerst freie Hintergrundpunkte reduziert. Physische Smartphones und ihre Bildschirmtastaturen wurden nicht getestet. Kein Deployment wurde vorgenommen.
