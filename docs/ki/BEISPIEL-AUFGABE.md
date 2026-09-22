# Beispielaufgabe für einen KI-Agenten

## Aufgabe

Füge im Nachrichteneditor eine kleine, zugängliche Anzeige hinzu, die vor dem Speichern die geschätzte Gesamtdauer aller Abschnitte zeigt.

## Vorgehen

1. Lies `components/editor/ParticleEditor.tsx` sowie `types/message.ts`.
2. Berechne die Anzeige direkt im Editor aus den vorhandenen `duration`-Werten. Für diese reine UI-Berechnung ist keine neue Partikel- oder Speicherlogik nötig.
3. Platziere die Anzeige in `ParticleEditor.tsx` nahe bei den Abschnitts-Steuerelementen und formatiere sie auf Deutsch.
4. Wenn die Berechnung mehrfach gebraucht wird, verschiebe ausschließlich die Berechnung als kleine, getestete Funktion nach `lib/`.
5. Führe danach `npm run typecheck` und `npm run lint` aus. Ergänze bei einer ausgelagerten Funktion einen Unit-Test unter `tests/`.

## Fertig, wenn

- die Anzeige bei Hinzufügen, Löschen oder Ändern der Dauer sofort aktualisiert wird,
- sie per Screenreader verständlich ist,
- keine Daten im gespeicherten Nachrichtenformat verändert wurden,
- Typecheck und Lint erfolgreich sind.

## Nicht tun

- Keine Dateien in `particles/matter/` für diese UI-Aufgabe ändern.
- Keine neue Datenbankspalte oder Umgebungsvariable einführen.
- Keine vorhandenen, nicht zur Aufgabe gehörenden Änderungen überschreiben.
