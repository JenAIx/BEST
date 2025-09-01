# Import Services

This directory contains the import functionality for the dbBEST system, supporting multiple clinical data formats. The import system is designed to be modular, extensible, and maintain data integrity during the import process.

## Supported Import Formats

The system supports four main import formats, each designed to handle different types of clinical data:

### 1. CSV (Comma-Separated Values)

**File Extension**: `.csv`
**Use Case**: Bulk data import from spreadsheets or other EHR systems
**Structure**: Two-header format (human-readable + concept codes)

#### CSV Format Structure

```csv
# Export Date: 2024-01-15
# Source: EHR System
# Version: 1.0

Patient ID,Gender,Age,Date of Birth,Visit Date,Location,Type,Body Height,Body Weight
PATIENT_CD,SEX_CD,AGE_IN_YEARS,BIRTH_DATE,START_DATE,LOCATION_CD,INOUT_CD,LOINC:8302-2,LOINC:29463-7
PAT001,M,45,1978-03-15,2024-01-15,EMERGENCY,I,180,85
PAT002,F,32,1991-07-22,2024-01-10,OUTPATIENT,O,165,62
```

#### CSV Import Features

- **Two-header system**: First row for human readability, second row for concept codes
- **Flexible column mapping**: Supports variable column orders
- **Data validation**: Validates required fields and data types
- **Automatic type detection**: Numeric, text, date, and JSON blob detection
- **Error reporting**: Detailed validation errors with row/column information

### 2. JSON (JavaScript Object Notation)

**File Extension**: `.json`
**Use Case**: Native JSON data import from APIs or modern systems
**Structure**: Structured clinical data with nested objects

#### JSON Format Structure

```json
{
  "metadata": {
    "exportDate": "2024-01-15T10:30:00Z",
    "source": "Clinical API",
    "version": "1.0",
    "author": "System Export"
  },
  "patients": [
    {
      "PATIENT_CD": "PAT001",
      "SEX_CD": "M",
      "AGE_IN_YEARS": 45,
      "BIRTH_DATE": "1978-03-15",
      "vital_status": "Alive"
    }
  ],
  "visits": [
    {
      "PATIENT_NUM": 1,
      "START_DATE": "2024-01-15T09:00:00Z",
      "LOCATION_CD": "EMERGENCY",
      "INOUT_CD": "I",
      "VISIT_BLOB": "{\"notes\": \"Patient presented with chest pain\"}"
    }
  ],
  "observations": [
    {
      "PATIENT_NUM": 1,
      "ENCOUNTER_NUM": 1,
      "CONCEPT_CD": "LOINC:8302-2",
      "VALTYPE_CD": "N",
      "NVAL_NUM": 180,
      "START_DATE": "2024-01-15T09:15:00Z",
      "SOURCESYSTEM_CD": "JSON_IMPORT"
    }
  ]
}
```

#### JSON Import Features

- **Structured data**: Hierarchical organization of clinical data
- **Metadata support**: Rich metadata for audit trails
- **Validation**: JSON schema validation
- **Relationship preservation**: Maintains patient-visit-observation relationships
- **Bulk operations**: Efficient bulk insert operations

### 3. HL7 FHIR JSON CDA (Clinical Document Architecture)

**File Extension**: `.json`
**Use Case**: Standards-compliant clinical document import
**Structure**: FHIR-compliant CDA documents

#### HL7 CDA Format Structure

```json
{
  "resourceType": "Composition",
  "id": "dbBEST-export-uuid",
  "meta": {
    "versionId": "1.0",
    "lastUpdated": "2024-01-15T10:30:00Z",
    "source": "https://github.com/stebro01/dbBEST.git"
  },
  "language": "de-DE",
  "identifier": {
    "system": "urn:ietf:rfc:3986",
    "value": "urn:uuid:uuid-here"
  },
  "status": "preliminary",
  "type": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "404684003",
        "display": "Clinical Observation"
      }
    ]
  },
  "subject": {
    "display": "PAT001"
  },
  "date": "2024-01-15T10:30:00Z",
  "section": [
    {
      "title": "Patient Information",
      "entry": [
        {
          "title": "Patient ID",
          "code": [
            {
              "coding": [
                {
                  "system": "http://snomed.info/sct",
                  "code": "404684003",
                  "display": "Patient Code"
                }
              ]
            }
          ],
          "value": "PAT001"
        }
      ]
    }
  ],
  "hash": {
    "signature": "base64-encoded-hash",
    "method": "SHA256",
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "documentHash": "base64-hash"
  }
}
```

#### HL7 CDA Import Features

- **Standards compliance**: Full HL7 FHIR CDA R2 compliance
- **Digital signatures**: Verification of document integrity
- **Template support**: Multiple CDA templates for different use cases
- **Section parsing**: Structured parsing of CDA sections
- **Concept mapping**: Automatic mapping to internal concept codes
- **Validation**: CDA schema validation and business rule validation

### 4. HTML Survey BEST CDA

**File Extension**: `.html`
**Use Case**: Questionnaire and assessment data import
**Structure**: Embedded CDA JSON within HTML wrapper

#### HTML Survey Format Structure

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      CDA = {
        cda: {
          resourceType: 'Composition',
          id: 'QUESTIONNAIRE-surveyBEST',
          type: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '273249006',
                display: 'Assessment-Scale',
              },
            ],
          },
          subject: {
            display: 'DEMO',
          },
          section: [
            {
              title: 'Findings Section',
              entry: [
                {
                  title: 'traurigkeit',
                  code: [
                    {
                      coding: [
                        {
                          display: 'traurigkeit',
                          code: '709516007',
                          system: 'http://snomed.info/sct',
                        },
                      ],
                    },
                  ],
                  value: 1,
                },
              ],
            },
          ],
          hash: {
            signature: 'base64-signature',
            method: 'SHA256',
            investigator_uid: 'uuid-here',
          },
          info: {
            title: 'BDI 2',
            label: 'bdi2',
            PID: 'DEMO',
            date: 1756715209541,
            uid: 'questionnaire-uuid',
          },
        },
      }
    </script>
  </head>
  <body>
    <!-- HTML display of questionnaire results -->
    <div xmlns="http://www.w3.org/1999/xhtml">
      <h1>Questionnaire - surveyBEST</h1>
      <table id="results_table">
        <tr>
          <td>PID</td>
          <td>quest</td>
          <td>date</td>
          <td>sum</td>
          <td>traurigkeit</td>
          ...
        </tr>
        <tr>
          <td>DEMO</td>
          <td>bdi2</td>
          <td>2025-09-01T10:26:49GMT+0200</td>
          <td>32</td>
          <td>1</td>
          ...
        </tr>
      </table>
    </div>
  </body>
</html>
```

#### HTML Survey Import Features

- **Embedded CDA**: CDA JSON embedded in HTML `<script>` tag
- **Questionnaire support**: Specialized handling for assessment instruments
- **Scoring calculations**: Automatic calculation of questionnaire scores
- **HTML parsing**: Extraction of CDA from HTML wrapper
- **Assessment validation**: Validation of questionnaire responses
- **Result interpretation**: Automatic interpretation of assessment results

## Import Process Overview

### General Workflow

1. **File Upload**: User uploads file through ImportPage.vue
2. **Format Detection**: Automatic detection based on file extension and content
3. **Validation**: Format-specific validation and data integrity checks
4. **Transformation**: Convert external format to internal clinical data structure
5. **Database Import**: Bulk insert operations with transaction support
6. **Audit Trail**: Complete logging of import operations

### Data Validation Pipeline

1. **Structural Validation**: Format compliance and required fields
2. **Data Type Validation**: Correct data types and ranges
3. **Business Rule Validation**: Clinical business rules and constraints
4. **Duplicate Detection**: Identification of duplicate records
5. **Reference Integrity**: Validation of foreign key relationships

### Error Handling

- **Detailed Error Reporting**: Specific error messages with location information
- **Partial Import Support**: Continue import on non-critical errors
- **Rollback Support**: Transaction rollback on critical errors
- **Recovery Mechanisms**: Ability to resume failed imports

## Import Service Architecture

### Core Components

#### ImportService (Main Orchestrator)

- Format detection and routing
- Progress tracking and reporting
- Transaction management
- Error aggregation and reporting

#### Format-Specific Services

- **CsvImportService**: Handles CSV parsing and validation
- **JsonImportService**: Handles JSON parsing and transformation
- **Hl7ImportService**: Handles CDA parsing and FHIR compliance
- **HtmlSurveyImportService**: Handles HTML survey extraction

#### Supporting Services

- **ImportValidator**: Data validation and business rules
- **ImportTransformer**: Data transformation and mapping
- **ImportLogger**: Audit trail and progress logging

### Configuration

```javascript
const importConfig = {
  maxFileSize: '50MB',
  supportedFormats: ['csv', 'json', 'hl7', 'html'],
  validationLevel: 'strict',
  duplicateHandling: 'skip', // skip, update, error
  batchSize: 1000,
  transactionMode: 'single', // single, batch, none
}
```

## Implementation TODO List

### Phase 1: Core Infrastructure

- [ ] Create ImportService base class
- [ ] Implement format detection logic
- [ ] Set up import configuration system
- [ ] Create import result data structure
- [ ] Add import progress tracking

### Phase 2: CSV Import

- [ ] Create CsvImportService class
- [ ] Implement two-header CSV parsing
- [ ] Add CSV validation rules
- [ ] Implement concept code mapping
- [ ] Add CSV error reporting
- [ ] Create CSV import tests

### Phase 3: JSON Import

- [ ] Create JsonImportService class
- [ ] Implement JSON schema validation
- [ ] Add JSON data transformation
- [ ] Implement bulk JSON operations
- [ ] Add JSON import tests

### Phase 4: HL7 CDA Import

- [ ] Create Hl7ImportService class
- [ ] Implement CDA document parsing
- [ ] Add FHIR compliance validation
- [ ] Implement digital signature verification
- [ ] Add CDA section parsing
- [ ] Create HL7 import tests

### Phase 5: HTML Survey Import

- [ ] Create HtmlSurveyImportService class
- [ ] Implement HTML CDA extraction
- [ ] Add questionnaire scoring logic
- [ ] Implement assessment result interpretation
- [ ] Add HTML survey validation
- [ ] Create HTML survey import tests

### Phase 6: Integration & UI

- [ ] Integrate import services with ImportPage.vue
- [ ] Update ImportPage.vue to use new services
- [ ] Add import progress indicators
- [ ] Implement import result display
- [ ] Add import history and audit trails

### Phase 7: Advanced Features

- [ ] Add import job queuing system
- [ ] Implement import resume functionality
- [ ] Add advanced duplicate handling
- [ ] Create import templates system
- [ ] Add import scheduling capabilities

### Phase 8: Testing & Documentation

- [ ] Write comprehensive unit tests for all services
- [ ] Create integration tests for end-to-end import flows
- [ ] Write import service documentation
- [ ] Create import troubleshooting guide
- [ ] Add import performance benchmarks

### Phase 9: Production Readiness

- [ ] Add import security validation
- [ ] Implement import rate limiting
- [ ] Add import monitoring and alerting
- [ ] Create import backup and recovery procedures
- [ ] Add import compliance logging

## File Organization

```
src/core/services/imports/
├── README.md                          # This file
├── index.js                           # Main export file
├── import-service.js                  # Main orchestrator service
├── validators/
│   ├── import-validator.js           # General validation logic
│   └── format-validators.js          # Format-specific validators
├── transformers/
│   ├── csv-transformer.js            # CSV data transformation
│   ├── json-transformer.js           # JSON data transformation
│   ├── hl7-transformer.js            # HL7 CDA transformation
│   └── html-survey-transformer.js    # HTML survey transformation
├── parsers/
│   ├── csv-parser.js                 # CSV parsing logic
│   ├── json-parser.js                # JSON parsing logic
│   ├── hl7-parser.js                 # HL7 CDA parsing logic
│   └── html-parser.js                # HTML survey parsing logic
├── services/
│   ├── csv-import-service.js         # CSV import implementation
│   ├── json-import-service.js        # JSON import implementation
│   ├── hl7-import-service.js         # HL7 import implementation
│   └── html-survey-import-service.js # HTML survey import implementation
└── utils/
    ├── import-utils.js               # Common import utilities
    ├── progress-tracker.js           # Import progress tracking
    └── error-handler.js              # Import error handling
```

## Usage Examples

### Basic Import Usage

```javascript
import { ImportService } from './imports/import-service.js'

const importService = new ImportService(databaseService)

// Import CSV file
const csvResult = await importService.importFile(csvFile, {
  format: 'csv',
  options: {
    validateData: true,
    duplicateHandling: 'skip',
  },
})

// Import HL7 CDA file
const hl7Result = await importService.importFile(hl7File, {
  format: 'hl7',
  options: {
    verifySignature: true,
    createMissingPatients: true,
  },
})
```

### Advanced Configuration

```javascript
const advancedOptions = {
  format: 'csv',
  options: {
    validationLevel: 'strict',
    batchSize: 500,
    transactionMode: 'batch',
    duplicateHandling: 'update',
    createMissingConcepts: true,
    importMetadata: true,
  },
  callbacks: {
    onProgress: (progress) => console.log(`Import: ${progress}%`),
    onError: (error) => console.error('Import error:', error),
    onComplete: (result) => console.log('Import completed:', result),
  },
}
```

## Error Handling

### Common Import Errors

- **File Format Errors**: Invalid file format or corrupted files
- **Validation Errors**: Data validation failures with specific field information
- **Duplicate Errors**: Handling of duplicate records based on configuration
- **Reference Errors**: Missing foreign key references
- **Permission Errors**: Insufficient permissions for import operations

### Error Response Format

```json
{
  "success": false,
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Invalid patient ID format",
      "field": "PATIENT_CD",
      "row": 5,
      "details": "Patient ID must be alphanumeric"
    }
  ],
  "warnings": [
    {
      "code": "DUPLICATE_DETECTED",
      "message": "Duplicate patient record found",
      "details": "Patient PAT001 already exists"
    }
  ],
  "stats": {
    "processed": 95,
    "successful": 90,
    "failed": 5,
    "warnings": 3
  }
}
```

## Performance Considerations

### Import Performance Optimization

- **Batch Processing**: Process records in configurable batches
- **Transaction Management**: Use appropriate transaction sizes
- **Index Optimization**: Ensure database indexes for import performance
- **Memory Management**: Stream processing for large files
- **Concurrent Processing**: Parallel processing where appropriate

### Performance Benchmarks

- **CSV Import**: ~1000 records/second (depending on validation level)
- **JSON Import**: ~500 records/second (with complex validation)
- **HL7 Import**: ~200 documents/second (with signature verification)
- **HTML Survey**: ~100 surveys/second (with scoring calculations)

## Security Considerations

### Import Security Features

- **File Type Validation**: Strict file type checking
- **Content Validation**: Malicious content detection
- **Size Limits**: Configurable file size limits
- **Rate Limiting**: Import rate limiting to prevent abuse
- **Audit Logging**: Complete audit trail of all import operations

### Data Privacy

- **PHI Protection**: Ensure proper handling of protected health information
- **Access Control**: Role-based import permissions
- **Data Encryption**: Encrypt sensitive data during processing
- **Compliance Logging**: HIPAA/GDPR compliance logging

---

## Next Steps

1. Start with Phase 1: Create the core ImportService infrastructure
2. Implement CSV import first (most commonly used format)
3. Add comprehensive testing for each format
4. Integrate with the existing ImportPage.vue
5. Add monitoring and performance optimization

This import system will provide a robust, scalable solution for importing clinical data from various sources while maintaining data integrity and compliance standards.
