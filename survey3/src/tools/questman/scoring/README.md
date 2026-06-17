# Scoring-Engine — `results`-Schema

Diese Engine berechnet aus den Antworten eines Fragebogens dessen Auswertung. Die
Berechnung ist **deklarativ**: die gesamte Logik steckt im `results`-Block der
Fragebogen-JSON (`src/assets/questionnaires/quest_*.json`), die Engine ist generisch.

- Eingang: `QuestMan.summary` baut aus den Items eine Liste `result.items`
  (`{ id?, value, label, coding? }`) und ruft `calc_results(result, quest.results)`.
- Module: ein Auswerte-Pfad je Datei (`sum`, `avg`, `count`, `ids`), `evaluate` für die
  Bereichs-Bewertung, `utils` für geteilte Helfer.
- **Invarianten werden maschinell geprüft** von `../validate.js` (Test:
  `test/jest/__tests__/questman_scoring_schema.test.js`). Diese Datei ist die
  ausführbare Quelle der Wahrheit; das README erklärt das Warum.

---

## Top-Level: `results.method`

| method | Modul | Bedeutung |
|---|---|---|
| `sum` | `sum.js` | Summe aller numerischen Item-Werte (Strings/`ignore_for_result` ignoriert). |
| `avg` | `avg.js` | Mittelwert aller numerischen Item-Werte (2 Nachkommastellen, 0-sicher). |
| `count` | `count.js` | Häufigkeit je distinktem Antwortwert. |
| `count_targets` | `count.js` | Treffer gegen Zielwerte, gewichtet mit `target.score`. |
| `ids` | `ids.js` | Zweistufiges Scoring (Item-Scores → Domänen). Für klinische Skalen. |

Optional zusätzlich: `coding` (für `sum`/`avg`-Resultat) und `evaluation` (s.u.).

---

## `ids` — das zweistufige Modell

```jsonc
"results": {
  "method": "ids",
  "scoring": [ /* Stufe 1: Item -> Punktwert */ ],
  "domaine": [ /* Stufe 2: Aggregation zu Subskalen/Summe */ ],
  "evaluation": [ /* optional: Summe -> Befund-Label */ ]
}
```

### Stufe 1 — `scoring[]` (Item-Score je `id`)

Jeder Eintrag ordnet den genannten `id`s einen Punktwert zu.

| Form | Beispiel | Verhalten |
|---|---|---|
| value→score-Mapping | `{ "id":[1,2], "value":[0,1,2,3], "score":[0,1,2,3] }` | `score[indexOf(value)]`. Bei Array-Wert (Checkbox) Summe aller Treffer. Kein Treffer → 0. |
| `raw` | `{ "id":[4], "method":"raw" }` | Wert direkt als Score. |
| `multiply` | `{ "id":[31], "method":"multiply", "value":10 }` | `wert * value`. |
| `range` | `{ "id":[2], "method":"range", "range":[{ "value":[0,15], "score":0 }, …] }` | Bande `value[0] ≤ x ≤ value[1]` → `score`; letzte passende gewinnt. |
| `count` | `{ "id":[1], "method":"count" }` | Länge des Array-Werts (Checkbox-Anzahl). |

**Semantik bei mehreren passenden Einträgen:** Methoden-Einträge (`raw`/`multiply`/
`range`/`count`) **ersetzen** den Score (letzter gewinnt); value→score-Einträge
**addieren**. `value[]` und `score[]` müssen gleich lang sein (Validator: `VALUE_SCORE_LENGTH`).

### Stufe 2 — `domaine[]` (Subskalen & Summe)

Jeder Eintrag `{ label, id, method, … }` aggregiert über `id[]`. Ein `id`-Eintrag ist:
- eine **Zahl** → Item-Score aus Stufe 1, oder
- ein **String** → `value` einer **zuvor** definierten Domäne (Verkettung).

Domänen werden in Array-Reihenfolge berechnet; eine String-Referenz muss auf eine
**vorher** stehende Domäne zeigen (Validator: `DOMAIN_REF_UNRESOLVED`).

| method | Aggregation |
|---|---|
| `sum` | Summe der Beiträge. |
| `avg` | Summe / Anzahl `id`. Mit `"ignore_zeros": true` zählt der Divisor nur Beiträge ≠ 0. |
| `multiply` | Produkt der Beiträge. |
| `sum_multiply` | Summe `* value`. |
| `avg_multiply` | Mittelwert `* value`. (Zählt bei String-Referenzen nicht zur Summe — Alt-Verhalten.) |
| `sum_sub_multiply` | `(Summe - value[0]) * value[1]`. |
| `sum_range` | Summe → Banden-Mapping über `sum_range` (wie `range`). |
| `diff_range` | Differenz der Beiträge → Banden-Mapping. (Kein aktiver Repo-Vertreter.) |

Resultate werden auf 2 Nachkommastellen gerundet.

#### `internal`-Flag

Eine Domäne mit `"internal": true` wird weiterhin **berechnet** (steht also für
String-Referenzen zur Verfügung), aber **nicht** im Ergebnis/Export ausgegeben — für
reine Rechen-Zwischengrößen (z.B. TWSTRS `Schmerzgrad`, das nur `III_Schmerz` speist).

---

## `evaluation[]` — Befund aus der Summe

```jsonc
"evaluation": [ { "range": [0, 12], "label": "klinisch unauffällig" }, … ]
```

Setzt `evaluation` am Resultat mit `label === "sum"`, wenn dessen Wert in eine Bande
fällt. Wirkt ausschließlich auf `sum`.

---

## Item-Ebene: relevante Felder

- `id` — verknüpft ein Item mit `scoring`/`domaine`. Bei `multiple_radio` tragen die
  **Sub-Fragen** die IDs (`options.questions[].id`); das Item selbst kann ein `id`-Array führen.
- `ignore_for_result: true` — schließt das Item aus `sum`/`avg` aus.
- Antwortwerte müssen **numerisch** sein, wo numerisch gescort wird (String-Zahlen wie
  `"3"` werden von `sum`/`avg` ignoriert und matchen nicht in numerischen value→score-
  Arrays). Validator: `STRING_NUMERIC`.

---

## Validator-Codes (Kurzreferenz)

`UNKNOWN_METHOD` · `UNKNOWN_SCORING_METHOD` · `UNKNOWN_DOMAIN_METHOD` ·
`SCORING_ID_MISSING` · `DOMAIN_ID_MISSING` · `DOMAIN_REF_UNRESOLVED` ·
`VALUE_SCORE_LENGTH` · `STRING_NUMERIC` · (WARN) `LABEL_WHITESPACE` · `LABEL_DUPLICATE`

Siehe `../validate.js` für die genauen Prüfungen.
