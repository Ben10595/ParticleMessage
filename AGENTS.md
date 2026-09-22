<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Projektstruktur für KI-Agenten

Arbeite innerhalb der bestehenden Zuständigkeiten. Lege neue Dateien in den passenden Ordner und verschiebe nur dann Dateien, wenn die Zuständigkeit dadurch klarer wird. Aktualisiere bei Umzügen alle Importe und führe mindestens Typecheck und Lint aus.

- `app/`: Next.js-Routen und Server Actions
- `components/editor/`: Editor, Vorschau und Editor-Steuerelemente
- `components/erlebnis/`: Passwort, Ablauf und Wiedergabe der Nachricht
- `components/partikel/`: React-Anbindung für die Partikeloberfläche
- `components/ui/`: kleine, wiederverwendbare Anzeigeelemente
- `components/hooks/`: wiederverwendbare React-Hooks
- `particles/matter/`: Simulation, Rendering, Sampling und Physik; keine React-Komponenten
- `lib/`: Speicherung, Validierung, Authentifizierung und Szenenablauf
- `types/`: gemeinsame TypeScript-Typen und Validierung
- `tests/`: Unit-Tests; `tests/browser/`: Playwright-Tests
- `docs/ki/`: verbindliche Arbeitsanweisungen und Beispiele für KI-Agenten

Lies vor umfangreicheren Änderungen `docs/ki/STRUKTUR.md`. Für neue Features verwende `docs/ki/BEISPIEL-AUFGABE.md` als Muster.

## Verbindlicher Abschluss mit AI Memory

Nach jeder Aufgabe, bei der Dateien dieses Projekts geändert wurden, prüfe am Ende automatisch, ob sich der dokumentierte Projektstand geändert hat.

Wenn sich der Projektstand geändert hat, aktualisiere die passende bestehende Projektdatei unter `AI Memory/03-Projekte/`. Dokumentiere dort kurz und konkret:

- neu hinzugefügte Funktionen
- geänderte Funktionen
- wichtige technische Änderungen
- neue Entscheidungen
- behobene wichtige Probleme
- neue offene Punkte
- Änderungen am aktuellen Projektstatus

Aktualisiere dabei außerdem das Feld `Last updated` mit dem aktuellen Datum.

Erstelle niemals eine zweite Projektdatei, wenn bereits eine passende vorhanden ist. Der AI Memory dient ausschließlich der Dokumentation; kopiere keine Projektdateien oder Quellcode dorthin.

Diese Prüfung und gegebenenfalls die Aktualisierung des AI Memory sind verbindlicher Bestandteil des Abschlusses jeder Änderungsaufgabe und erfolgen ohne zusätzliche Aufforderung.
