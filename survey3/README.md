# surveyBEST (survey3)

A Quasar/Vue questionnaire application for researchers and clinicians. Questionnaires are defined as JSON files and automatically discovered at build time.

## Install the dependencies
```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
quasar dev
```

### Lint the files
```bash
yarn lint
# or
npm run lint
```

### Format the files
```bash
yarn format
# or
npm run format
```

### Build the app for production
```bash
quasar build
```

### Run tests
```bash
npm run test:unit
# or run specific test files:
npx jest test/jest/__tests__/scoring.test.js
npx jest test/jest/__tests__/questman_validation.test.js
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-webpack/quasar-config-js).

---

## Questionnaire JSON Format

All questionnaires live in `src/assets/questionnaires/` and must be named `quest_*.json`. They are auto-discovered at build time via Vite's `import.meta.glob` — no manual registration is needed.

### Top-Level Structure

```json
{
  "title": "BDI 2",
  "short_title": "bdi2",
  "coding": { ... },
  "description": "Brief description shown in the selection list",
  "manual": "<b>HTML instructions</b> shown above the items",
  "keywords": "depression psych screening",
  "items": [ ... ],
  "results": { ... }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | yes | Full display title of the questionnaire |
| `short_title` | string | yes | Unique identifier (used as key in the quest store, filenames, routing) |
| `coding` | object | no | Clinical coding metadata (SNOMED CT, LOINC, or custom) |
| `description` | string | no | Short description shown in the quest selection list |
| `manual` | string | no | HTML-formatted instructions shown to the user above the items |
| `keywords` | string | no | Space-separated keywords for search/filtering |
| `items` | array | yes | The questionnaire items (questions, separators, etc.) |
| `results` | object | no | Scoring/calculation configuration |

### Coding Object

Used at the questionnaire level, item level, and domaine level for clinical interoperability:

```json
{
  "system": "http://snomed.info/sct",
  "code": "SCTID: 717268000",
  "display": "Becks depression inventar II",
  "version": "20230124"
}
```

For non-standard instruments, use `"system": "CUSTOM"`.

---

### Items

The `items` array contains the questions and UI elements of the questionnaire. Each item is an object with a `type` field that determines its rendering.

#### Common Item Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | string | yes | The question text (supports HTML) |
| `caption` | string | no | Additional explanatory text below the label |
| `type` | string | yes* | Item type (see below). *Omit for plain text/instruction items |
| `value` | any | yes* | Initial value (`null` for unanswered, `[]` for multi-select). *Not needed for separators/textboxes |
| `id` | number | no | Numeric ID used by the `ids` scoring method to reference this item |
| `tag` | string | no | String tag used as the result label in the output |
| `coding` | object | no | Clinical coding for this specific item |
| `force` | boolean | no | If `false`, the item is not required for form validation (default: required) |
| `inline` | boolean | no | If `true`, render options inline (horizontal) |
| `ignore_for_result` | boolean | no | If `true`, the item's value is excluded from result calculations |

#### Item Types

##### `radio` — Single Choice

The most common type. User selects one option from a list.

```json
{
  "label": "1. Sadness",
  "tag": "sadness",
  "id": 1,
  "value": null,
  "type": "radio",
  "inline": false,
  "options": [
    { "label": "I do not feel sad", "value": 0 },
    { "label": "I feel sad much of the time", "value": 1 },
    { "label": "I am sad all the time", "value": 2 },
    { "label": "I am so sad that I can't stand it", "value": 3 }
  ]
}
```

Each option has a `label` (display text) and a `value` (numeric or string, stored as the answer).

##### `checkbox` — Multiple Choice

User can select multiple options. The `value` is an array.

```json
{
  "label": "Select all that apply",
  "tag": "symptoms",
  "value": [],
  "type": "checkbox",
  "options": [
    { "label": "Headache", "value": 0 },
    { "label": "Fatigue", "value": 1 },
    { "label": "Nausea", "value": 2 }
  ]
}
```

##### `multiple_radio` — Matrix / Likert Scale

A grid of questions sharing the same answer options. Each sub-question gets its own answer. The `id` field is an array of IDs (one per sub-question), and `value` is an array of answers.

```json
{
  "label": "Rate the following statements",
  "tag": "Q1",
  "id": [1, 2, 3],
  "value": [],
  "type": "multiple_radio",
  "options": {
    "answers": [
      { "label": "Strongly disagree", "value": 1 },
      { "label": "Disagree", "value": 2 },
      { "label": "Neutral", "value": 3 },
      { "label": "Agree", "value": 4 },
      { "label": "Strongly agree", "value": 5 }
    ],
    "questions": [
      { "id": 1, "label": "I am reserved", "tag": "1", "coding": { ... } },
      { "id": 2, "label": "I trust others", "tag": "2", "coding": { ... } },
      { "id": 3, "label": "I am thorough", "tag": "3", "coding": { ... } }
    ]
  }
}
```

Each entry in `questions` can have its own `id`, `tag`, and `coding`.

##### `text` — Free Text Input

```json
{
  "label": "Profession",
  "tag": "profession",
  "value": null,
  "type": "text",
  "force": true
}
```

##### `number` — Numeric Input

```json
{
  "label": "Age",
  "tag": "age",
  "value": null,
  "type": "number",
  "force": false
}
```

String values are automatically converted to numbers in the summary.

##### `slider` — Slider Input

```json
{
  "label": "Confidence level (%)",
  "tag": "confidence",
  "value": null,
  "type": "slider",
  "id": 1
}
```

##### `date` — Date Input

```json
{
  "label": "Date of onset",
  "tag": "onset_date",
  "value": null,
  "type": "date"
}
```

##### `date_year` — Year-Only Input

```json
{
  "label": "Year of diagnosis",
  "value": null,
  "type": "date_year"
}
```

##### `time` — Time Input

```json
{
  "label": "Usual bedtime",
  "tag": "bedtime",
  "value": null,
  "type": "time",
  "id": 1
}
```

##### `separator` / `seperator` — Section Divider

A visual separator with an optional label and caption. Not an answerable item. Both spellings are supported.

```json
{
  "label": "Section 2: Physical Health",
  "caption": "The following questions ask about your physical health",
  "type": "separator"
}
```

##### `textbox` — Instructional Text Block

A non-interactive text block, used to display instructions or information mid-questionnaire.

```json
{
  "label": "Please read the following carefully before continuing."
}
```

Items with no `type` field or `type: "textbox"` are treated as non-interactive display elements.

##### `image` — Image Display

Displays images from the `public/img/` directory.

```json
{
  "label": "Reference image",
  "type": "image",
  "value": ["image1.png", "image2.png"],
  "width": 200
}
```

---

### Results / Scoring

The `results` object defines how item values are aggregated into scores. If omitted, no scoring is performed.

```json
{
  "results": {
    "method": "sum"
  }
}
```

#### Scoring Methods

##### `sum` — Simple Sum

Adds up all numeric item values.

```json
{ "method": "sum" }
```

Returns: `[{ "label": "sum", "value": <total> }]`

##### `avg` — Simple Average

Averages all numeric item values.

```json
{ "method": "avg" }
```

Returns: `[{ "label": "avg", "value": <average> }]`

##### `count` — Value Frequency Count

Counts how often each unique value appears.

```json
{ "method": "count" }
```

Returns: `[{ "label": <value>, "value": <count>, "total": <n> }, ...]`

##### `count_targets` — Target Value Count

Counts occurrences of specific target values and assigns scores.

```json
{
  "method": "count_targets",
  "targets": [
    { "label": "Yes responses", "value": "yes", "score": 1 },
    { "label": "No responses", "value": "no", "score": 1 }
  ]
}
```

##### `ids` — ID-Based Scoring with Domaines

The most powerful scoring method. Items are identified by their `id` field, scored individually via `scoring` rules, then grouped into `domaine` subscales.

```json
{
  "method": "ids",
  "scoring": [ ... ],
  "domaine": [ ... ],
  "evaluation": [ ... ]
}
```

#### Scoring Rules (used with `ids` method)

The `scoring` array defines how raw item values are converted to scores:

```json
"scoring": [
  { "id": [1, 2, 3], "value": [0, 1, 2, 3], "score": [0, 1, 2, 3] },
  { "id": [4, 5],    "value": [0, 1, 2, 3], "score": [3, 2, 1, 0] }
]
```

Each scoring rule has:
- `id`: array of item IDs this rule applies to
- `value`: array of possible answer values
- `score`: array of scores corresponding to each value (same index)

The scoring engine uses `indexOf` to find the position of the item's value in the `value` array, then looks up the score at the same position in the `score` array. This allows for reverse scoring (e.g., `[3, 2, 1, 0]`).

**Special scoring methods** (set via the `method` field on a scoring rule):

| Method | Description | Example |
|---|---|---|
| `raw` | Use the item's value directly as the score | `{ "id": [1], "method": "raw" }` |
| `multiply` | Multiply the item's value by a constant | `{ "id": [1], "method": "multiply", "value": 2.5 }` |
| `range` | Map the value to a score based on numeric ranges | `{ "id": [1], "method": "range", "range": [{ "value": [0, 10], "score": 1 }, { "value": [11, 20], "score": 2 }] }` |
| `count` | Use the length of the value array (for checkbox items) | `{ "id": [1], "method": "count" }` |

#### Domaines (Subscales)

The `domaine` array groups scored items into subscales and defines how they are aggregated:

```json
"domaine": [
  {
    "label": "Extraversion",
    "id": [1, 6],
    "method": "avg",
    "coding": { "display": "BFI-10 Extraversion", "code": "CUSTOM", "system": "CUSTOM" }
  },
  {
    "label": "sum",
    "id": [1, 2, 3, 4, 5],
    "method": "sum"
  }
]
```

Each domaine has:

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | string | yes | Name of the subscale (use `"sum"` if you want the `evaluate` step to match it) |
| `id` | array | yes | Item IDs (numbers) or other domaine labels (strings) to include |
| `method` | string | yes | Aggregation method (see below) |
| `coding` | object | no | Clinical coding for this subscale |
| `value` | number/array | no | Used by `sum_multiply` and `sum_sub_multiply` methods |
| `ignore_zeros` | boolean | no | If `true` with `avg`, zero-scored items are excluded from the divisor |

**Domaine aggregation methods:**

| Method | Description |
|---|---|
| `sum` | Sum of all item scores in this domaine |
| `avg` | Average of all item scores. With `ignore_zeros: true`, items scoring 0 are excluded from the average |
| `multiply` | Multiply all item scores together |
| `sum_multiply` | Sum all scores, then multiply by `value` |
| `avg_multiply` | Average all scores, then multiply by `value` |
| `sum_range` | Sum all scores, then map through `sum_range` ranges |
| `diff_range` | Subtract sequential values, then map through `sum_range` ranges |
| `sum_sub_multiply` | Sum, subtract `value[0]`, then multiply by `value[1]`: `(sum - value[0]) * value[1]` |

**Cross-referencing domaines:** A domaine's `id` array can contain strings that reference other domaine labels. This allows building composite scores:

```json
"domaine": [
  { "label": "sub1", "id": [1, 2, 3], "method": "sum" },
  { "label": "sub2", "id": [4, 5, 6], "method": "sum" },
  { "label": "total", "id": ["sub1", "sub2"], "method": "sum" }
]
```

Domaines are evaluated in order, so referenced domaines must appear earlier in the array.

#### Evaluation

Optional. Maps the final score to a clinical interpretation label. Only matches domaines with `label: "sum"`.

```json
"evaluation": [
  { "range": [0, 12], "label": "clinically unremarkable" },
  { "range": [13, 19], "label": "mild depressive syndrome" },
  { "range": [20, 28], "label": "moderate depressive syndrome" },
  { "range": [29, 99], "label": "severe depressive syndrome" }
]
```

Ranges are inclusive on both ends (`[min, max]`).

---

### Complete Example

A minimal but fully functional questionnaire with `ids` scoring:

```json
{
  "title": "Example Questionnaire",
  "short_title": "example",
  "description": "A demonstration questionnaire",
  "manual": "<b>Instructions:</b> Answer each question honestly.",
  "keywords": "example demo",
  "items": [
    {
      "label": "Section: Mood",
      "type": "separator"
    },
    {
      "label": "1. How is your mood?",
      "tag": "mood",
      "id": 1,
      "value": null,
      "type": "radio",
      "options": [
        { "label": "Very bad", "value": 0 },
        { "label": "Bad", "value": 1 },
        { "label": "Okay", "value": 2 },
        { "label": "Good", "value": 3 },
        { "label": "Very good", "value": 4 }
      ]
    },
    {
      "label": "2. How is your energy?",
      "tag": "energy",
      "id": 2,
      "value": null,
      "type": "radio",
      "options": [
        { "label": "Very low", "value": 0 },
        { "label": "Low", "value": 1 },
        { "label": "Normal", "value": 2 },
        { "label": "High", "value": 3 },
        { "label": "Very high", "value": 4 }
      ]
    },
    {
      "label": "Notes (optional)",
      "tag": "notes",
      "value": null,
      "type": "text",
      "force": false
    }
  ],
  "results": {
    "method": "ids",
    "scoring": [
      { "id": [1, 2], "value": [0, 1, 2, 3, 4], "score": [0, 1, 2, 3, 4] }
    ],
    "domaine": [
      { "label": "sum", "id": [1, 2], "method": "sum" }
    ],
    "evaluation": [
      { "range": [0, 3], "label": "low wellbeing" },
      { "range": [4, 6], "label": "moderate wellbeing" },
      { "range": [7, 8], "label": "high wellbeing" }
    ]
  }
}
```

### Adding a New Questionnaire

1. Create a file `src/assets/questionnaires/quest_<short_title>.json`
2. Define the JSON structure following the schema above
3. The questionnaire will be automatically discovered on the next build/dev server restart
4. No code changes are needed — the Vite glob import picks up all `quest_*.json` files

Alternatively, questionnaires can be added at runtime via the app's "Add Questionnaire" feature, which stores them in `localStorage` as user quests.
