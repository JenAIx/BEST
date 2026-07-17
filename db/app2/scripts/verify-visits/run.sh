#!/usr/bin/env bash
# E2E-Testroutine für die vereinheitlichte Visitenansicht ("Zeitlinie neu").
#
# Macht den kompletten Ablauf reproduzierbar:
#   1. DB-Backup (wird bei vollem Erfolg wieder gelöscht)
#   2. Temp-Admin "helpshot" anlegen (nur für diesen Lauf, danach gelöscht)
#   3. App headless starten (eigenes Display :98 — kollidiert NIE mit dem
#      VNC-Setup auf :99; CDP auf $REMOTE_DEBUG_PORT, default 9222)
#   4. scripts/verify-visits/verify.mjs ausführen (PASS/FAIL-Checks)
#   5. App stoppen (nur die eigenen Prozesse!), Temp-User löschen
#   6. Integritätscheck: Zeilenzahlen vorher/nachher müssen identisch sein
#
# Usage:  bash scripts/verify-visits/run.sh
# Env:    VERIFY_PATIENT (PATIENT_CD, default 10002506), REMOTE_DEBUG_PORT,
#         SHOT_DIR (optional: Screenshots)

set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DB=database/production.db
PATIENT_CD="${VERIFY_PATIENT:-10002506}"
PORT="${REMOTE_DEBUG_PORT:-9222}"
DISPLAY_NUM=98
STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP=database/backup_verify_${STAMP}.db
LOG=/tmp/verify-visits-app.log

cleanup_app() {
  # NUR eigene Prozesse: das eigene Display, der eigene App-Start.
  # Niemals pauschal "pkill Xvfb" — das killt das VNC-Setup auf :99!
  [ -n "${APP_PID:-}" ] && kill "$APP_PID" 2>/dev/null
  sleep 2
  pkill -f "Xvfb :${DISPLAY_NUM}" 2>/dev/null
  pkill -f "remote-debugging-port=${PORT}" 2>/dev/null
  rm -f "/tmp/.X${DISPLAY_NUM}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM}"
  true
}

# Läuft IMMER (auch bei Fehler/Ctrl-C): App stoppen + Temp-Admin entfernen —
# der helpshot-User darf die Routine unter keinen Umständen überleben
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
REMOTE_DEBUG_PORT=$PORT xvfb-run -n $DISPLAY_NUM \
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
CDP_URL="http://127.0.0.1:${PORT}" VERIFY_PATIENT="$PATIENT_CD" node scripts/verify-visits/verify.mjs
RC=$?

echo "5/6 App stoppen + Temp-User löschen"
cleanup_all

echo "6/6 Integritätscheck"
after_visits=$(sqlite3 "$DB" "SELECT COUNT(*) FROM VISIT_DIMENSION;")
after_obs=$(sqlite3 "$DB" "SELECT COUNT(*) FROM OBSERVATION_FACT;")
if [ "$before_visits" != "$after_visits" ] || [ "$before_obs" != "$after_obs" ]; then
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "!! DATEN VERÄNDERT: Visiten $before_visits→$after_visits, Beobachtungen $before_obs→$after_obs"
  echo "!! Backup NICHT gelöscht: $BACKUP"
  echo "!! Wiederherstellen einzelner Zeilen:  sqlite3 $DB  →  ATTACH '$BACKUP' AS bak; INSERT INTO ... SELECT ... FROM bak....;"
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
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
