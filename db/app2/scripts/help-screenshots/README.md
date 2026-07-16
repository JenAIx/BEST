# Help-Page Screenshots

Erzeugt die Screenshots für die In-App-Hilfe (`/help`, Dateien in `public/help/`).

## Ablauf

1. **App headless mit CDP starten** (eigenes Terminal):

   ```bash
   REMOTE_DEBUG_PORT=9222 xvfb-run -a \
     --server-args="-screen 0 1600x900x24 -ac -nolisten tcp" \
     npx quasar dev -m electron
   ```

   `REMOTE_DEBUG_PORT` aktiviert das Chrome-DevTools-Protokoll
   (Schalter in `src-electron/electron-main.js`, nur wenn gesetzt).

2. **Capture laufen lassen**:

   ```bash
   HELP_USER=<benutzer> HELP_PASS=<passwort> node scripts/help-screenshots/capture.js
   ```

   Umgebungsvariablen:

   | Variable | Default | Zweck |
   |---|---|---|
   | `HELP_USER` / `HELP_PASS` | `ste` / `123` | Login (Admin empfohlen, sonst fehlen Admin-Seiten) |
   | `HELP_PATIENT` | `10000559` | Patient für die Besuchs-Screenshots |
   | `HELP_STUDY` | `4` | Studien-ID für die Detailseite |
   | `ONLY_MISSING=1` | – | nur fehlende PNGs nachschießen |
   | `CDP_URL` | `http://localhost:9222` | DevTools-Endpoint |

3. Ergebnis prüfen (`public/help/*.png`, 1600×900) und committen.

## Hinweise

- Das Skript ist crash-resilient: Stürzt der Renderer ab (kommt mit dem
  nativen SQLite-Modul unter Xvfb gelegentlich vor), lädt es die Seite neu,
  meldet sich wieder an und wiederholt den Schritt. Der Grid-Editor wird
  deshalb als letzter Schritt aufgenommen.
- Der Studien-Merker (`/studies` öffnet die letzte Studie) wird vor dem
  Studienlisten-Screenshot per localStorage zurückgesetzt.
- Neue Screenshots: in `capture.js` einen `step('#/route', 'name')`-Eintrag
  ergänzen und das Bild in `src/pages/HelpPage.vue` referenzieren
  (`image: 'name'`).
