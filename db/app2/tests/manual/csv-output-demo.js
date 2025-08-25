#!/usr/bin/env node

/**
 * CSV Output Demo
 * 
 * This script demonstrates the CSV service output by generating actual CSV files
 * and writing them to the tests/output directory.
 */

import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { CsvService } from '../../src/core/services/csv-service.js'

// Mock repositories for demo
const mockConceptRepository = {
  findByConceptCode: (code) => {
    const conceptMap = {
      'LOINC:8302-2': { NAME_CHAR: 'Body Height' },
      'LOINC:29463-7': { NAME_CHAR: 'Body Weight' },
      'LOINC:8480-6': { NAME_CHAR: 'Systolic Blood Pressure' },
      'LOINC:8462-4': { NAME_CHAR: 'Diastolic Blood Pressure' },
      'LOINC:33747-0': { NAME_CHAR: 'General Appearance' },
      'TEST:001': { NAME_CHAR: 'Test Concept 1' },
      'TEST:002': { NAME_CHAR: 'Test Concept 2' }
    }
    return conceptMap[code] || { NAME_CHAR: code }
  }
}

const mockCqlRepository = {
  getCqlRules: () => []
}

// Sample clinical data
const samplePatients = [
  {
    PATIENT_NUM: 1,
    PATIENT_CD: 'PAT001',
    SEX_CD: 'M',
    AGE_IN_YEARS: 45,
    BIRTH_DATE: '1978-03-15'
  },
  {
    PATIENT_NUM: 2,
    PATIENT_CD: 'PAT002',
    SEX_CD: 'F',
    AGE_IN_YEARS: 32,
    BIRTH_DATE: '1991-07-22'
  },
  {
    PATIENT_NUM: 3,
    PATIENT_CD: 'PAT003',
    SEX_CD: 'M',
    AGE_IN_YEARS: 67,
    BIRTH_DATE: '1956-11-08'
  }
]

const sampleVisits = [
  {
    ENCOUNTER_NUM: 1,
    PATIENT_NUM: 1,
    START_DATE: '2024-01-15',
    LOCATION_CD: 'EMERGENCY',
    INOUT_CD: 'I'
  },
  {
    ENCOUNTER_NUM: 2,
    PATIENT_NUM: 1,
    START_DATE: '2024-02-20',
    LOCATION_CD: 'OUTPATIENT',
    INOUT_CD: 'O'
  },
  {
    ENCOUNTER_NUM: 3,
    PATIENT_NUM: 2,
    START_DATE: '2024-01-10',
    LOCATION_CD: 'OUTPATIENT',
    INOUT_CD: 'O'
  },
  {
    ENCOUNTER_NUM: 4,
    PATIENT_NUM: 3,
    START_DATE: '2024-01-25',
    LOCATION_CD: 'INPATIENT',
    INOUT_CD: 'I'
  }
]

const sampleObservations = [
  // Patient 1, Visit 1 (Emergency)
  { ENCOUNTER_NUM: 1, CONCEPT_CD: 'LOINC:8302-2', VALTYPE_CD: 'N', NVAL_NUM: 180 },
  { ENCOUNTER_NUM: 1, CONCEPT_CD: 'LOINC:29463-7', VALTYPE_CD: 'N', NVAL_NUM: 85 },
  { ENCOUNTER_NUM: 1, CONCEPT_CD: 'LOINC:8480-6', VALTYPE_CD: 'N', NVAL_NUM: 140 },
  { ENCOUNTER_NUM: 1, CONCEPT_CD: 'LOINC:8462-4', VALTYPE_CD: 'N', NVAL_NUM: 90 },
  { ENCOUNTER_NUM: 1, CONCEPT_CD: 'LOINC:33747-0', VALTYPE_CD: 'T', TVAL_CHAR: 'Alert and oriented' },
  
  // Patient 1, Visit 2 (Follow-up)
  { ENCOUNTER_NUM: 2, CONCEPT_CD: 'LOINC:8302-2', VALTYPE_CD: 'N', NVAL_NUM: 180 },
  { ENCOUNTER_NUM: 2, CONCEPT_CD: 'LOINC:29463-7', VALTYPE_CD: 'N', NVAL_NUM: 83 },
  { ENCOUNTER_NUM: 2, CONCEPT_CD: 'LOINC:8480-6', VALTYPE_CD: 'N', NVAL_NUM: 135 },
  { ENCOUNTER_NUM: 2, CONCEPT_CD: 'LOINC:8462-4', VALTYPE_CD: 'N', NVAL_NUM: 85 },
  
  // Patient 2, Visit 1
  { ENCOUNTER_NUM: 3, CONCEPT_CD: 'LOINC:8302-2', VALTYPE_CD: 'N', NVAL_NUM: 165 },
  { ENCOUNTER_NUM: 3, CONCEPT_CD: 'LOINC:29463-7', VALTYPE_CD: 'N', NVAL_NUM: 62 },
  { ENCOUNTER_NUM: 3, CONCEPT_CD: 'LOINC:8480-6', VALTYPE_CD: 'N', NVAL_NUM: 120 },
  { ENCOUNTER_NUM: 3, CONCEPT_CD: 'LOINC:8462-4', VALTYPE_CD: 'N', NVAL_NUM: 80 },
  { ENCOUNTER_NUM: 3, CONCEPT_CD: 'LOINC:33747-0', VALTYPE_CD: 'T', TVAL_CHAR: 'Well appearing' },
  
  // Patient 3, Visit 1
  { ENCOUNTER_NUM: 4, CONCEPT_CD: 'LOINC:8302-2', VALTYPE_CD: 'N', NVAL_NUM: 175 },
  { ENCOUNTER_NUM: 4, CONCEPT_CD: 'LOINC:29463-7', VALTYPE_CD: 'N', NVAL_NUM: 92 },
  { ENCOUNTER_NUM: 4, CONCEPT_CD: 'LOINC:8480-6', VALTYPE_CD: 'N', NVAL_NUM: 160 },
  { ENCOUNTER_NUM: 4, CONCEPT_CD: 'LOINC:8462-4', VALTYPE_CD: 'N', NVAL_NUM: 95 },
  { ENCOUNTER_NUM: 4, CONCEPT_CD: 'LOINC:33747-0', VALTYPE_CD: 'T', TVAL_CHAR: 'Appears ill' },
  {
    ENCOUNTER_NUM: 4,
    CONCEPT_CD: 'TEST:001',
    VALTYPE_CD: 'B',
    OBSERVATION_BLOB: '{"diagnosis": "hypertension", "severity": "moderate", "notes": "Patient requires medication adjustment"}'
  }
]

async function generateCsvDemo() {
  console.log('🔄 Generating CSV demo files...')
  
  // Create CSV service
  const csvService = new CsvService(mockConceptRepository, mockCqlRepository)
  
  // Ensure output directory exists
  const outputDir = resolve(dirname(import.meta.url.replace('file://', '')), '../output')
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }
  
  try {
    // Generate CSV content
    const exportOptions = {
      patients: samplePatients,
      visits: sampleVisits,
      observations: sampleObservations,
      metadata: {
        title: 'Clinical Data Export Demo',
        author: 'CSV Service Test',
        exportDate: new Date().toISOString().split('T')[0],
        source: 'Demo Data Generator',
        version: '1.0'
      }
    }
    
    console.log('📊 Exporting clinical data...')
    const csvContent = await csvService.exportToCsv(exportOptions)
    
    // Write to file
    const csvFilePath = resolve(outputDir, 'clinical-data-export-demo.csv')
    await writeFile(csvFilePath, csvContent, 'utf-8')
    
    console.log(`✅ CSV file written to: ${csvFilePath}`)
    console.log(`📏 File size: ${csvContent.length} characters`)
    console.log(`📋 Data summary:`)
    console.log(`   - ${samplePatients.length} patients`)
    console.log(`   - ${sampleVisits.length} visits`)
    console.log(`   - ${sampleObservations.length} observations`)
    
    // Show first few lines
    const lines = csvContent.split('\n')
    console.log(`\n📄 First 10 lines of CSV:`)
    lines.slice(0, 10).forEach((line, index) => {
      console.log(`${String(index + 1).padStart(2, ' ')}: ${line}`)
    })
    
    if (lines.length > 10) {
      console.log(`   ... (${lines.length - 10} more lines)`)
    }
    
    // Generate a simple CSV for testing import
    const simpleExportOptions = {
      patients: [samplePatients[0]],
      visits: [sampleVisits[0]],
      observations: sampleObservations.filter(obs => obs.ENCOUNTER_NUM === 1),
      metadata: {
        title: 'Simple Test Export',
        author: 'Test User'
      }
    }
    
    const simpleCsvContent = await csvService.exportToCsv(simpleExportOptions)
    const simpleCsvPath = resolve(outputDir, 'simple-test-export.csv')
    await writeFile(simpleCsvPath, simpleCsvContent, 'utf-8')
    
    console.log(`\n✅ Simple test CSV written to: ${simpleCsvPath}`)
    
    // Test import functionality
    console.log('\n🔄 Testing CSV import...')
    const importResult = await csvService.importFromCsv(simpleCsvContent)
    
    if (importResult.success) {
      console.log('✅ CSV import successful!')
      console.log(`   - Imported ${importResult.data.patients.length} patients`)
      console.log(`   - Imported ${importResult.data.visits.length} visits`)
      console.log(`   - Imported ${importResult.data.observations.length} observations`)
      if (importResult.metadata) {
        console.log(`   - Metadata: ${JSON.stringify(importResult.metadata, null, 2)}`)
      }
    } else {
      console.log('❌ CSV import failed:')
      importResult.errors?.forEach(error => {
        console.log(`   - ${error.message}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error generating CSV demo:', error.message)
    console.error(error.stack)
  }
}

// Run the demo
generateCsvDemo().catch(console.error)
