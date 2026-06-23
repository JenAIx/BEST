# Neuen Fragebogen aufnehmen

Diese Anleitung beschreibt, wie ein gebündelter Fragebogen hinzugefügt wird — und
wie er **automatisch durch Tests erfasst** wird.

## 1. Datei anlegen

- Ablage: `src/assets/questionnaires/quest_<name>.json`
- Dateiname-Konvention: Präfix `quest_`, Endung `.json`.
- **`short_title` muss eindeutig** sein (über die gesamte Sammlung). Doppelte
  `short_title` überschreiben sich gegenseitig still — beim Bündeln gewinnt der
  zuletzt geladene Bogen.
- Zeilenenden: **LF** (durch `.gitattributes` erzwungen; CRLF wird vom Test
  `questionnaire_format.test.js` abgelehnt).

Es ist **keine Registrierung** nötig: `QuestMan` lädt alle `quest_*.json` per
`import.meta.glob` automatisch (siehe `src/tools/questman/QuestMan.js`).

## 2. Schema einhalten

Maßgeblich ist [`questionnaire.schema.json`](./questionnaire.schema.json) (Feld-
Referenz: [`DATA_MODEL_ITEMS.md`](./DATA_MODEL_ITEMS.md)). Kurzfassung:

- Pflicht-Top-Level: `title`, `short_title`, `items`. Empfohlen: `description`,
  `keywords`, `manual`, `coding`, `results`.
- Jedes Item braucht `type` (aus `ITEM_TYPES`) **und** `label`.
- `radio`/`checkbox`: nicht-leere `options: [{label, value}]`.
- `multiple_radio`: `options.questions: [{label, tag, id}]` + `options.answers: [{label, value}]`.
  Teilfragen-`id` ermöglicht Sub-Scoring (fehlt sie → Warnung, kein Fehler).
- Pflichtfeld-Logik: **`force` weglassen = Pflicht**; nur `force: false` macht optional.
- Bepunktete Items: Werte **numerisch** (nicht `"3"` als String).
- `coding.system` muss kanonisch sein: `http://snomed.info/sct`, `LOINC`, `CUSTOM`, `LEC-SEQ`.

Minimalbeispiel:

```json
{
  "title": "Beispiel-Skala",
  "short_title": "example",
  "description": "Kurzbeschreibung",
  "keywords": "demo, beispiel",
  "coding": { "system": "CUSTOM", "code": "EXAMPLE", "display": "Beispiel", "version": "2026-06-23" },
  "items": [
    { "type": "textbox", "label": "<b>Bitte alle Fragen beantworten.</b>" },
    { "id": 1, "type": "radio", "label": "Frage 1", "tag": "f1",
      "options": [ { "label": "nie", "value": 0 }, { "label": "oft", "value": 1 } ] }
  ],
  "results": { "method": "sum" }
}
```

## 3. Durch Tests „aufnehmen"

Ein neuer Bogen wird **ohne weiteres Zutun** von zwei Guards mitgeprüft:

- **Schema-Guard** `test/jest/__tests__/questman_scoring_schema.test.js` — validiert
  **jeden** gebündelten Bogen mit `validateQuestScoring`. Ein neuer Bogen muss
  **0 Errors** liefern (Warnungen sind ok). Schlägt fehl, wenn z. B. `type` fehlt,
  eine Scoring-`id` ins Leere zeigt oder `value/score`-Längen nicht passen.
- **Format-Guard** `test/jest/__tests__/questionnaire_format.test.js` — verlangt
  valides JSON und LF-Zeilenenden.

Ausführen:

```bash
npm run test:unit test/jest/__tests__/questman_scoring_schema.test.js
npm run test:unit            # gesamte Unit-Suite
```

Bei Fehlern listet der Guard Code + Meldung je Bogen; der vollständige Report liegt
in `test/jest/scoring_schema_report.json`.

### Empfohlen für bepunktete Bögen: E2E-Scoring festnageln

Skalen mit Score sollten zusätzlich einen Fall in
`test/cypress/integration/quest_store_coverage.spec.js` bekommen: Bogen über die
echte UI ausfüllen und die erwarteten `summary.results` (Hand berechnet) prüfen.
Das sichert die Scoring-Definition gegen Regressionen.

## 4. Import über die UI (Alternative zum Datei-Commit)

`QuestManager → Importieren` nimmt denselben JSON-Text an. `QuestMan.add()` führt
**dieselbe** Validierung aus und lehnt ungültige Bögen mit klarer Fehlermeldung ab
(`{ ok, errors }`). So importierte Bögen liegen in IndexedDB (nutzer-, nicht
repo-seitig) und sind nicht durch die Test-Guards abgedeckt — für dauerhafte,
getestete Bögen daher als Datei committen.
