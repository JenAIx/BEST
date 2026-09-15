# db-check — Integrationstest gegen eine Datenbankdatei

Prüft eine BEST-SQLite-Datei systematisch, ohne sie anzufassen (arbeitet
auf einer Kopie unter `tests/output/`). Gedacht für neue Test-/Demo-DBs,
Backups und Datenbanken aus Feldinstallationen vor einem Release.

```bash
node scripts/db-check/check-db.mjs tests/demodata/production.db
node scripts/db-check/check-db.mjs pfad/zur.db --json tests/output/report.json --keep
```

Exit-Code 0 = kein FAIL (WARN sind Hinweise auf Datenbestand, kein Blocker).
`--keep` lässt die migrierte Kopie liegen (z. B. für sqlite3-Nachfragen),
`--json` schreibt alle Ergebnisse als Report.

## Was geprüft wird

| Block | Inhalt |
|---|---|
| migration | alle Migrationen aus `database-service.js` auf die Kopie anwenden; welche neu liefen, ob alle registriert sind |
| integrity | `PRAGMA integrity_check`, `PRAGMA foreign_key_check` |
| schema | erwartete Tabellen/Views, alle Schema-Trigger (aus Migration 016 abgeleitet), FK-Kaskade der Audit-Tabelle |
| counts | Zeilenzahlen aller Tabellen |
| consistency | Waisen (Visiten/Beobachtungen/Einschreibungen/Lookups), Patient-Visite-Widersprüche, Duplikate |
| access | Patienten ohne `USER_PATIENT_LOOKUP`-Zeile (für Nutzer unsichtbar), öffentlich/Creator, Patienten pro Benutzer |
| convention | CLAUDE.md-Datenmodell: §1 Kategorielabels, §2 F-Findings (A-Antwortkonzepte, keine NVAL), §3 VALUEFLAG-Codes + NV ohne Wert, §3b R-Dateien (Blob + Envelope), §5 Visitentypen in CODE_LOOKUP, Einschlussdaten |
| audit | Flag-Verteilung, Trail ohne Waisen, Trail-Zeilen konsistent, `logEvent`-Roundtrip und Kaskade beim Löschen (auf der Kopie) |
| repo / perf | echte `StudyRepository`-Insights-Pfade je Studie (Kacheln, Monatsreihe = Eingeschriebene, Zeitraumfilter, Drugs, Findings, Labs, Audit-Summary) und die schweren UI-Abfragen (Patientenliste, Zeitlinie des größten Patienten, Grid) mit Zeitmessung — > 2 s wird WARN |

Ergänzend, aber nicht Teil des Skripts: `npm test -- --run` (Unit/Integration,
eigene Temp-DBs) und `bash scripts/verify-visits/run.sh` (E2E der Zeitlinie,
App muss geschlossen sein, nutzt `database/production.db`).
