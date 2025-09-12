# BEST - Scientific DB Manager

A modern research database for neuroscientific data built with Vue 3, Quasar, and SQLite.

## Features

- **MVC Architecture**: Clean Model-View-Controller pattern with separated concerns
- **SQLite Database**: Local database with proper migrations and schema management
- **Patient Management**: Full CRUD operations for patient data
- **Visit Management**: Medical encounter tracking and lifecycle management
- **Clinical Observations**: Multi-type value storage (Numeric, Text, BLOB) with analytics
- **Data Validation**: Comprehensive validation layer with CQL rule integration
- **Service Layer**: Business logic coordination between models and views
- **Data Transformers**: Clean data mapping and formatting utilities
- **Migration System**: Automated database schema management with seed data
- **Type Safety**: Modern JavaScript with proper error handling and validation
- **Responsive UI**: Beautiful Quasar-based interface
- **SmartButton Plugin System**: Extensible movable FAB with medical utility plugins
- **Internationalization (I18n)**: Complete Vue I18n integration with German/English support
- **Comprehensive Testing**: 326 tests with 100% pass rate

## Database Schema

The application uses a **star schema** design optimized for clinical research data:

### DB Design (Star Schema)

```
                    ┌─────────────────┐
                    │  CONCEPT_DIM    │
                    │ ┌─────────────┐ │
                    │ │ CONCEPT_CD  │ │◄──┐
                    │ │ NAME_CHAR   │ │   │
                    │ │ CONCEPT_PATH│ │   │
                    │ └─────────────┘ │   │
                    └─────────────────┘   │
                             ▲            │
                             │            │
    ┌─────────────────┐     │     ┌──────┴──────────┐
    │  PROVIDER_DIM   │     │     │ OBSERVATION_FACT │
    │ ┌─────────────┐ │     │     │ ┌──────────────┐│
    │ │ PROVIDER_ID │ │◄────┼─────┤ │ PATIENT_NUM  ││
    │ │ NAME_CHAR   │ │     │     │ │ ENCOUNTER_NUM││
    │ └─────────────┘ │     │     │ │ CONCEPT_CD   ││◄─┘
    └─────────────────┘     │     │ │ PROVIDER_ID  ││
                            │     │ │ TVAL_CHAR    ││
    ┌─────────────────┐     │     │ │ NVAL_NUM     ││
    │  PATIENT_DIM    │     │     │ └──────────────┘│
    │ ┌─────────────┐ │     │     └─────────────────┘
    │ │ PATIENT_NUM │ │◄────┘              ▲
    │ │ PATIENT_CD  │ │                    │
    │ │ SEX_CD      │ │                    │
    │ │ AGE_YEARS   │ │     ┌─────────────────┐
    │ └─────────────┘ │     │   VISIT_DIM     │
    └─────────────────┘     │ ┌─────────────┐ │
             ▲              │ │ENCOUNTER_NUM│ │◄─┘
             │              │ │ PATIENT_NUM │ │
             └──────────────┤ │ START_DATE  │ │
                            │ │ LOCATION_CD │ │
                            │ └─────────────┘ │
                            └─────────────────┘

    Supporting Tables:
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ CODE_LOOKUP │  │USER_MGMT    │  │  CQL_FACT   │
    │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │
    │ │CODE_CD  │ │  │ │USER_ID  │ │  │ │CQL_ID   │ │
    │ │NAME_CHAR│ │  │ │USER_CD  │ │  │ │CQL_CHAR │ │
    │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │
    └─────────────┘  └─────────────┘  └─────────────┘
```

### Core Tables

- **PATIENT_DIMENSION**: Patient demographics and metadata
- **VISIT_DIMENSION**: Patient encounters and visits with lifecycle management
- **OBSERVATION_FACT**: Clinical observations and measurements (Central Fact Table)
- **CONCEPT_DIMENSION**: Medical concepts (SNOMED/LOINC) with 611 seeded records
- **PROVIDER_DIMENSION**: Healthcare providers and organizational hierarchy
- **CODE_LOOKUP**: Reference data and lookups
- **USER_MANAGEMENT**: User authentication and permissions (4 standard users)
- **CQL_FACT**: Clinical Quality Language rules with 8 seeded rules
- **CONCEPT_CQL_LOOKUP**: Concept-rule relationships and mappings

## MVC Architecture

The application follows a clean **Model-View-Controller (MVC)** pattern that separates concerns and promotes maintainability:

### MVC Pattern Implementation

```
┌─────────────────────────────────────────────────────────────────┐
│                           VIEW LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Vue Components (Views)                                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ PatientPage.vue │ │ VisitsPage.vue  │ │ DashboardPage   │   │
│  │ • UI Logic      │ │ • UI Logic      │ │ • UI Logic      │   │
│  │ • User Input    │ │ • User Input    │ │ • User Input    │   │
│  │ • Event Handling│ │ • Event Handling│ │ • Event Handling│   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CONTROLLER LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  Services (Controllers)                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ visit-observation-service.js                           │   │
│  │ • Coordinates business logic                           │   │
│  │ • Orchestrates model interactions                     │   │
│  │ • Handles complex workflows                           │   │
│  │ • Manages data flow between models                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          MODEL LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Pinia Stores (Models)          │  Data Transformers            │
│  ┌─────────────────────────────┐ │ ┌─────────────────────────┐   │
│  │ patient-store.js            │ │ │ observation-transformer │   │
│  │ • Patient state management  │ │ │ • Data mapping          │   │
│  │ • Patient CRUD operations  │ │ │ • Format conversion     │   │
│  └─────────────────────────────┘ │ └─────────────────────────┘   │
│  ┌─────────────────────────────┐ │ ┌─────────────────────────┐   │
│  │ visit-store.js              │ │ │ visit-transformer       │   │
│  │ • Visit state management    │ │ │ • Data mapping          │   │
│  │ • Visit CRUD operations    │ │ │ • Format conversion     │   │
│  └─────────────────────────────┘ │ └─────────────────────────┘   │
│  ┌─────────────────────────────┐ │                               │
│  │ observation-store.js        │ │                               │
│  │ • Observation state mgmt    │ │                               │
│  │ • Observation CRUD ops      │ │                               │
│  └─────────────────────────────┘ │                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA ACCESS LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  Repositories & Database Service                               │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ PatientRepo     │ │ VisitRepo       │ │ ObservationRepo │   │
│  │ • Data access   │ │ • Data access   │ │ • Data access   │   │
│  │ • Query logic   │ │ • Query logic   │ │ • Query logic   │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### MVC Benefits

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Maintainability**: Changes in one layer don't affect others
3. **Testability**: Each component can be tested independently
4. **Reusability**: Models and services can be reused across views
5. **Scalability**: Easy to add new features without affecting existing code

### Key Components

#### Models (Pinia Stores)

- **`patient-store.js`**: Manages patient-specific state and operations
- **`visit-store.js`**: Manages visit-specific state and operations
- **`observation-store.js`**: Manages observation-specific state and operations
- **`medications-store.js`**: Centralized medication parsing and formatting logic

#### Controllers (Services)

- **`visit-observation-service.js`**: Coordinates complex business logic between stores
- **`database-service.js`**: Handles database operations and repository coordination

#### Views (Vue Components)

- **`PatientPage.vue`**: Patient management interface
- **`VisitsPage.vue`**: Visit management interface
- **`DashboardPage.vue`**: System overview and statistics

#### Data Transformers

- **`observation-transformer.js`**: Transforms raw observation data
- **`visit-transformer.js`**: Transforms raw visit data

## Architecture

### Core Logic Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│  Vue Components  │  Pinia Stores  │  Pages  │  Layouts         │
│  ┌─────────────┐ │ ┌────────────┐ │ ┌─────┐ │ ┌──────────────┐ │
│  │DatabaseTest │ │ │DatabaseStore│ │ │Index│ │ │ MainLayout   │ │
│  │PatientList  │ │ │PatientStore │ │ │Test │ │ │              │ │
│  │ObservEdit   │ │ │VisitStore   │ │ │...  │ │ │              │ │
│  └─────────────┘ │ └────────────┘ │ └─────┘ │ └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                    DatabaseService                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Connection Management                                 │   │
│  │ • Repository Coordination                               │   │
│  │ • Transaction Handling                                  │   │
│  │ • Error Management                                      │   │
│  │ • Migration Orchestration                               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REPOSITORY LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  BaseRepository  │ PatientRepo │ VisitRepo │ ObservationRepo    │
│  ┌─────────────┐ │┌──────────┐ │┌────────┐ │┌──────────────┐   │
│  │• findById() │ ││• findBy  │ ││• findBy│ ││• findBy      │   │
│  │• findAll()  │ ││  Code()  │ ││  Patient│ ││  Patient()   │   │
│  │• create()   │ ││• create  │ ││• create│ ││• create      │   │
│  │• update()   │ ││  Patient│ ││  Visit │ ││  Observation │   │
│  │• delete()   │ ││• search()│ ││• ...   │ ││• ...         │   │
│  └─────────────┘ │└──────────┘ │└────────┘ │└──────────────┘   │
│                  │              │           │                   │
│  ConceptRepo     │ CqlRepo      │ UserRepo  │ ProviderRepo       │
│  ┌─────────────┐ │┌──────────┐ │┌────────┐ │┌──────────────┐   │
│  │• findByCode │ ││• findBy  │ ││• findBy│ ││• findBy      │   │
│  │• findByPath │ ││  CqlId() │ ││  UserId│ ││  ProviderId  │   │
│  │• search()   │ ││• create  │ ││• auth()│ ││• findByName  │   │
│  │• getTree()  │ ││  Rule()  │ ││• ...   │ ││• getHierarchy│   │
│  └─────────────┘ │└──────────┘ │└────────┘ │└──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  SQLiteConnection │ MigrationManager │ Schema Definitions       │
│  ┌──────────────┐ │┌───────────────┐ │┌────────────────────┐   │
│  │• connect()   │ ││• initialize() │ ││• 001-initial.js    │   │
│  │• execute     │ ││• migrate()    │ ││• 002-current.js    │   │
│  │  Query()     │ ││• validate()   │ ││• Seed Data         │   │
│  │• execute     │ ││• rollback()   │ ││• 611 Concepts      │   │
│  │  Command()   │ ││• seedData()   │ ││• 8 CQL Rules       │   │
│  │• transaction│ ││               │ ││• 4 Users           │   │
│  └──────────────┘ │└───────────────┘ │└────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   SQLite DB     │
                    │ ┌─────────────┐ │
                    │ │ Tables      │ │
                    │ │ Indexes     │ │
                    │ │ Triggers    │ │
                    │ │ Views       │ │
                    │ └─────────────┘ │
                    └─────────────────┘
```

### Directory Structure

```
src/
├── core/                    # Core business logic
│   ├── database/           # Database layer
│   │   ├── sqlite/        # SQLite connection management
│   │   ├── repositories/  # Data access layer (7 repositories)
│   │   ├── migrations/    # Schema management with seed data
│   │   └── seeds/         # CSV-based data seeding
│   ├── services/           # Business services (Controllers)
│   │   └── visit-observation-service.js
│   └── validators/         # Data validation
├── infrastructure/         # External integrations
├── presentation/           # UI layer (Views)
│   ├── components/        # Vue components
│   │   ├── patient/       # Patient-related components
│   │   ├── visits/        # Visit-related components
│   │   ├── shared/        # Shared components
│   │   └── datagrid/      # Data grid components
│   ├── pages/             # Route pages (Views)
│   │   ├── PatientPage.vue
│   │   ├── VisitsPage.vue
│   │   ├── DashboardPage.vue
│   │   └── DataGridPage.vue
│   ├── stores/            # Pinia stores (Models)
│   │   ├── patient-store.js
│   │   ├── visit-store.js
│   │   ├── observation-store.js
│   │   ├── medications-store.js
│   │   ├── database-store.js
│   │   └── concept-resolution-store.js
│   └── layouts/           # App layouts
├── utils/                  # Data transformers (Model helpers)
│   ├── observation-transformer.js
│   └── visit-transformer.js
└── shared/                 # Shared utilities

tests/                      # Comprehensive test suite
├── unit/                   # 244 unit tests (100% pass)
├── integration/            # 53 integration tests
├── scripts/                # 29 test utilities
└── output/                 # Test database files
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Building

```bash
npm run build
```

### Windows (Electron) Build & Packaging

The project includes Windows-friendly scripts and packaging. Use PowerShell.

1. Open PowerShell in the project root and allow scripts for this session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
```

2. Install dependencies:

```powershell
npm.cmd install
```

3. Build and package the Windows x64 app (EXE + ZIP):

!! WICHTIG: sollte als **ADMIN** ausgeführt werden !!!

```powershell
npm.cmd run build:win-x64
```

This will:

- build the Electron app for `win32-x64`
- create the packaged folder at:
  - `dist\electron\Packaged\Best - Scientific DB Manager-win32-x64\`
- produce a timestamped ZIP at:
  - `dist\builds\best-win-x64-YYYY-MM-DD-HH-mm-ss.zip`

4. Run the packaged app:

```text
dist\electron\Packaged\Best - Scientific DB Manager-win32-x64\Best - Scientific DB Manager.exe
```

#### Troubleshooting on Windows

- Execution policy error (when running npm scripts):
  - Symptom: “Ausführung von Skripts auf diesem System deaktiviert” / `PSSecurityException`
  - Fix: Run step 1 above (temporary policy bypass).

- Cannot find module 'sqlite3' (at runtime):
  - Ensure `sqlite3` is installed as a runtime dependency (already configured in `package.json`).
  - Rebuild native module for your Electron version:
    ```powershell
    npx.cmd --yes electron-rebuild -f -w sqlite3 -v 37.3.1
    ```
  - Re-run: `npm.cmd run build:win-x64`

- Build fails with EBUSY/locked folder:
  - Close any running app instance or force kill:
    ```powershell
    taskkill /IM "Best - Scientific DB Manager.exe" /F
    ```
  - Remove the old packaged directory and rebuild:
    ```powershell
    Remove-Item -LiteralPath ".\dist\electron\Packaged\Best - Scientific DB Manager-win32-x64" -Recurse -Force -ErrorAction SilentlyContinue
    npm.cmd run build:win-x64
    ```

- Blank Electron window after packaging:
  - Rebuild and re-run; the app auto-detects production paths and loads `index.html` from the package.
  - Open DevTools with `Ctrl+Shift+I` and check the Console for errors if it persists.

## MVC Data Flow Architecture

### Complete MVC Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                           VIEW LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Vue Components (Views)                                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ PatientPage.vue │ │ VisitsPage.vue  │ │ DashboardPage   │   │
│  │ • UI Logic      │ │ • UI Logic      │ │ • UI Logic      │   │
│  │ • User Input    │ │ • User Input    │ │ • User Input    │   │
│  │ • Event Handling│ │ • Event Handling│ │ • Event Handling│   │
│  │ • Data Display  │ │ • Data Display  │ │ • Data Display  │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CONTROLLER LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  Services (Controllers)                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ visit-observation-service.js                           │   │
│  │ • selectVisitAndLoadObservations()                     │   │
│  │ • loadPatientWithData()                                │   │
│  │ • createObservation()                                  │   │
│  │ • updateObservation()                                  │   │
│  │ • deleteObservation()                                  │   │
│  │ • getPreviousVisits()                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          MODEL LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Pinia Stores (Models)          │  Data Transformers            │
│  ┌─────────────────────────────┐ │ ┌─────────────────────────┐   │
│  │ patient-store.js            │ │ │ observation-transformer │   │
│  │ • selectedPatient           │ │ │ • transformObservation()│   │
│  │ • loadPatient()             │ │ │ • formatValue()         │   │
│  │ • searchPatients()          │ │ │ • parseBlob()           │   │
│  └─────────────────────────────┘ │ └─────────────────────────┘   │
│  ┌─────────────────────────────┐ │ ┌─────────────────────────┐   │
│  │ visit-store.js              │ │ │ visit-transformer       │   │
│  │ • selectedVisit             │ │ │ • transformVisit()      │   │
│  │ • visits                    │ │ │ • formatDate()          │   │
│  │ • loadVisitsForPatient()    │ │ │ • parseVisitBlob()      │   │
│  └─────────────────────────────┘ │ └─────────────────────────┘   │
│  ┌─────────────────────────────┐ │                               │
│  │ observation-store.js        │ │                               │
│  │ • observations              │ │                               │
│  │ • categorizedObservations   │ │                               │
│  │ • loadObservationsForVisit()│ │                               │
│  │ • getObservationBlob()      │ │                               │
│  └─────────────────────────────┘ │                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA ACCESS LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  Repositories & Database Service                               │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ PatientRepo     │ │ VisitRepo       │ │ ObservationRepo │   │
│  │ • createPatient │ │ • createVisit   │ │ • createObs     │   │
│  │ • findByCode()  │ │ • findByPatient │ │ • findByVisit   │   │
│  │ • updatePatient │ │ • updateVisit   │ │ • updateObs     │   │
│  │ • deletePatient │ │ • deleteVisit   │ │ • deleteObs     │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SQLITE CONNECTION                             │
├─────────────────────────────────────────────────────────────────┤
│                  SQLiteConnection                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • executeQuery(sql, params) ────► SELECT operations    │   │
│  │ • executeCommand(sql, params) ───► INSERT/UPDATE/DELETE│   │
│  │ • executeTransaction(commands) ──► Multi-operation     │   │
│  │ • connect(filePath) ─────────────► Database connection │   │
│  │ • disconnect() ──────────────────► Close connection    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   SQLite File   │
                    │                 │
                    │ production.db   │
                    │ development.db  │ (not used)
                    │ test.db         │ (not used)
                    │                 │
                    └─────────────────┘

MVC Error Handling Flow:
Database Error ──► Repository ──► Store ──► Service ──► Component ──► User Notification
```

## Database Operations

### Connection

The database service automatically handles:

- SQLite file creation and connection
- Schema migration execution
- Repository initialization

### Patient Operations

```javascript
import { useDatabaseStore } from './stores/database-store'

const dbStore = useDatabaseStore()

// Create a patient
const patient = await dbStore.createPatient({
  PATIENT_CD: 'P001',
  SEX_CD: 'M',
  AGE_IN_YEARS: 25,
})

// Find patients
const patients = await dbStore.findPatients({
  SEX_CD: 'M',
  ageRange: { min: 20, max: 30 },
})

// Search patients
const results = await dbStore.searchPatients('P001')
```

### Visit Operations

```javascript
// Create a medical encounter
const visit = await dbStore.createVisit({
  PATIENT_NUM: 1,
  START_DATE: '2024-01-15',
  LOCATION_CD: 'EMERGENCY',
  INOUT_CD: 'I',
})

// Find patient visits
const visits = await dbStore.findVisitsByPatient(1)
const activeVisits = await dbStore.findActiveVisits()
```

### Clinical Observations

```javascript
// Create numeric observation
const observation = await dbStore.createObservation({
  PATIENT_NUM: 1,
  ENCOUNTER_NUM: 1,
  CONCEPT_CD: 'LOINC:8302-2',
  VALTYPE_CD: 'N',
  NVAL_NUM: 120.5,
  UNIT_CD: 'mmHg',
})

// Create survey observation
const survey = await dbStore.createObservation({
  PATIENT_NUM: 1,
  ENCOUNTER_NUM: 1,
  CONCEPT_CD: 'SURVEY:SAMS',
  VALTYPE_CD: 'T',
  TVAL_CHAR: '{"anxiety": 3, "depression": 2}',
})
```

### Database Management

```javascript
// Initialize database
await dbStore.initializeDatabase('./my-database.db')

// Get statistics
const stats = await dbStore.getDatabaseStatistics()

// Validate database
const validation = await dbStore.validateDatabase()

// Reset database (careful!)
await dbStore.resetDatabase()
```

### Data Validation

```javascript
import DataValidator from './src/core/validators/data-validator.js'

// Initialize validator with repositories
const dataValidator = new DataValidator(conceptRepository, cqlRepository)

// Validate clinical data
const result = await dataValidator.validateData({
  value: 120.5,
  type: 'numeric',
  conceptCode: 'LOINC:8302-2',
  metadata: { field: 'BLOOD_PRESSURE' },
})

// Check validation results
if (!result.isValid) {
  console.log('Validation errors:', result.errors)
  // Handle validation failures
} else {
  console.log('Data is valid!')
}

// Custom validation rules
dataValidator.setCustomRules('numeric', {
  min: 0,
  max: 300,
  precision: 1,
})
```

## Testing the Database

### Interactive Testing

1. Navigate to `/database-test` in the application
2. Enter a database path (e.g., `./test.db`)
3. Click "Connect" to initialize the database
4. Use the interface to:
   - Create test patients, visits, and observations
   - Search and view clinical data
   - View database statistics and migration status
   - Test seed data functionality

### Automated Testing

```bash
# Run all tests (374 tests, optimized execution)
npm test -- --run

# Run specific test categories
npm test tests/unit/ -- --run        # Unit tests only (374 tests)
npm test tests/integration/ -- --run # Integration tests only (53 tests)

# Run service-specific tests
npm test tests/unit/10_csv-service.test.js -- --run    # CSV service (47 tests)
npm test tests/unit/11_hl7-service.test.js -- --run    # HL7 service (48 tests)

# Run standalone test scripts
node tests/scripts/run-seed-data-test.js
```

### Test Coverage

- **Unit Tests**: 374 tests covering all repositories, services, and core functionality
- **Integration Tests**: 53 tests with real SQLite database operations
- **Test Scripts**: 29 utilities for manual testing and debugging
- **Performance**: Optimized test execution with comprehensive coverage
- **Service Tests**: 95 tests for CSV and HL7 import/export services

## Security Features

- **Parameterized Queries**: Prevents SQL injection
- **Input Validation**: Comprehensive data validation
- **Transaction Support**: ACID-compliant operations
- **Access Control**: User-based permissions (planned)

## Current Status & Future Enhancements

### ✅ Completed Features

- [x] **Core Repositories**: Patient, Visit, Observation, Note, Provider, Concept, CQL, User management
- [x] **Database Schema**: Complete star schema with 12 tables and relationships
- [x] **Migration System**: Automated schema management with seed data
- [x] **Data Validation**: Comprehensive validation layer with CQL integration
- [x] **Testing Suite**: 374 tests with 100% pass rate
- [x] **Real SQLite Integration**: Actual database file creation and operations
- [x] **Seed Data**: 611 concepts, 8 CQL rules, 4 standard users
- [x] **CSV Service**: Complete import/export with two-header row support (47 tests)
- [x] **HL7 Service**: Complete CDA import/export with digital signatures (48 tests)
- [x] **MVC Architecture Refactoring**: Complete separation of concerns with clean MVC pattern
- [x] **Store Separation**: Split monolithic store into focused, single-responsibility stores
- [x] **Service Layer**: Business logic coordination through dedicated services
- [x] **Data Transformers**: Clean data mapping and formatting utilities

### 🎯 **Phase 1 & 2 Complete - Ready for UI Development**

- [x] **All Core Repositories**: 100% implemented and tested
- [x] **Business Services**: CSV and HL7 import/export complete
- [x] **Data Validation**: Comprehensive validation with CQL integration
- [x] **Testing Coverage**: 374 tests with 100% pass rate

### 🏗️ **MVC Architecture Refactoring (Completed)**

The application has been completely refactored to follow clean MVC principles:

#### **Before Refactoring**

- **Monolithic Store**: Single `visit-observation-store.js` with 1000+ lines
- **Mixed Responsibilities**: Patient, visit, and observation logic combined
- **Tight Coupling**: Components directly accessing database operations
- **Code Duplication**: Repeated logic across components

#### **After Refactoring**

- **Separated Stores**:
  - `patient-store.js` - Patient-specific state and operations
  - `visit-store.js` - Visit-specific state and operations
  - `observation-store.js` - Observation-specific state and operations
  - `medications-store.js` - Centralized medication logic
- **Service Layer**: `visit-observation-service.js` coordinates complex workflows
- **Data Transformers**: Clean data mapping utilities
- **Single Responsibility**: Each component has one clear purpose

#### **Refactored Components**

- **Views (Vue Components)**:
  - `PatientPage.vue` - Patient management interface
  - `VisitsPage.vue` - Visit management interface
  - `DashboardPage.vue` - System overview
  - `PatientObservationsTab.vue` - Observation management
  - `VisitTimeline.vue` - Visit timeline display
  - `VisitDataEntry.vue` - Visit data entry form
  - `ObservationFieldSet.vue` - Observation field management
  - `MedicationEditDialog.vue` - Medication editing
  - `MedicationFieldView.vue` - Medication display
  - And 10+ other components updated

#### **Benefits Achieved**

- **Maintainability**: Changes isolated to specific stores/services
- **Testability**: Each component can be tested independently
- **Reusability**: Stores and services can be reused across views
- **Performance**: Reduced bundle size and improved loading
- **Developer Experience**: Clear separation makes code easier to understand

### 📋 Planned Features (Phase 3 - UI Development)

- [x] **HL7 Integration**: ✅ Complete CDA import/export with digital signatures
- [x] **CSV Integration**: ✅ Complete import/export with two-header row support
- [ ] **UI Components**: Patient management, visit tracking, and observation interfaces
- [ ] **Import/Export UI**: File upload, validation, and export interfaces
- [ ] **Dashboard**: Statistics, data quality metrics, and system health
- [ ] **Advanced CQL Engine**: Clinical Quality Language execution and validation
- [ ] **Data Analytics**: Advanced search, filtering, and reporting capabilities
- [ ] **Multi-user Support**: Role-based access control and user management
- [ ] **Backup & Recovery**: Automated backup procedures and data recovery
- [ ] **Performance Optimization**: Query optimization and indexing strategies

## Internationalization (I18n)

The application includes complete internationalization support with Vue I18n 9, providing seamless German/English language switching.

### Features

- **Dual Language Support**: German (default) and English
- **Automatic Language Detection**: Browser language detection with localStorage persistence
- **Language Switcher**: Elegant icon-based language selector in the header
- **500+ Translation Keys**: Comprehensive translations across 20 structured categories
- **Vue I18n 9**: Modern Composition API implementation with global injection

### File Structure

```
src/
├── i18n/
│   ├── index.js                 # I18n configuration
│   └── locales/
│       ├── de.json             # German translations (422+ lines)
│       └── en.json             # English translations (421+ lines)
├── boot/
│   └── i18n.js                 # Quasar boot file
└── components/shared/
    └── LanguageSwitcher.vue    # Language selection component
```

### Translation Categories

- **common** - Basic actions (save, cancel, edit, search, etc.)
- **navigation** - Menu items and breadcrumbs
- **auth** - Authentication and login forms
- **patient** - Patient management (demographics, search, creation)
- **visit** - Visit management (timeline, observations, medications)
- **observation** - Clinical observations and concepts
- **user** - User management and permissions
- **settings** - Application settings and configuration
- **smartButton** - SmartButton plugin features
- **dataGrid** - Data grid and Excel-like editor
- **export/import** - Data operations and file handling
- **questionnaire** - Survey and questionnaire functionality
- **study** - Research study management
- **validation** - Form validation messages
- **messages** - System notifications and feedback

### Usage in Components

#### Template Usage

```vue
<template>
  <!-- Simple translation -->
  <q-btn :label="$t('common.save')" />

  <!-- With interpolation -->
  <div>{{ $t('dashboard.totalPatients') }}: {{ count }}</div>

  <!-- In attributes -->
  <q-input :placeholder="$t('auth.username')" />

  <!-- With parameters -->
  <div>{{ $t('search.foundPatients', { count: results.length }) }}</div>
</template>
```

#### Script Usage

```vue
<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Use in computed properties
const successMessage = computed(() => t('messages.saveSuccess'))

// Use in methods
const showNotification = () => {
  $q.notify({
    message: t('messages.operationComplete'),
    type: 'positive',
  })
}
</script>
```

### Language Switching

The LanguageSwitcher component is integrated in the main header and provides:

- **Icon + Language Code Display**: Shows "🌐 DE" or "🌐 EN"
- **Dropdown Menu**: Click to see available languages
- **Visual Feedback**: Current language highlighted with blue background
- **Automatic Persistence**: Selected language saved to localStorage
- **Responsive Design**: Works on all screen sizes

### Adding New Translations

1. **Add to German file** (`src/i18n/locales/de.json`):

```json
{
  "myCategory": {
    "myKey": "Mein deutscher Text"
  }
}
```

2. **Add to English file** (`src/i18n/locales/en.json`):

```json
{
  "myCategory": {
    "myKey": "My English text"
  }
}
```

3. **Use in component**:

```vue
<template>
  <div>{{ $t('myCategory.myKey') }}</div>
</template>
```

### Coverage Status

**50+ Components Translated (~45% of 112 total)**

- ✅ **Pages**: 20/20 (100%) - All major pages fully translated
- ✅ **SmartButton**: 8/8 (100%) - Complete plugin suite
- ✅ **Layouts**: 3/3 (100%) - All layouts
- ✅ **User/Settings**: 6/6 (100%) - Complete user management
- ✅ **Core Shared**: 12/19 (63%) - All critical dialogs and inputs
- ✅ **Patient**: 5/7 (71%) - All critical patient functions
- ✅ **Visits**: 12/19 (63%) - All critical visit workflows
- ✅ **Questionnaire**: 3/6 (50%) - Main questionnaire functions

**100% functional coverage** of all important user interactions achieved.

### Configuration

The I18n system is configured in `src/i18n/index.js` with:

- **Default Language**: German (de)
- **Fallback Language**: German (de)
- **Browser Detection**: Automatic with fallback
- **Global Injection**: Available in all components via `$t()`
- **Composition API**: Modern Vue 3 approach

## Contributing

1. **Follow Architecture Patterns**: Use the established clean architecture with repository pattern
2. **Repository Implementation**: Extend BaseRepository for new entities with comprehensive CRUD operations
3. **Error Handling**: Implement proper error handling and validation throughout
4. **Testing**: Write unit tests for all new functionality (aim for 100% test coverage)
5. **I18n Support**: Add translations for new text content in both German and English
6. **Documentation**: Update README.md and relevant documentation files
7. **Performance**: Consider performance implications for large datasets
8. **Clinical Data**: Follow healthcare data standards and validation requirements

### Development Workflow

```bash
# 1. Create new repository (if needed)
# 2. Implement comprehensive functionality
# 3. Add I18n translations for any new text content
# 4. Write unit tests (aim for 25+ tests per repository)
# 5. Run test suite: npm test -- --run
# 6. Update documentation
# 7. Create integration tests for real database testing
```

### I18n Development Guidelines

When adding new components or features:

1. **Never hardcode text strings** - always use `$t()` functions
2. **Add translations to both files** - `de.json` and `en.json`
3. **Use structured keys** - follow existing category patterns
4. **Test language switching** - verify both languages work correctly
5. **Consider pluralization** - use Vue I18n's plural forms when needed

#### Example: Adding a new feature with I18n

```vue
<!-- ❌ Wrong: Hardcoded text -->
<q-btn label="Delete Patient" />

<!-- ✅ Correct: Using I18n -->
<q-btn :label="$t('patient.deletePatient')" />
```

Add to translation files:

```json
// de.json
{
  "patient": {
    "deletePatient": "Patient löschen"
  }
}

// en.json
{
  "patient": {
    "deletePatient": "Delete Patient"
  }
}
```

## License

This project is part of the BEST (Base for Experiment Storage & Tracking) system.
