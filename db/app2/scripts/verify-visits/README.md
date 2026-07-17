# verify-visits — E2E-Testroutine für die Zeitlinie (vereinheitlichte Visitenansicht)

Reproduzierbarer End-to-End-Test der vereinheitlichten Visitenansicht
(`features/visits-unified`). Startet die App headless, fährt per CDP
(playwright-core) durch alle Funktionen und räumt vollständig hinter sich auf.

## Ausführen

```bash
bash scripts/verify-visits/run.sh                 # Standard (Patient 10002506)
VERIFY_PATIENT=10017691 bash scripts/verify-visits/run.sh
SHOT_DIR=/tmp/shots bash scripts/verify-visits/run.sh   # mit Screenshots
```

Exit-Code 0 = alle Checks bestanden. Voraussetzungen: `xvfb-run`, `sqlite3`,
freies Display `:98`, freier Port `9222` (via `REMOTE_DEBUG_PORT` änderbar).

## Was geprüft wird

| Check | Bereich |
|---|---|
| Karten vorhanden, Typ-Chips zeigen das CODE_LOOKUP-Label (kein „General Visit“) | Label-Auflösung |
| Kopf-Klick klappt auf/zu | Expand-State |
| Filter blendet Nicht-Treffer-Visiten aus, Treffer aufgeklappt | Suche |
| Alle-auf-/zuklappen-Toggle | Header |
| Klonen: Anzahl +1, neue Karte mit heutigem Datum | useVisitActions / Service |
| Bearbeitungsmodus: Chip, Sidebar, andere Karten gedimmt | VisitCardEditor |
| Autosave (Wert → Enter) landet nach „Fertig“ in der Lese-Karte | skipReload-Refresh |
| Klon löschen: Anzahl zurück auf Ausgang | Lösch-Pfad |
| „+Besuch“ startet direkt im Bearbeitungsmodus | Auto-Edit |
| Endzustand = Ausgangszustand | Selbstreinigung |

## Sicherheitsregeln (fest eingebaut)

Entstanden aus einem realen Zwischenfall (2026-07-17): ein stiller Klon-Fehler
(prepareVisitClone-Bug, inzwischen gefixt) ließ ein Ad-hoc-Skript eine ECHTE
Visite für den Klon halten — sie wurde bearbeitet und gelöscht (aus dem Backup
wiederhergestellt). Daraus abgeleitet:

1. **Backup zuerst** — `run.sh` kopiert die DB vor dem Lauf
   (`database/backup_verify_<stamp>.db`); bei vollem Erfolg wird es entfernt,
   sonst bleibt es liegen.
2. **Löschen nur nach Existenz-Beweis** — gelöscht wird ausschließlich, wenn
   die Kartenzahl nachweislich gestiegen ist UND die oberste Karte das heutige
   Datum trägt. Schlägt der Klon fehl, wird die Sektion übersprungen — nie
   „blind die erste Karte".
3. **Integritätscheck am Ende** — Zeilenzahlen (Visiten + Beobachtungen)
   vorher/nachher müssen identisch sein, sonst Exit 1 + lauter Hinweis aufs
   Backup.
4. **Keine fremden Prozesse killen** — eigenes Display `:98` (das VNC-Setup
   `start-electron-vnc.sh` nutzt `:99`), Cleanup nur per gezieltem
   `pkill -f "Xvfb :98"`. Niemals pauschal `pkill Xvfb` — das hinterlässt
   verwaiste `/tmp/.X99-lock`-Dateien und macht das VNC-Fenster schwarz.
5. **Temp-User** `helpshot` wird pro Lauf angelegt und immer wieder gelöscht.

## Selektoren

Das Skript nutzt `data-cy`-Anker statt Label-Texten (stabil gegen
i18n-Änderungen): `view-mode-unified`, `unified-search`,
`unified-expand-toggle`, `unified-new-visit`, `unified-card`,
`unified-card-header`, `unified-card-edit`, `unified-card-menu`,
`unified-menu-edit-meta|clone|delete`, `unified-card-finish`,
`unified-card-editing-chip`, `editor-edit-meta`, `editor-add-observation`,
`editor-add-questionnaire`. Nur Quasar-Plugin-Dialoge (Confirm/NewVisit)
werden über deutsche Button-Texte angesprochen — das Skript erzwingt
`locale=de`.
