# BEST - Scientific DB Manager

A modern research database for neuroscientific data built with Vue 3, Quasar, and SQLite.

## Features

- **Modern Architecture**: Clean separation of concerns with repository pattern
- **SQLite Database**: Local database with proper migrations and schema management
- **Patient Management**: Full CRUD operations for patient data
- **Visit Management**: Medical encounter tracking and lifecycle management
- **Clinical Observations**: Multi-type value storage (Numeric, Text, BLOB) with analytics
- **Data Validation**: Comprehensive validation layer with CQL rule integration
- **Migration System**: Automated database schema management with seed data
- **Type Safety**: Modern JavaScript with proper error handling and validation
- **Responsive UI**: Beautiful Quasar-based interface
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
│   ├── services/           # Business services
│   └── validators/         # Data validation
├── infrastructure/         # External integrations
├── presentation/           # UI layer
│   ├── components/        # Vue components
│   ├── pages/             # Route pages
│   ├── stores/            # Pinia stores
│   └── layouts/           # App layouts
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

## Vue Components → Database Flow

### Data Flow Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                      VUE COMPONENTS                             │
├─────────────────────────────────────────────────────────────────┤
│  DatabaseTest.vue    │  PatientList.vue   │  ObservationEdit   │
│  ┌─────────────────┐ │ ┌────────────────┐ │ ┌────────────────┐ │
│  │ • initDatabase()│ │ │ • loadPatients │ │ │ • saveObserv() │ │
│  │ • createPatient│ │ │ • searchPatient│ │ │ • updateObserv │ │
│  │ • searchPatient│ │ │ • deletePatient│ │ │ • deleteObserv │ │
│  │ • showStats()  │ │ │ • showDetails  │ │ │ • validateData │ │
│  └─────────────────┘ │ └────────────────┘ │ └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PINIA STORES                              │
├─────────────────────────────────────────────────────────────────┤
│  useDatabaseStore()  │  usePatientStore() │  useObservStore()  │
│  ┌─────────────────┐ │ ┌────────────────┐ │ ┌────────────────┐ │
│  │ State:          │ │ │ State:         │ │ │ State:         │ │
│  │ • isConnected   │ │ │ • patients[]   │ │ │ • observations│ │
│  │ • isLoading     │ │ │ • currentPat   │ │ │ • currentObs   │ │
│  │ • statistics    │ │ │ • searchTerm   │ │ │ • filters      │ │
│  │                 │ │ │                │ │ │                │ │
│  │ Actions:        │ │ │ Actions:       │ │ │ Actions:       │ │
│  │ • initDatabase()│ │ │ • createPat()  │ │ │ • createObs()  │ │
│  │ • closeDatabase│ │ │ • findPatients │ │ │ • findObservs  │ │
│  │ • resetDatabase│ │ │ • updatePat()  │ │ │ • updateObs()  │ │
│  └─────────────────┘ │ └────────────────┘ │ └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE SERVICE                             │
├─────────────────────────────────────────────────────────────────┤
│                    databaseService                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • getPatientRepository() ──────────────────────────────┐│   │
│  │ • getVisitRepository()   ──────────────────────────────││   │
│  │ • getObservationRepository() ──────────────────────────││   │
│  │ • executeQuery(sql, params)                            ││   │
│  │ • executeTransaction(commands[])                       ││   │
│  │ • initializeDatabase(path)                             ││   │
│  └─────────────────────────────────────────────────────────┘│   │
└─────────────────────────────────────────────────────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     REPOSITORIES                                │
├─────────────────────────────────────────────────────────────────┤
│  PatientRepository   │ VisitRepository    │ ObservationRepo     │
│  ┌─────────────────┐ │ ┌────────────────┐ │ ┌────────────────┐ │
│  │ • createPatient │ │ │ • createVisit  │ │ │ • createObserv │ │
│  │ • findByCode()  │ │ │ • findByPatient│ │ │ • findByVisit  │ │
│  │ • findByCriteria│ │ │ • findByDate   │ │ │ • findByConcept│ │
│  │ • updatePatient │ │ │ • updateVisit  │ │ │ • updateObserv │ │
│  │ • deletePatient │ │ │ • deleteVisit  │ │ │ • deleteObserv │ │
│  │ • searchPatients│ │ │ • getStatistics│ │ │ • getStatistics│ │
│  │ • getStatistics │ │ │                │ │ │                │ │
│  └─────────────────┘ │ └────────────────┘ │ └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
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
                    │ patient.db      │
                    │ research.db     │
                    │ test.db         │
                    │                 │
                    └─────────────────┘

Error Handling Flow:
Database Error ──► Repository ──► Service ──► Store ──► Component ──► User Notification
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
  AGE_IN_YEARS: 25
})

// Find patients
const patients = await dbStore.findPatients({
  SEX_CD: 'M',
  ageRange: { min: 20, max: 30 }
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
  INOUT_CD: 'I'
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
  UNIT_CD: 'mmHg'
})

// Create survey observation
const survey = await dbStore.createObservation({
  PATIENT_NUM: 1,
  ENCOUNTER_NUM: 1,
  CONCEPT_CD: 'SURVEY:SAMS',
  VALTYPE_CD: 'T',
  TVAL_CHAR: '{"anxiety": 3, "depression": 2}'
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
  metadata: { field: 'BLOOD_PRESSURE' }
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
  precision: 1
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

### 🎯 **Phase 1 & 2 Complete - Ready for UI Development**
- [x] **All Core Repositories**: 100% implemented and tested
- [x] **Business Services**: CSV and HL7 import/export complete
- [x] **Data Validation**: Comprehensive validation with CQL integration
- [x] **Testing Coverage**: 374 tests with 100% pass rate

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

## Contributing

1. **Follow Architecture Patterns**: Use the established clean architecture with repository pattern
2. **Repository Implementation**: Extend BaseRepository for new entities with comprehensive CRUD operations
3. **Error Handling**: Implement proper error handling and validation throughout
4. **Testing**: Write unit tests for all new functionality (aim for 100% test coverage)
5. **Documentation**: Update README.md and relevant documentation files
6. **Performance**: Consider performance implications for large datasets
7. **Clinical Data**: Follow healthcare data standards and validation requirements

### Development Workflow
```bash
# 1. Create new repository (if needed)
# 2. Implement comprehensive functionality
# 3. Write unit tests (aim for 25+ tests per repository)
# 4. Run test suite: npm test -- --run
# 5. Update documentation
# 6. Create integration tests for real database testing
```

## License

This project is part of the BEST (Base for Experiment Storage & Tracking) system.
