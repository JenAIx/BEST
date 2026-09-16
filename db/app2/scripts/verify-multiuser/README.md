# verify-multiuser — E2E: zwei Schreiber auf einer Datenbankdatei

Prüft das Mehrbenutzer-Verhalten aus dem Audit vom September 2026 (Phase 1):
Auto-Reload bei fremden Änderungen, `StaleDataBanner` während der
Bearbeitung, Optimistic Locking (`OBSERVATION_FACT.VERSION`), Warten auf eine
fremde Schreibsperre (`busy_timeout` + Retry) und der Toast „durch anderen
Nutzer gesperrt“.

- **Instanz A** ist die headless gestartete App (CDP, wie `verify-visits`).
- **Instanz B** ist eine zweite, unabhängige SQLite-Connection im Prüfskript
  (`RealSQLiteConnection`). Aus Sicht der Datenbankdatei ist das genau eine
  zweite App-Instanz; ein zweiter Electron-Prozess würde sich mit dem ersten um
  den Dev-Server-Port streiten.

```bash
bash scripts/verify-multiuser/run.sh
VERIFY_PATIENT=10017691 bash scripts/verify-multiuser/run.sh
SHOT_DIR=/tmp/shots bash scripts/verify-multiuser/run.sh
```

Exit-Code 0 = alle Checks bestanden. Voraussetzungen wie bei `verify-visits`
(`xvfb-run`, `sqlite3`, Display `:98`, Port `9222`). Die App bekommt ein eigenes
userData-Verzeichnis (`E2E_USER_DATA_DIR`), gespeicherte Einstellungen wirken
nicht in den Lauf. Laufzeit etwa 2–3 Minuten (die Sperr-Szenarien warten
absichtlich 6 s bzw. 24 s).

## Was geprüft wird

| Check | Mechanik |
|---|---|
| Fremde Änderung erscheint im Lesemodus ohne Nutzeraktion | `db-freshness-store` (`PRAGMA data_version`) + `useDbFreshness` |
| Banner statt Reload während der Bearbeitung, Editor behält Wert | `StaleDataBanner`, `isEditing` |
| Veraltetes Speichern wird abgelehnt, Konfliktwarnung, DB-Wert bleibt | `VERSION`-Guard, `StaleObservationError`, `refreshObservationById` |
| Banner „Aktualisieren“ lädt den fremden Stand | `useDbFreshness.refresh` |
| Write wartet auf 6-s-Sperre und gelingt | `busy_timeout = 4000` + `withBusyRetry` |
| 24-s-Sperre → Toast „gesperrt“, Wert unverändert | `db-errors` → `dbErrorBus` → `App.vue` |

## Sicherheitsregeln

Wie `verify-visits`: DB-Backup vor dem Lauf (bei Erfolg entfernt), Temp-Admin
`helpshot` nur für den Lauf, eigenes Display `:98`, Zeilenzahl-Integritätscheck.
Das Skript verändert genau EINE bestehende numerische Beobachtung (die hinter
dem ersten Zahlenfeld der obersten Visite) und stellt Wert und `PROVIDER_ID`
am Ende wieder her; `VERSION` dieser Zeile wächst dabei — das ist gewollt.
