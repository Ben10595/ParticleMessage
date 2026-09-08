# Prüfprotokoll

Stand: 8. September 2026. Lokale Next.js-App mit der in `.env.local` konfigurierten Supabase-Instanz.

## Automatisiert

- `npm install`: erfolgreich, npm-Audit meldete keine bekannten Schwachstellen.
- `npm test`: 7 Tests bestanden. Formatversion, fehlende/leere Slides, 15-Slide- und 150-Zeichen-Limit, Unicode, HTML als Text, Dauergrenzen, Slugformat, Kollisionswiederholungen, Insertfehler, Umbruch langer Wörter, Pool-Wiederverwendung, reduzierte Bewegung, DPR-Begrenzung, Abbruch von Wartezeiten und Aufräumen der Engine.
- `npm run typecheck`: erfolgreich.
- `npm run lint`: erfolgreich.
- `npm run build`: erfolgreich; `/` wird statisch, `/p/[slug]` dynamisch bereitgestellt.

## Im Browser tatsächlich geprüft

- Desktop-Startseite mit echter Partikelschrift und Übergang zum Editor.
- Zwei Abschnitte anlegen und bearbeiten, verschieben und Dauer ändern.
- Vorschau startet mit dem ersten Text und wechselt selbstständig zum zweiten; anschließend Wiederholung und Rückkehr zum Editor.
- Echter öffentlicher Supabase-INSERT über `Link erstellen` mit zwei Abschnitten: „Na du“ und „Schön, dass es dich gibt.“.
- Der erzeugte Slug `3X-aH5B4pOqK` wurde über `/p/3X-aH5B4pOqK` geöffnet. Der Viewer lud beide Inhalte aus Supabase und begann ohne Editor. Dieser Testdatensatz bleibt in der Tabelle; die App besitzt absichtlich keine Löschrechte.
- Clipboard-Kopierbutton bestätigt erfolgreiches Kopieren.
- Responsiver Viewport 390 × 844: Editor und beide Hauptaktionen ohne horizontalen Überlauf, langer Text mit 137 Zeichen, Scrollen im nativen Textfeld, Löschen eines Abschnitts, Validierungsfehler bei leerem Abschnitt.
- Obere Dauergrenze: 10 Sekunden, weiterer Plus-Schritt deaktiviert.
- Mobile Vorschau: langer Text vollständig auf mehrere Zeilen verteilt, aus Partikeln geformt und innerhalb des Viewports.
- Nicht vorhandener Slug: passende Partikelfehlermeldung und Link zur Startseite.

## Grenzen der Prüfung

Die mobile Prüfung erfolgte mit einem Browser-Viewport, nicht auf einem physischen Smartphone mit Bildschirmtastatur. Es wurde kein dauerhaftes 60-FPS-Profil auf verschiedenen Geräten erstellt. Reduzierte Bewegung und fehlender Canvas-Kontext sind durch Engine-Tests abgedeckt; der vollständige Browser-Fallback und die manuelle Clipboard-Alternative wurden nicht durch künstliche Browserfehler erzwungen. Netzwerk- und Supabase-Berechtigungsfehler wurden in der Fehlerlogik und in den Insert-Tests geprüft, nicht durch Änderungen an der realen Supabase-Konfiguration. Vercel-Deployment wurde dokumentiert, aber nicht ausgeführt.
