#!/usr/bin/env bash
# E2E: zwei Schreiber auf EINER Datenbankdatei (Mehrbenutzer-Verhalten).
# Instanz A = headless App (CDP), Instanz B = zweite SQLite-Connection im
# Prüfskript. Gleiche Sicherheitsregeln wie scripts/verify-visits/run.sh:
# Backup, Temp-User, eigenes Display :98, eigenes userData-Verzeichnis,
# Zeilenzahl-Integritätscheck.
#
# Usage:  bash scripts/verify-multiuser/run.sh
# Env:    VERIFY_PATIENT (PATIENT_CD, default 10002506), REMOTE_DEBUG_PORT, SHOT_DIR

set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DB=database/production.db
PATIENT_CD="${VERIFY_PATIENT:-10002506}"
PORT="${REMOTE_DEBUG_PORT:-9222}"
DISPLAY_NUM=98
STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP=database/backup_multiuser_${STAMP}.db
LOG=/tmp/verify-multiuser-app.log
USER_DATA_DIR=/tmp/best-e2e-userdata-mu-${STAMP}

cleanup_app() {
  [ -n "${APP_PID:-}" ] && kill "$APP_PID" 2>/dev/null
  sleep 2
  pkill -f "Xvfb :${DISPLAY_NUM}" 2>/dev/null
  pkill -f "remote-debugging-port=${PORT}" 2>/dev/null
  rm -f "/tmp/.X${DISPLAY_NUM}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM}"
  rm -rf "$USER_DATA_DIR" 2>/dev/null || { sleep 2; rm -rf "$USER_DATA_DIR" 2>/dev/null; }
  true
}
cleanup_all() {
  cleanup_app
  sqlite3 "$DB" "DELETE FROM USER_MANAGEMENT WHERE USER_CD='helpshot';" 2>/dev/null || echo "WARNUNG: helpshot konnte nicht gelöscht werden — manuell entfernen!"
}
trap cleanup_all EXIT INT TERM

echo "1/6 Backup → $BACKUP"
cp "$DB" "$BACKUP" || exit 1
before_visits=$(sqlite3 "$DB" "SELECT COUNT(*) FROM VISIT_DIMENSION;")
before_obs=$(sqlite3 "$DB" "SELECT COUNT(*) FROM OBSERVATION_FACT;")
echo "    Ausgangszustand: $before_visits Visiten, $before_obs Beobachtungen"

echo "2/6 Temp-User helpshot anlegen"
sqlite3 "$DB" "INSERT OR IGNORE INTO USER_MANAGEMENT (COLUMN_CD, USER_CD, NAME_CHAR, PASSWORD_CHAR, UPDATE_DATE, IMPORT_DATE, UPLOAD_ID, MUST_CHANGE_PASSWORD)
  VALUES ('admin','helpshot','Temp Verify User','helpshot-temp-2026', datetime('now'), datetime('now'), 1, 0);" || { rm -f "$BACKUP"; exit 1; }

echo "3/6 App starten (Display :${DISPLAY_NUM}, CDP :${PORT}) — Log: $LOG"
rm -f "/tmp/.X${DISPLAY_NUM}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM}"
E2E_USER_DATA_DIR="$USER_DATA_DIR" REMOTE_DEBUG_PORT=$PORT xvfb-run -n $DISPLAY_NUM \
  --server-args="-screen 0 1600x900x24 -ac -nolisten tcp -dpi 96" \
  npx quasar dev -m electron >"$LOG" 2>&1 &
APP_PID=$!

for i in $(seq 1 120); do
  curl -s -m 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1 && break
  kill -0 "$APP_PID" 2>/dev/null || { echo "FEHLER: App-Start abgebrochen (siehe $LOG)"; exit 1; }
  sleep 1
done
curl -s -m 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1 || { echo "FEHLER: CDP nach 120s nicht erreichbar (siehe $LOG)"; exit 1; }
sleep 8

echo "4/6 Verifikation läuft…"
CDP_URL="http://127.0.0.1:${PORT}" VERIFY_PATIENT="$PATIENT_CD" VERIFY_DB="$DB" node scripts/verify-multiuser/verify.mjs
RC=$?

echo "5/6 App stoppen + Temp-User löschen"
cleanup_all

echo "6/6 Integritätscheck"
after_visits=$(sqlite3 "$DB" "SELECT COUNT(*) FROM VISIT_DIMENSION;")
after_obs=$(sqlite3 "$DB" "SELECT COUNT(*) FROM OBSERVATION_FACT;")
if [ "$before_visits" != "$after_visits" ] || [ "$before_obs" != "$after_obs" ]; then
  echo "!! DATEN VERÄNDERT: Visiten $before_visits→$after_visits, Beobachtungen $before_obs→$after_obs — Backup bleibt: $BACKUP"
  exit 1
fi
echo "    OK — Zeilenzahlen unverändert"

if [ $RC -eq 0 ]; then
  rm -f "$BACKUP"
  echo "ERFOLG — alle Checks bestanden, Backup entfernt"
else
  echo "FEHLSCHLAG — Checks siehe oben; Backup bleibt: $BACKUP"
fi
exit $RC
