/**
 * CSV Data Loader
 *
 * Provides CSV data for seeding the database.
 * This module handles both Vite (browser) and Node.js (test) environments.
 */

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined'

let conceptsData, cqlRulesData, conceptCqlLookupsData, standardUsersData, codeLookupData

if (isBrowser) {
  // Browser/Vite environment - use dynamic imports with ?raw
  try {
    conceptsData = await import('./concept_dimension_data.csv?raw').then((m) => m.default)
    cqlRulesData = await import('./cql_fact_data.csv?raw').then((m) => m.default)
    conceptCqlLookupsData = await import('./concept_cql_lookup_data.csv?raw').then((m) => m.default)
    standardUsersData = await import('./standard-users.csv?raw').then((m) => m.default)
    codeLookupData = await import('./code_lookup_data.csv?raw').then((m) => m.default)
  } catch (error) {
    console.warn('Failed to load CSV files via Vite, falling back to embedded data:', error)
  }
} else {
  // Node.js environment - use dynamic imports to avoid browser issues
  try {
    const { readFileSync } = await import('fs')
    const { join, dirname } = await import('path')
    const { fileURLToPath } = await import('url')

    // Get current directory for file paths
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)

    conceptsData = readFileSync(join(__dirname, 'concept_dimension_data.csv'), 'utf-8')
    cqlRulesData = readFileSync(join(__dirname, 'cql_fact_data.csv'), 'utf-8')
    conceptCqlLookupsData = readFileSync(join(__dirname, 'concept_cql_lookup_data.csv'), 'utf-8')
    standardUsersData = readFileSync(join(__dirname, 'standard-users.csv'), 'utf-8')
    codeLookupData = readFileSync(join(__dirname, 'code_lookup_data.csv'), 'utf-8')
    console.log('✅ Successfully loaded CSV files from filesystem')
  } catch (error) {
    console.warn('Failed to load CSV files from filesystem, falling back to embedded data:', error)
  }
}

// Fallback embedded data if loading fails
if (!conceptsData) {
  // Essential concepts for testing - include the real LOINC/SNOMED concepts we need
  conceptsData = `CONCEPT_PATH,CONCEPT_CD,NAME_CHAR,VALTYPE_CD,UNIT_CD,RELATED_CONCEPT,CONCEPT_BLOB,UPDATE_DATE,DOWNLOAD_DATE,IMPORT_DATE,SOURCESYSTEM_CD,UPLOAD_ID,CATEGORY_CHAR
\\CONCEPT,GENERAL_CONCEPT,CONCEPT,S,,,,"2023-07-12 11:21:31",,2023-01-06,CUSTOM,79190712,General
\\LOINC\\ATOM\\BP\\8480-6,"LID: 8480-6","Blood pressure systolic",N,mmHg,,,"2023-07-12 11:19:13",,2023-01-03,LOINC,79190712,Vital Signs
\\LOINC\\ATOM\\BP\\8462-4,"LID: 8462-4","Blood pressure diastolic",N,mmHg,,,"2023-07-12 11:19:13",,2023-01-03,LOINC,79190712,Vital Signs
\\LOINC\\ATOM\\HRTRATE\\8867-4,"LID: 8867-4","Heart rate",N,beats/min,,,"2023-07-12 11:19:13",,2023-01-03,LOINC,79190712,Vital Signs
\\SNOMED-CT\\138875005\\363787002\\363788007\\363789004\\248326004\\363804004\\27113001\\27113001,"SCTID: 27113001","Body weight",N,kg,,,"2023-07-12 11:19:13",,2023-01-06,SNOMED-CT,79190712,Vital Signs
\\SNOMED-CT\\138875005\\363787002\\363788007\\363789004\\248326004\\363804004\\1153637007\\1153637007,"SCTID: 1153637007","Body height",N,cm,,,"2023-07-12 11:19:13",,2023-01-06,SNOMED-CT,79190712,Vital Signs
\\SNOMED-CT\\138875005\\363787002\\363788007\\363789004\\248326004\\363804004\\60621009\\60621009,"SCTID: 60621009","BMI (body mass index)",N,kg/m2,,,"2023-07-12 11:19:13",,2023-01-06,SNOMED-CT,79190712,Vital Signs
\\LOINC\\ADMIN.DEMOG\\Patient\\6298-4,"LID: 6298-4","Kalium in Blood",N,mmol/l,,,"2023-07-12 11:19:13",,2023-01-03,LOINC,79190712,Laboratory
\\LOINC\\ADMIN.DEMOG\\Patient\\2947-0,"LID: 2947-0","Natrium (mole/volume) in Blood",N,mmol/l,,,"2023-07-12 11:19:13",,2023-01-03,LOINC,79190712,Laboratory
\\LOINC\\ADMIN.DEMOG\\Patient\\38483-4,"LID: 38483-4","kreatinin (Mass/Voloume) in Blood",N,umol/l,,,"2023-07-12 11:19:13",,2023-01-03,LOINC,79190712,Laboratory
\\LOINC\\ADMIN.DEMOG\\Patient\\74246-8,"LID: 74246-8","Haemoglobin A1c/haemoglobin.total in Blood durch IFCC-protokoll",N,%,,,"2023-07-12 11:19:13",,2023-01-03,LOINC,79190712,Laboratory
\\LOINC\\ADMIN.DEMOG\\Patient\\18630-4,"LID: 18630-4","Primary Diagnosis",T,,,,"2023-07-12 11:19:13",,2023-01-03,LOINC,79190712,Diagnoses
\\LOINC\\ADMIN.DEMOG\\Patient\\52418-1,"LID: 52418-1","Current medication, Name",T,,,,"2023-07-12 11:19:13",,2023-01-03,LOINC,79190712,Medications
\\SNOMED-CT\\138875005\\363787002\\363788007\\363789004\\248326004\\363804004\\47965005\\47965005,"SCTID: 47965005","Differential diagnosis",T,,,,"2023-07-12 11:19:13",,2023-01-06,SNOMED-CT,79190712,Diagnoses
\\LOINC\\ADMIN.DEMOG\\Patient\\74287-4,"LID: 74287-4","Occupation",T,,,,"2023-07-12 11:19:13",,2023-01-03,LOINC,79190712,Demographics
\\SNOMED-CT\\138875005\\363787002\\363788007\\363789004\\248326004\\363804004\\262188008\\262188008,"SCTID: 262188008","Stress",T,,,,"2023-07-12 11:19:13",,2023-01-06,SNOMED-CT,79190712,General
\\SNOMED-CT\\138875005\\363787002\\363788007\\363789004\\248326004\\363804004\\399423000\\399423000,"SCTID: 399423000","Date of admission",D,,,,"2023-07-12 11:19:13",,2023-01-06,SNOMED-CT,79190712,General
\\CUSTOM\\ASSESSMENT\\DATE,"CUSTOM: ASSESSMENT_DATE","Datum der Erhebung / Date assessment",D,,,,"2023-07-12 11:21:31",,2023-03-15,CUSTOM,79190712,General
\\TEST\\HEART_RATE,HEART_RATE,"Heart Rate",N,BPM,,,"2024-01-01",,2024-01-01,TEST,1,Vital Signs
\\TEST\\TEMP,TEMP,"Temperature",N,F,,,"2024-01-01",,2024-01-01,TEST,1,Vital Signs
\\TEST\\BP_SYS,BP_SYS,"Blood Pressure Systolic",N,mmHg,,,"2024-01-01",,2024-01-01,TEST,1,Vital Signs`
}

if (!cqlRulesData) {
  cqlRulesData = `CQL_NAME,DESCRIPTION,CQL_DEFINITION,CQL_LOGIC,CREATED_AT,UPDATED_AT
numeric,"Validates numeric values","define ValidNumeric: value is not null and value >= 0","value is not null and value >= 0",2023-01-01,2023-01-01
string,"Validates string values","define ValidString: value is not null and length of value > 0","value is not null and length of value > 0",2023-01-01,2023-01-01
date,"Validates date values","define ValidDate: value is not null and value <= Today()","value is not null and value <= Today()",2023-01-01,2023-01-01
blob,"Validates blob values","define ValidBlob: value is not null","value is not null",2023-01-01,2023-01-01
RANGE_0_30,"Validates values between 0 and 30","define ValidRange0To30: value >= 0 and value <= 30","value >= 0 and value <= 30",2023-01-01,2023-01-01
age,"Validates age values","define ValidAge: value >= 0 and value <= 150","value >= 0 and value <= 150",2023-01-01,2023-01-01
BIRTH_DATE,"Validates birth dates","define ValidBirthDate: value <= Today()","value <= Today()",2023-01-01,2023-01-01
RANGE_0_to_6,"Validates values between 0 and 6","define ValidRange0To6: value >= 0 and value <= 6","value >= 0 and value <= 6",2023-01-01,2023-01-01`
}

if (!conceptCqlLookupsData) {
  conceptCqlLookupsData = `CONCEPT_CD,CQL_NAME,MODIFIER_CD,CREATED_AT,UPDATED_AT
"SCTID: 1255866005",RANGE_0_to_6,,2023-01-01,2023-01-01
"MOD: 1255866005 90D",RANGE_0_to_6,,2023-01-01,2023-01-01
"MOD: 1255866005 HOSPITAL_RELEASE",RANGE_0_to_6,,2023-01-01,2023-01-01
"MOD: 1255866005 PREMORBID",RANGE_0_to_6,,2023-01-01,2023-01-01
"LID: 63900-5",BIRTH_DATE,,2023-01-01,2023-01-01
"SCTID: 184099003",age,,2023-01-01,2023-01-01
"LID: 72106-8",RANGE_0_30,,2023-01-01,2023-01-01
"LID: 72172-0",RANGE_0_30,,2023-01-01,2023-01-01`
}

if (!standardUsersData) {
  standardUsersData = `USER_ID,FULL_NAME,EMAIL,PASSWORD,USER_ADMIN_CD,CREATED_AT,UPDATED_AT
public,Public User,public@example.com,public,N,2023-01-01,2023-01-01
admin,Administrator,admin@example.com,admin,Y,2023-01-01,2023-01-01
db,Database User,db@example.com,db,N,2023-01-01,2023-01-01
ste,Stefan User,ste@example.com,ste,Y,2023-01-01,2023-01-01`
}

if (!codeLookupData) {
  codeLookupData = `TABLE_CD,COLUMN_CD,CODE_CD,NAME_CHAR,LOOKUP_BLOB,UPDATE_DATE,DOWNLOAD_DATE,IMPORT_DATE,SOURCESYSTEM_CD,UPLOAD_ID
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_ASSESSMENT,Assessment,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_CSF_ANALYSIS,CSF Analysis,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_CLINICAL_SCALES,Clinical Scales,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_DEMOGRAPHICS,Demographics,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_DIAGNOSIS,Diagnosis,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_EDUCATION,Education,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_GENERAL,General,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_IMAGING,Imaging,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_LABORATORY,Laboratory,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_MEDICATIONS,Medications,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_NEUROLOGICAL_ASSESSMENT,Neurological Assessment,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_PARKINSON_DISEASE,Parkinson Disease,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_PSYCHOLOGICAL_ASSESSMENT,Psychological Assessment,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_RAW_DATA,Raw Data,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_SLEEP_ASSESSMENT,Sleep Assessment,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_SOCIAL_HISTORY,Social History,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_STROKE,Stroke,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,CATEGORY_CHAR,CAT_VITAL_SIGNS,Vital Signs,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,VALTYPE_CD,R,Rohdaten,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,VALTYPE_CD,D,Datum,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,VALTYPE_CD,T,TEXT,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,VALTYPE_CD,F,"Finding (yes, no, unknown)",,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,VALTYPE_CD,S,Selection,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,VALTYPE_CD,N,Zahl,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,SOURCESYSTEM_CD,LOINC,LOINC,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,SOURCESYSTEM_CD,SNOMED-CT,SNOMED-CT,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,SOURCESYSTEM_CD,ICD10-2019,ICD10-2019,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,SOURCESYSTEM_CD,ICD10-*,ICD10-*,,2024-01-01,,2024-01-01,SYSTEM,1
CONCEPT_DIMENSION,SOURCESYSTEM_CD,other,other,,2024-01-01,,2024-01-01,SYSTEM,1`
}

export { conceptsData, cqlRulesData, conceptCqlLookupsData, standardUsersData, codeLookupData }
