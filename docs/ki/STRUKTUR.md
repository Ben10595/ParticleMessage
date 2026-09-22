# Struktur von ParticleMessage

## Ziel

Jede Datei hat eine klare Aufgabe. Dadurch bleiben Änderungen klein, testbar und für Menschen sowie KI-Agenten schnell auffindbar.

## Ordner

- `app/`: Seiten und serverseitige Aktionen. Hier keine umfangreiche UI- oder Partikel-Logik ablegen.
- `components/editor/`: Alles zum Erstellen und Bearbeiten einer Nachricht.
- `components/erlebnis/`: Ablauf für Empfänger und Vorschau, Passwortzugang und Szenensteuerung.
- `components/partikel/`: React-Komponenten, die die Partikelengine einbinden.
- `components/ui/`: Kleine, unabhängige Darstellungselemente.
- `components/hooks/`: Hooks mit wiederverwendbarem React-Zustand oder DOM-Verhalten.
- `particles/matter/`: Render- und Simulationskern. Dieser Ordner darf nicht von React abhängen.
- `lib/`: Fachlogik ohne UI, etwa Speicherung, Authentifizierung und Szenenablauf.
- `types/`: Gemeinsame Datenformate und deren Validierung.
- `tests/`: Tests passend zur Quellstruktur; Browser-Abläufe gehören nach `tests/browser/`.

## Arbeitsregeln

1. Zuerst die betroffene Datei und ihre direkten Abhängigkeiten lesen.
2. Bestehende Datenformate in `types/` weiterverwenden. Änderungen daran müssen alte gespeicherte Nachrichten weiter lesbar halten.
3. UI-Änderungen gehören in die zuständige Komponente; Logik, die unabhängig von React funktioniert, gehört nach `lib/` oder `particles/matter/`.
4. Keine Secret- oder Service-Role-Keys im Client verwenden.
5. Nach Änderungen `npm run typecheck` und `npm run lint` ausführen. Bei geänderter Logik auch den passenden Test ergänzen oder ausführen.

Siehe auch [Beispielaufgabe](BEISPIEL-AUFGABE.md).
