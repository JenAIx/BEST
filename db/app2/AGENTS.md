# AGENTS.md - Quick Reference Guide for AI Assistants

> **Purpose**: This file provides essential information about the BEST application architecture, database, users, and main pages for quick reference during development and debugging.

---

## 📁 Project Overview

**BEST - Scientific DB Manager**  
A modern research database for neuroscientific data built with Vue 3, Quasar, and SQLite.

- **Architecture**: Clean MVC (Model-View-Controller) pattern
- **Frontend**: Vue 3 + Quasar + Pinia stores
- **Database**: SQLite with star schema design
- **Language**: Dual German/English with Vue I18n
- **Testing**: 326+ tests with 100% pass rate

---

## 🗄️ Database Access

### Database Location

```
./database/production.db
```

### Direct SQLite3 Access

You can directly query the database using sqlite3 command line:

```bash
# Open database
sqlite3 ./database/production.db

# List all tables
.tables

# Show table schema
.schema USER_MANAGEMENT
.schema PATIENT_DIMENSION
.schema USER_PATIENT_LOOKUP

# Query users
SELECT USER_ID, USER_CD, NAME_CHAR, COLUMN_CD FROM USER_MANAGEMENT;

# Query patients
SELECT PATIENT_NUM, PATIENT_CD, AGE_IN_YEARS, SEX_CD FROM PATIENT_DIMENSION LIMIT 10;

# Query user-patient associations
SELECT u.USER_CD, u.NAME_CHAR, p.PATIENT_CD, upl.USER_PATIENT_ID
FROM USER_PATIENT_LOOKUP upl
JOIN USER_MANAGEMENT u ON upl.USER_ID = u.USER_ID
JOIN PATIENT_DIMENSION p ON upl.PATIENT_NUM = p.PATIENT_NUM;

# Count records
SELECT
  (SELECT COUNT(*) FROM PATIENT_DIMENSION) as patients,
  (SELECT COUNT(*) FROM VISIT_DIMENSION) as visits,
  (SELECT COUNT(*) FROM OBSERVATION_FACT) as observations,
  (SELECT COUNT(*) FROM USER_MANAGEMENT) as users;

# Exit
.quit
```

### Connection Flow

```
LoginPage → AuthStore → DatabaseStore → DatabaseService → SQLite Connection
```

### Main Database Classes

- **`src/stores/database-store.js`** - Pinia store for database state
- **`src/core/services/database-service.js`** - Database service coordination
- **`src/core/database/sqlite/electron-connection.js`** - Electron SQLite connection
- **`src/core/database/sqlite/real-connection.js`** - Real SQLite3 connection
- **`src-electron/electron-preload.js`** - Electron bridge for database operations

### Database Schema (Star Schema)

#### Core Tables

```
PATIENT_DIMENSION        - Patient demographics and metadata
VISIT_DIMENSION          - Patient encounters and visits (FK: PATIENT_NUM)
OBSERVATION_FACT         - Clinical observations (Central Fact Table)
                          FK: PATIENT_NUM, ENCOUNTER_NUM, CONCEPT_CD
CONCEPT_DIMENSION        - Medical concepts (SNOMED/LOINC) - 611 seeded records
PROVIDER_DIMENSION       - Healthcare providers and hierarchy
CODE_LOOKUP              - Reference data and lookups
USER_MANAGEMENT          - User authentication and permissions (4 seeded users)
CQL_FACT                 - Clinical Quality Language rules - 8 seeded rules
CONCEPT_CQL_LOOKUP       - Concept-rule relationships (M:N)
```

#### Key Relationships

```
PATIENT (1) ──────┬─────► (N) VISITS
                  │
                  ├─────► (N) OBSERVATIONS
                  │
                  └─────► (N) NOTES

VISIT (1) ────────────────► (N) OBSERVATIONS

CONCEPT (1) ───────────────► (N) OBSERVATIONS

USER (M) ◄──────► (N) PATIENT    [via USER_PATIENT_LOOKUP]
STUDY (M) ◄─────► (N) PATIENT    [via STUDY_PATIENT_LOOKUP]
CONCEPT (M) ◄───► (N) CQL_RULES  [via CONCEPT_CQL_LOOKUP]

CASCADE DELETE:
  Delete Patient → Auto-deletes Visits, Observations, Notes
  Delete Visit → Auto-deletes related Observations
  Delete Study → Auto-deletes Enrollments
```

#### Supporting Tables

```
STUDY_DIMENSION          - Research study metadata
STUDY_PATIENT_LOOKUP     - Patient-study enrollment relationships
USER_PATIENT_LOOKUP      - User-patient access control (who can see which patients)
patient_list (VIEW)      - Materialized patient view with resolved codes
```

### User-Patient Access Control

The system uses **`USER_PATIENT_LOOKUP`** table for fine-grained access control:

```sql
CREATE TABLE USER_PATIENT_LOOKUP (
  USER_PATIENT_ID INTEGER PRIMARY KEY,
  USER_ID INTEGER NOT NULL,           -- Links to USER_MANAGEMENT
  PATIENT_NUM INTEGER NOT NULL,       -- Links to PATIENT_DIMENSION
  NAME_CHAR TEXT,                     -- Optional description
  USER_PATIENT_BLOB TEXT,             -- Additional metadata (JSON)
  UPDATE_DATE TEXT,
  FOREIGN KEY (PATIENT_NUM) REFERENCES PATIENT_DIMENSION(PATIENT_NUM),
  FOREIGN KEY (USER_ID) REFERENCES USER_MANAGEMENT(USER_ID)
);
```

**Purpose**: Controls which users can access which patients (not currently enforced in UI, but schema ready)

**Example Queries**:

```sql
-- Get all patients accessible to a specific user
SELECT p.* FROM PATIENT_DIMENSION p
JOIN USER_PATIENT_LOOKUP upl ON p.PATIENT_NUM = upl.PATIENT_NUM
WHERE upl.USER_ID = 1;

-- Get all users who can access a specific patient
SELECT u.* FROM USER_MANAGEMENT u
JOIN USER_PATIENT_LOOKUP upl ON u.USER_ID = upl.USER_ID
WHERE upl.PATIENT_NUM = 42;

-- Grant user access to patient
INSERT INTO USER_PATIENT_LOOKUP (USER_ID, PATIENT_NUM, NAME_CHAR, UPDATE_DATE)
VALUES (1, 42, 'Access granted for study XYZ', datetime('now'));
```

**Current Implementation Status**:

- ✅ Table exists in schema
- ✅ Repository methods available (`UserRepository.getUserWithPatientAccess()`)
- ✅ Store methods available (`userStore.createUserPatientAssociation()`)
- ✅ **FULLY IMPLEMENTED** - User-based access control is now active!
- ✅ Auto-assignment: New patients automatically assigned to creator
- ✅ Repository-level filtering: Regular users see only their patients
- ✅ Admin bypass: Admins see all patients
- ✅ Admin UI: `/users` → "Patient Access" tab for management
- ✅ All query paths secured: pagination, search, direct lookup
- ✅ Bug fixed: Consistent filtering across all methods (2025-12-30)

**Relationship Diagram**:

```
USER_MANAGEMENT                USER_PATIENT_LOOKUP               PATIENT_DIMENSION
┌──────────────┐              ┌──────────────────┐              ┌──────────────┐
│ USER_ID (PK) │◄─────────────│ USER_ID (FK)     │              │ PATIENT_NUM  │
│ USER_CD      │              │ PATIENT_NUM (FK) │─────────────►│ (PK)         │
│ NAME_CHAR    │              │ NAME_CHAR        │              │ PATIENT_CD   │
│ PASSWORD     │              │ USER_PATIENT_BLOB│              │ AGE, SEX, etc│
│ COLUMN_CD    │              └──────────────────┘              └──────────────┘
│ (role)       │                     (M:N)
└──────────────┘              Many users can access
  (4 seeded)                  many patients
```

### Study-Patient Enrollment

Similar M:N relationship via **`STUDY_PATIENT_LOOKUP`** table:

```sql
CREATE TABLE STUDY_PATIENT_LOOKUP (
  STUDY_PATIENT_ID INTEGER PRIMARY KEY,
  STUDY_NUM INTEGER NOT NULL,         -- Links to STUDY_DIMENSION
  PATIENT_NUM INTEGER NOT NULL,       -- Links to PATIENT_DIMENSION
  ENROLLMENT_DATE TEXT,
  WITHDRAWAL_DATE TEXT,
  ENROLLMENT_STATUS_CD TEXT,          -- 'active', 'withdrawn', 'completed'
  STUDY_PATIENT_BLOB TEXT,
  FOREIGN KEY (STUDY_NUM) REFERENCES STUDY_DIMENSION(STUDY_NUM) ON DELETE CASCADE,
  FOREIGN KEY (PATIENT_NUM) REFERENCES PATIENT_DIMENSION(PATIENT_NUM) ON DELETE CASCADE,
  UNIQUE(STUDY_NUM, PATIENT_NUM)      -- One enrollment per patient per study
);
```

**Example Queries**:

```sql
-- Get all patients enrolled in a study
SELECT p.*, spl.ENROLLMENT_STATUS_CD, spl.ENROLLMENT_DATE
FROM PATIENT_DIMENSION p
JOIN STUDY_PATIENT_LOOKUP spl ON p.PATIENT_NUM = spl.PATIENT_NUM
WHERE spl.STUDY_NUM = 1 AND spl.ENROLLMENT_STATUS_CD = 'active';

-- Get all studies a patient is enrolled in
SELECT s.*, spl.ENROLLMENT_DATE, spl.ENROLLMENT_STATUS_CD
FROM STUDY_DIMENSION s
JOIN STUDY_PATIENT_LOOKUP spl ON s.STUDY_NUM = spl.STUDY_NUM
WHERE spl.PATIENT_NUM = 42;

-- Enroll patient in study
INSERT INTO STUDY_PATIENT_LOOKUP (STUDY_NUM, PATIENT_NUM, ENROLLMENT_DATE, ENROLLMENT_STATUS_CD)
VALUES (1, 42, date('now'), 'active');
```

### Key Database Operations

```javascript
// Initialize database
await dbStore.initializeDatabase('./database/production.db')

// Get repository
const patientRepo = dbStore.getRepository('patient')
const visitRepo = dbStore.getRepository('visit')
const observationRepo = dbStore.getRepository('observation')

// Execute queries
const result = await dbStore.executeQuery(sql, params)
```

---

## 👥 Test Users (Seeded Data)

All users are seeded automatically during database initialization.

| Username | Password | Role  | Admin  | Description         |
| -------- | -------- | ----- | ------ | ------------------- |
| `admin`  | `admin`  | admin | ✅ Yes | Administrator       |
| `ste`    | `123`    | admin | ✅ Yes | Stefan User (Admin) |
| `db`     | `123`    | user  | ❌ No  | Database User       |
| `public` | `public` | user  | ❌ No  | Public User         |

### User Permissions

- **Admin Users** (`COLUMN_CD = 'admin'`):
  - Full access to all pages including /concepts, /cql, /users, /global-settings, /database-test
  - Can manage other users
  - Can modify system settings
- **Regular Users** (`COLUMN_CD = 'user'`):
  - Access to patient management, visits, studies, import/export
  - Cannot access admin pages
  - Cannot modify system settings

**Note**: Fine-grained patient access via `USER_PATIENT_LOOKUP` table exists but is not yet enforced in the UI.

### Authentication Flow

```javascript
// Login process
authStore.login(username, password, databasePath)
  → UserRepository.authenticateUser()
  → DatabaseStore.initializeDatabase()
  → Router.push('/dashboard')
```

---

## 🎨 Layouts

### MainLayout.vue (`src/layouts/MainLayout.vue`)

**Primary application layout with:**

- **Header**: Logo, language toggle, smart search, notifications, user menu, DB status
- **Sidebar**: Collapsible navigation with:
  - Dashboard
  - Patient Management (Patients, Visits, Questionnaires)
  - Study Management (Studies, Data Grid)
  - Administration (Concepts, CQL, Users, Global Settings) - Admin only
  - Data Operations (Import, Export)
  - Support & Feedback
- **Breadcrumbs**: Dynamic page navigation trail
- **Mode Toggle**: Dashboard supports "Visit Mode" and "Deep Work Mode"

### GridLayout.vue (`src/layouts/GridLayout.vue`)

**Specialized layout for Excel-like data grid editor**

### PublicLayout.vue (`src/layouts/PublicLayout.vue`)

**Minimal layout for login and public pages**

---

## 📄 Main Pages

### 🏠 Core Pages

#### DashboardPage.vue (`/dashboard`)

**Two-mode dashboard with statistics and quick actions**

- **Visit Mode**:
  - Quick patient search, new patient, visits today, import
  - Recent patients list
  - Current studies list
  - Today's statistics (patients seen, visits, reports, active studies)
- **Deep Work Mode**:
  - Data overview cards (total patients, active studies, new today, data quality)
  - Advanced patient data explorer with filters
  - Full patient table with search/filter/sort

**Key Features**: Real-time statistics, patient creation, study management

---

### 👤 Patient Management

#### PatientSearchPage.vue (`/patients`)

**Intelligent patient search and discovery**

- Smart search with AI-like suggestions
- Advanced filters: age range, gender, vital status, location, studies
- Patient results grid with cards
- Real-time search with debouncing
- Quick patient creation

**Key Features**: Full-text search, filter combinations, patient statistics

#### PatientPage.vue (`/patient/:id`)

**Individual patient details and management**

- Patient demographics
- Visit history
- Observations and measurements
- Study enrollment
- Full CRUD operations

**Key Features**: Patient editing, visit management, data entry

---

### 🏥 Visit Management

#### VisitsPage.vue (`/visits`)

**Medical encounter tracking and management**

- Visit list by patient
- Visit lifecycle (active, completed, cancelled)
- Timeline view
- Data entry for observations
- Medication management

**Key Features**: Visit CRUD, observation entry, timeline visualization

---

### 🔬 Study Management

#### StudySearchPage.vue (`/studies`)

**Research study search and discovery**

- Study search by name, category, clinical scales
- Advanced filters: research category, clinical scale, study status
- Study statistics (total studies, active studies, enrolled patients)
- Study creation and management

**Key Features**: Study search, enrollment management, statistics

#### StudyDetailsPage.vue (`/studies/:id`)

**Individual study details and patient enrollment**

- Study metadata
- Enrolled patients
- Study timeline
- Data collection forms
- Study status management

**Key Features**: Study editing, patient enrollment, data collection

---

### 📊 Data Operations

#### DataGridPage.vue (`/data-grid`)

**Excel-like data grid editor for bulk operations**

- Spreadsheet interface
- Column-based editing
- Batch operations
- Import/export CSV

**Key Features**: Bulk editing, formula support, data validation

#### ImportPage.vue (`/import`)

**Data import from various formats**

- CSV import with two-header row support
- HL7 CDA import with digital signatures
- Data validation and preview
- Batch import operations

**Key Features**: File upload, format detection, validation, preview

#### ExportPage.vue (`/export`)

**Data export to various formats**

- Patient data export
- Observation export
- Study data export
- CSV, HL7 CDA formats
- Custom field selection

**Key Features**: Filtered export, format selection, batch export

---

### ⚙️ Administration (Admin Only)

#### GlobalSettingsPage.vue (`/global-settings`)

**System-wide configuration and code lookup management**

- Manage CODE_LOOKUP table entries
- Questionnaire definitions (LOOKUP_BLOB)
- Field set definitions
- Visit type configurations
- Category and column selection
- JSON editor for complex data

**Key Features**: Code lookup CRUD, questionnaire import, JSON editing

#### ConceptsPage.vue (`/concepts`)

**Medical concept management (SNOMED/LOINC)**

- Concept tree view
- Concept search
- Category management
- Concept relationships

**Key Features**: Concept CRUD, hierarchical view, search

#### CqlPage.vue (`/cql`)

**Clinical Quality Language rule management**

- CQL rule editor
- Concept-rule mappings
- Validation rules
- Rule testing

**Key Features**: CQL CRUD, syntax validation, testing

#### UserManagementPage.vue (`/users`)

**User account and permission management**

- User CRUD operations
- Role assignment
- Permission management
- Password management

**Key Features**: User administration, role-based access control

---

### 📋 Other Pages

#### QuestionnairePage.vue (`/questionnaires`)

**Survey and questionnaire management**

- Questionnaire builder
- Field definitions
- Validation rules
- Response collection

#### SettingsPage.vue (`/settings`)

**User-specific settings and preferences**

- Language preference
- UI theme
- Notification settings
- Default values

#### FeedbackPage.vue (`/feedback`)

**User feedback and support**

- Feedback form
- Issue reporting
- Feature requests

#### ChangelogPage.vue (`/changelog`)

**Application version history and updates**

#### DatabaseTest.vue (`/database-test`) - Admin Only

**Database testing and debugging interface**

- Connection testing
- Query execution
- Schema inspection
- Data seeding

---

## 🏗️ MVC Architecture

### Model Layer (Pinia Stores)

```
src/stores/
  ├── patient-store.js          - Patient state and operations
  ├── visit-store.js            - Visit state and operations
  ├── observation-store.js      - Observation state and operations
  ├── medications-store.js      - Medication logic
  ├── study-store.js            - Study management
  ├── concept-resolution-store.js - Concept resolution and caching
  ├── database-store.js         - Database connection and operations
  ├── auth-store.js             - Authentication and authorization
  └── global-settings-store.js  - Global settings management
```

### Controller Layer (Services)

```
src/core/services/
  ├── database-service.js           - Database coordination
  ├── visit-observation-service.js  - Business logic coordination
  └── csv-service.js                - CSV import/export
```

### View Layer (Components)

```
src/pages/              - Page components (Views)
src/components/         - Reusable components
src/layouts/            - Layout components
```

### Data Access Layer (Repositories)

```
src/core/database/repositories/
  ├── base-repository.js       - Base CRUD operations
  ├── patient-repository.js    - Patient data access
  ├── visit-repository.js      - Visit data access
  ├── observation-repository.js - Observation data access
  ├── concept-repository.js    - Concept data access
  ├── cql-repository.js        - CQL data access
  ├── user-repository.js       - User data access
  └── study-repository.js      - Study data access
```

---

## 🌐 Internationalization (I18n)

### Language Support

- **Default**: German (de)
- **Secondary**: English (en)
- **Storage**: `localStorage.locale`

### Translation Files

```
src/i18n/locales/
  ├── de.json   - German translations (422+ lines)
  └── en.json   - English translations (421+ lines)
```

### Usage in Components

```vue
<!-- Template -->
<q-btn :label="$t('common.save')" />

<!-- Script -->
import { useI18n } from 'vue-i18n' const { t } = useI18n() const message = t('messages.success')
```

### Translation Categories

```
common, navigation, auth, patient, visit, observation, user, settings,
smartButton, dataGrid, export, import, questionnaire, study, validation, messages
```

---

## 🚀 Quick Start Commands

### Development

```bash
npm install              # Install dependencies
npm run dev             # Start dev server
```

### SQLite3 Quick Reference

```bash
# Common inspection queries
sqlite3 ./database/production.db "SELECT * FROM USER_MANAGEMENT;"
sqlite3 ./database/production.db "SELECT COUNT(*) as total FROM PATIENT_DIMENSION;"
sqlite3 ./database/production.db "SELECT PATIENT_CD, AGE_IN_YEARS, SEX_CD FROM PATIENT_DIMENSION LIMIT 5;"

# Check relationships
sqlite3 ./database/production.db "
SELECT
  p.PATIENT_CD,
  COUNT(DISTINCT v.ENCOUNTER_NUM) as visits,
  COUNT(DISTINCT o.OBSERVATION_ID) as observations
FROM PATIENT_DIMENSION p
LEFT JOIN VISIT_DIMENSION v ON p.PATIENT_NUM = v.PATIENT_NUM
LEFT JOIN OBSERVATION_FACT o ON p.PATIENT_NUM = o.PATIENT_NUM
GROUP BY p.PATIENT_CD
LIMIT 10;"

# Check user permissions
sqlite3 ./database/production.db "
SELECT USER_CD, NAME_CHAR, COLUMN_CD as role
FROM USER_MANAGEMENT
ORDER BY COLUMN_CD DESC, USER_CD;"

# Export data to CSV
sqlite3 -header -csv ./database/production.db "SELECT * FROM PATIENT_DIMENSION;" > patients.csv
```

### Testing

```bash
npm test -- --run       # Run all tests (326 tests)
npm test tests/unit/ -- --run        # Unit tests only
npm test tests/integration/ -- --run # Integration tests
```

### Windows Build

```powershell
npm.cmd run build:win-x64   # Build Windows x64 app
```

---

## 📊 Data Flow Examples

### Patient Creation Flow

```
DashboardPage.vue (View)
  → CreatePatientDialog (View)
  → patient-store.createPatient() (Model)
  → PatientRepository.createPatient() (Data Access)
  → DatabaseService.executeCommand() (Service)
  → SQLite Connection (Database)
```

### Visit Data Entry Flow

```
VisitsPage.vue (View)
  → VisitDataEntry (View)
  → visit-observation-service.createObservation() (Controller)
  → observation-store.createObservation() (Model)
  → ObservationRepository.createObservation() (Data Access)
  → DatabaseService.executeCommand() (Service)
  → SQLite Connection (Database)
```

### Dashboard Statistics Flow

```
DashboardPage.vue (View)
  → loadDashboardStatistics() (View Logic)
  → database-store.getStatistics() (Model)
  → Multiple Repositories (Data Access)
  → DatabaseService.executeQuery() (Service)
  → SQLite Connection (Database)
```

---

## 🔧 Common Development Tasks

### Adding a New Page

1. Create Vue component in `src/pages/`
2. Add route in `src/router/routes.js`
3. Add navigation item in `MainLayout.vue`
4. Add translations in `de.json` and `en.json`

### Adding a New Database Table

1. Create migration in `src/core/database/migrations/`
2. Register migration in `database-service.js`
3. Create repository in `src/core/database/repositories/`
4. Add repository to `database-service.js`
5. Create Pinia store if needed in `src/stores/`
6. Write tests in `tests/unit/` and `tests/integration/`

### Adding New Translations

1. Add key to `src/i18n/locales/de.json`
2. Add key to `src/i18n/locales/en.json`
3. Use in component: `$t('category.key')` or `t('category.key')`

---

## 🐛 Common Issues & Solutions

### Database Not Connecting

```javascript
// Check database path
console.log(dbStore.databasePath)

// Check connection status
console.log(dbStore.isConnected)
console.log(dbStore.canPerformOperations)

// Re-initialize
await dbStore.initializeDatabase('./database/production.db')
```

### Direct Database Inspection

```bash
# Check if database file exists
ls -lh ./database/production.db

# Open and inspect
sqlite3 ./database/production.db

# Check database integrity
sqlite3 ./database/production.db "PRAGMA integrity_check;"

# Check foreign keys are enabled
sqlite3 ./database/production.db "PRAGMA foreign_keys;"

# Export schema
sqlite3 ./database/production.db ".schema" > schema.sql

# Backup database
cp ./database/production.db ./database/backup_$(date +%Y%m%d_%H%M%S).db
```

### Authentication Issues

```javascript
// Check current user
console.log(authStore.currentUser)
console.log(authStore.isAuthenticated)

// Check permissions
console.log(authStore.isAdmin)
console.log(authStore.canAccessRoute('/global-settings'))
```

### Translation Missing

```javascript
// Check if key exists
console.log($t('category.key'))

// Add fallback
{
  {
    $t('category.key', 'Fallback Text')
  }
}
```

---

## 📝 Notes for AI Assistants

### When Working with Database

- Always check `dbStore.canPerformOperations` before operations
- Use repositories for data access, never direct SQL in components
- Follow the repository pattern: View → Store → Repository → Database
- Handle errors gracefully with try-catch and user notifications
- Foreign keys are **enabled** - CASCADE deletes work automatically
- Use transactions for multi-step operations
- Patient deletion automatically cascades to visits, observations, and notes

### When Creating UI Components

- Follow Quasar component conventions
- Use I18n for all user-facing text
- Implement proper loading states
- Add appropriate error handling and user feedback
- Use reactive refs and computed properties

### When Modifying Architecture

- Maintain clean MVC separation
- Keep stores focused on single responsibility
- Use services for complex business logic coordination
- Keep views thin - move logic to stores/services
- Write tests for new functionality

### Code Style

- Use Vue 3 Composition API (`<script setup>`)
- Use Pinia for state management
- Use Quasar UI components
- Use async/await for async operations
- Follow existing naming conventions
- Add JSDoc comments for complex functions

---

## 🔗 Quick Links

- **Main Entry**: `src/App.vue`
- **Router**: `src/router/routes.js`
- **Database Service**: `src/core/services/database-service.js`
- **Main Store**: `src/stores/database-store.js`
- **Main Layout**: `src/layouts/MainLayout.vue`
- **Seed Data**: `src/core/database/seeds/`
- **Tests**: `tests/unit/` and `tests/integration/`

---

**Last Updated**: December 30, 2025  
**Version**: 1.0.0  
**Database Schema Version**: 002 (Current)
