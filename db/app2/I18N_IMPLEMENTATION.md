# Internationalisierung (i18n) Implementation

## Übersicht

Vue I18n wurde erfolgreich in die BEST Medical System App integriert. Die App unterstützt jetzt Deutsch (Standard) und Englisch.

## Implementierte Komponenten

### ✅ Vollständig übersetzt:

1. **MainLayout** - Navigation, Header, Sidebar
2. **LoginPage** - Anmeldeseite
3. **DashboardPage** - Dashboard mit Karten und Statistiken
4. **CustomObservationDialog** - Beobachtungen hinzufügen
5. **SmartButton Komponenten:**
   - AskAIWidget
   - NotesWidget
   - UnitConverterWidget
   - BmiCalculatorWidget
   - RewritePlugin
   - LevodopaCalculatorWidget
6. **LocalSettingsForm** - Lokale Einstellungen
7. **StudySearchPage** - Studiensuche
8. **UserManagementPage** - Benutzerverwaltung
9. **QuestionnairePage** - Fragebogen-Seite
10. **LanguageSwitcher** - Sprachauswahl-Komponente

### 📁 Dateistruktur:

```
src/
├── i18n/
│   ├── index.js                 # I18n Konfiguration
│   └── locales/
│       ├── de.json             # Deutsche Übersetzungen
│       └── en.json             # Englische Übersetzungen
├── boot/
│   └── i18n.js                 # Quasar Boot-Datei
└── components/shared/
    └── LanguageSwitcher.vue    # Sprachauswahl-Komponente
```

## Übersetzungskategorien

### Common (Allgemein)

- Basis-Aktionen: save, cancel, delete, edit, add, search, etc.
- Navigation: dashboard, settings, logout, etc.
- Status: connected, disconnected, loading, etc.

### Auth (Authentifizierung)

- Login-Formular und Fehlermeldungen
- Datenbank-Auswahl
- Session-Management

### Dashboard

- Karten-Titel und Untertitel
- Statistiken und Schnellzugriffe

### Navigation

- Sidebar-Menüpunkte
- Breadcrumbs
- Sektionsüberschriften

### Patient Management

- Patientendaten-Felder
- Such- und Filterfunktionen

### Visit Management

- Besuchstypen und -status
- Zeitlinien-Elemente

### Observation Management

- Konzept-Suche
- Kategorien und Werte

### Questionnaire Management

- Fragebogen-Schritte
- Fragen und Antworten

### Study Management

- Studien-Metadaten
- Filter und Suchoptionen

### User Management

- Benutzerrollen und -status
- Berechtigungen

### Settings

- API-Schlüssel-Verwaltung
- Sprach- und Erscheinungseinstellungen

### Smart Button Features

- KI-Chat
- Einheitenkonverter
- BMI-Rechner
- Levodopa-Rechner
- Text-Umschreibung
- Notizen

### Validation & Messages

- Formular-Validierung
- Erfolgs- und Fehlermeldungen
- System-Benachrichtigungen

## Verwendung

### In Templates:

```vue
<!-- Einfache Übersetzung -->
<q-btn :label="$t('common.save')" />

<!-- Mit Interpolation -->
<div>{{ $t('dashboard.totalPatients') }}: {{ count }}</div>

<!-- In Attributen -->
<q-input :placeholder="$t('auth.username')" />
```

### In Script Setup:

```javascript
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const message = t('messages.saveSuccess')
```

## Sprachauswahl

Der LanguageSwitcher ist im Header der MainLayout integriert und erlaubt es Benutzern, zwischen Deutsch und Englisch zu wechseln. Die gewählte Sprache wird im localStorage gespeichert.

## Standardsprache

- **Standard**: Deutsch (de)
- **Fallback**: Deutsch (de)
- **Browser-Erkennung**: Ja, mit Fallback auf Deutsch

## Nächste Schritte

Weitere Komponenten können nach dem gleichen Muster übersetzt werden:

1. Texte in der Komponente identifizieren
2. Übersetzungskeys in de.json und en.json hinzufügen
3. Template mit $t() Funktionen aktualisieren
4. Testen und validieren
