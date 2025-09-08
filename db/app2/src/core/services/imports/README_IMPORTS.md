# Import Services - Modular Architecture

This directory contains the modular import functionality for the dbBEST system, supporting multiple clinical data formats. The import system is designed to be modular, extensible, and maintain data integrity during the import process.

## Architecture Overview

The new modular import system consists of:

### Core Modules

- **`import-structure.js`** - Standardized data structure definition and creation
- **`import-filetype.js`** - File format detection and validation
- **`import-service.js`** - Main orchestrator service

### Format-Specific Services

- **`import-csv-service.js`** - CSV parsing and transformation
- **`import-json-service.js`** - JSON data processing
- **`import-hl7-service.js`** - HL7 FHIR CDA document handling
- **`import-survey-service.js`** - HTML survey extraction and processing

### Frontend Integration

- **`import-store.js`** - Pinia store for import state management
- **`ImportPage.vue`** - Main import UI component
- **`ImportPreviewDialog.vue`** - Data preview and selection dialog

## Supported Import Formats

### 1. CSV (Comma-Separated Values)

**File Extensions**: `.csv`
**Use Case**: Bulk data import from spreadsheets or EHR systems

#### CSV Format Variants

**Variant A: Full App Export Format** (`01_csv_data.csv`)

- Two-header system: Human-readable + concept codes
- Comma-delimited
- Round-trip compatibility with dbBEST export

**Variant B: Condensed Format** (`Export-Tabelle-20230313.csv`)

- Four-header system: FIELD_NAME + VALTYPE_CD + NAME_CHAR + data
- Semicolon-delimited
- Interoperability with other EHR systems

#### Features

- Automatic delimiter detection (comma vs semicolon)
- Intelligent format variant detection
- Data type validation based on VALTYPE_CD
- Comprehensive error reporting

### 2. JSON (JavaScript Object Notation)

**File Extensions**: `.json`
**Use Case**: Native JSON data import from APIs or modern systems

#### Structure

```json
{
  "metadata": { "exportDate": "2024-01-15T10:30:00Z" },
  "patients": [{ "PATIENT_CD": "PAT001", "SEX_CD": "M" }],
  "visits": [{ "PATIENT_NUM": 1, "START_DATE": "2024-01-15T09:00:00Z" }],
  "observations": [{ "PATIENT_NUM": 1, "CONCEPT_CD": "LOINC:8302-2" }]
}
```

#### Features

- Hierarchical data organization
- Metadata preservation
- Relationship maintenance
- Schema validation

### 3. HL7 FHIR CDA (Clinical Document Architecture)

**File Extensions**: `.hl7`, `.xml`
**Use Case**: Standards-compliant clinical document import

#### Structure

```json
{
  "resourceType": "Composition",
  "id": "dbBEST-0d09f737-1ede-4cad-973d-8fc3d1e739a4",
  "meta": { "versionId": "1.0", "source": "BEST Medical System" },
  "section": [{ "title": "Patient Information", "entry": [...] }]
}
```

#### Features

- FHIR CDA R2 compliance
- Digital signature verification
- Section parsing and extraction
- Concept mapping

### 4. HTML Survey BEST CDA

**File Extensions**: `.html`, `.htm`
**Use Case**: Questionnaire and assessment data import

#### Structure

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      CDA = {
        cda: {
          resourceType: 'Composition',
          section: [{ title: 'Findings Section', entry: [...] }]
        },
        info: { title: 'BDI 2', PID: 'DEMO', date: 1756715209541 }
      }
    </script>
  </head>
  <body>
    <!-- HTML display -->
  </body>
</html>
```

#### Features

- Embedded CDA extraction from HTML
- Questionnaire response processing
- Scoring calculations
- Assessment validation

## Import Structure

All import services use a standardized `importStructure` format:

```javascript
{
  metadata: {
    importDate: "2025-09-02T10:30:00Z",
    source: "filename.csv",
    format: "csv",
    patientCount: 2,
    visitCount: 4,
    observationCount: 46
  },
  exportInfo: {
    exportDate: "2025-09-01T08:31:47.595Z",
    source: "BEST Medical System",
    version: "1.0",
    author: "System Export"
  },
  data: {
    patients: [
      {
        PATIENT_CD: "DEMO_PATIENT_01",
        SEX_CD: "SCTID: 407374003",
        AGE_IN_YEARS: 32,
        BIRTH_DATE: "1993-05-10"
      }
    ],
    visits: [
      {
        PATIENT_NUM: 1,
        ENCOUNTER_NUM: 1,
        START_DATE: "2024-11-29T00:00:00.000Z",
        END_DATE: "2024-11-29T00:00:00.000Z",
        LOCATION_CD: "DEMO_HOSPITAL/INTERNAL",
        INOUT_CD: "E"
      }
    ],
    observations: [
      {
        OBSERVATION_ID: 1,
        ENCOUNTER_NUM: 1,
        PATIENT_NUM: 1,
        CONCEPT_CD: "LID: 72172-0",
        VALTYPE_CD: "N",
        NVAL_NUM: 73,
        TVAL_CHAR: "MOCA Total Score"
      }
    ]
  },
  statistics: {
    patientCount: 2,
    visitCount: 4,
    observationCount: 46,
    questionnaireCount: 1
  }
}
```

## Import Process Flow

### 1. File Upload & Analysis

```javascript
// ImportPage.vue
const analysis = await importStore.analyzeFileContent(content, filename)
```

### 2. Format Detection

```javascript
// import-filetype.js
const format = detectFormat(content, filename)
// Returns: 'csv', 'json', 'hl7', 'html', or null
```

### 3. Service Routing

```javascript
// import-service.js
const service = this.getImportService(format)
const result = await service.importFromFormat(content, options)
```

### 4. Data Transformation

Each service transforms external format to `importStructure`:

- **CSV**: Parse headers, validate data types, map concepts
- **JSON**: Extract hierarchical data, preserve relationships
- **HL7**: Parse CDA sections, extract clinical data
- **HTML**: Extract CDA from script tags, process questionnaire

### 5. Preview & Selection

```javascript
// ImportPreviewDialog.vue
// Display hierarchical tree of patients, visits, observations
// Allow user to select what to import
```

### 6. Database Import

```javascript
// TODO: Implement actual database import
// Currently returns importStructure for preview only
```

## Current Implementation Status

### ✅ **COMPLETED**

#### Core Infrastructure

- [x] Modular architecture with separate concerns
- [x] Standardized `importStructure` format
- [x] File type detection and validation
- [x] Format-specific import services
- [x] Frontend integration with Pinia store
- [x] Preview dialog with hierarchical data display

#### Format Support

- [x] CSV import (both variants with auto-detection)
- [x] JSON import with schema validation
- [x] HL7 FHIR CDA import with section parsing
- [x] HTML survey import with CDA extraction

#### Testing

- [x] Comprehensive unit tests (122/122 passing)
- [x] Integration tests for all formats
- [x] Output generation for review (`./tests/output/`)

### 🚧 **IN PROGRESS**

#### Database Integration

- [ ] **CRITICAL**: Implement actual database import
- [ ] Connect import services to database operations
- [ ] Add transaction management and rollback
- [ ] Implement bulk insert operations
- [ ] Add duplicate handling strategies

#### UI Enhancements

- [ ] Real-time import progress tracking
- [ ] Import result visualization
- [ ] Error handling and recovery
- [ ] Import history and audit trails

### 📋 **TODO**

#### Database Import Implementation

```javascript
// TODO: Add to each import service
async importToDatabase(importStructure, options = {}) {
  const { dbStore } = options

  // 1. Validate data integrity
  await this.validateImportData(importStructure)

  // 2. Handle duplicates based on strategy
  const processedData = await this.handleDuplicates(importStructure, options.duplicateStrategy)

  // 3. Bulk insert operations
  await dbStore.bulkInsertPatients(processedData.patients)
  await dbStore.bulkInsertVisits(processedData.visits)
  await dbStore.bulkInsertObservations(processedData.observations)

  // 4. Update statistics and metadata
  await this.updateImportMetadata(importStructure.metadata)

  return { success: true, imported: processedData.statistics }
}
```

#### Advanced Features

- [ ] Multi-patient import strategies
- [ ] Conflict resolution algorithms
- [ ] Import job queuing
- [ ] Resume failed imports
- [ ] Performance optimization for large files

## File Organization

```
src/core/services/imports/
├── README_IMPORTS.md              # This documentation
├── import-structure.js            # Standardized data structure
├── import-filetype.js             # File format detection
├── import-service.js              # Main orchestrator
├── import-csv-service.js          # CSV import implementation
├── import-json-service.js         # JSON import implementation
├── import-hl7-service.js          # HL7 CDA import implementation
└── import-survey-service.js       # HTML survey import implementation

src/stores/
└── import-store.js                # Pinia store for import state

src/pages/
└── ImportPage.vue                 # Main import UI

src/components/shared/
└── ImportPreviewDialog.vue        # Data preview dialog

tests/
├── integration/
│   └── 09_import-services-integration.test.js
└── output/                        # Generated import structures
    ├── output_04_surveybest_html_2025-09-02.json
    ├── output_02_json_2025-09-02.json
    ├── output_03_hl7_fhir_json_cda_hl7_2025-09-02.json
    └── output_Export-Tabelle-20230313_csv_2025-09-02.json
```

## Usage Examples

### Basic Import Analysis

```javascript
import { useImportStore } from '@/stores/import-store'

const importStore = useImportStore()
const analysis = await importStore.analyzeFileContent(fileContent, filename)

// analysis contains:
// - format detection
// - importStructure with parsed data
// - statistics (patient/visit/observation counts)
// - recommended import strategy
```

### Preview Import Data

```javascript
// ImportPreviewDialog.vue automatically displays:
// - Hierarchical tree of patients, visits, observations
// - Metadata for each item (age, sex, dates, values)
// - Selection checkboxes for import control
// - Import strategy recommendations
```

### Import to Database (TODO)

```javascript
// TODO: Implement actual database import
const result = await importStore.importFile(fileContent, filename, {
  mode: 'create_missing',
  patientMode: 'auto',
  duplicateStrategy: 'skip',
})
```

## Key Features

### Intelligent Format Detection

- Extension-based detection (`.csv`, `.json`, `.hl7`, `.html`)
- Content-based fallback analysis
- Automatic delimiter detection for CSV
- CDA pattern recognition in HTML

### Standardized Data Structure

- Consistent `importStructure` across all formats
- Rich metadata and statistics
- Hierarchical patient-visit-observation relationships
- Audit trail and provenance information

### User-Friendly Preview

- Tree-based data visualization
- Detailed metadata display
- Selective import capabilities
- Import strategy recommendations

### Robust Error Handling

- Comprehensive validation at each step
- Detailed error reporting with context
- Graceful degradation for partial failures
- User-friendly error messages

## Next Steps

### Immediate Priority: Database Import

1. **Implement database operations** in each import service
2. **Add transaction management** for data integrity
3. **Create bulk insert methods** for performance
4. **Add duplicate handling** strategies
5. **Connect UI to actual import** (replace simulation)

### Medium Priority: Enhanced Features

1. **Multi-patient import** strategies
2. **Conflict resolution** algorithms
3. **Import progress** tracking
4. **Error recovery** mechanisms
5. **Performance optimization** for large files

### Long-term: Advanced Capabilities

1. **Import job queuing** system
2. **Resume failed imports**
3. **Import templates** and scheduling
4. **Real-time monitoring** and alerting
5. **Compliance logging** (HIPAA/GDPR)

## Test Data

The system has been validated against real test files in `/tests/input/test_import/`:

- **`01_csv_data.csv`**: 2 patients, 4 visits, 46+ observations
- **`02_json.json`**: Structured JSON with metadata
- **`03_hl7_fhir_json_cda.hl7`**: FHIR CDA document
- **`04_surveybest.html`**: BDI-II questionnaire with embedded CDA
- **`Export-Tabelle-20230313.csv`**: Large German clinical dataset

Generated output files in `/tests/output/` demonstrate the import structure for each format.

---

**Current Status**: ✅ **Analysis and Preview Complete** | 🚧 **Database Import TODO**

The modular import system successfully analyzes and previews all supported formats. The next critical step is implementing the actual database import functionality to complete the end-to-end import workflow.
