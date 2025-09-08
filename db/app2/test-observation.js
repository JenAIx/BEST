// Temporary test file to verify generateObservationData function
function generateObservationData(patientNum, encounterNum, obsIndex, visitDate) {
  // Demo concepts that match the production database CONCEPT_DIMENSION entries
  const concepts = [
    // Numeric concepts (N) - Vital Signs and Lab Values
    {
      code: 'LID: 8480-6',
      name: 'Blood pressure systolic',
      type: 'N',
      unit: 'mmHg',
      range: [90, 180],
      category: 'Laboratory',
    },
    {
      code: 'LID: 8462-4',
      name: 'Blood pressure diastolic',
      type: 'N',
      unit: 'mmHg',
      range: [60, 110],
      category: 'Laboratory',
    },
    {
      code: 'LID: 8867-4',
      name: 'Heart rate',
      type: 'N',
      unit: 'beats/min',
      range: [60, 120],
      category: 'Vital Signs',
    },
    {
      code: 'SCTID: 27113001',
      name: 'Body weight',
      type: 'N',
      unit: 'kg',
      range: [45, 120],
      category: 'Vital Signs',
    },
    {
      code: 'SCTID: 1153637007',
      name: 'Body height',
      type: 'N',
      unit: 'cm',
      range: [150, 200],
      category: 'Vital Signs',
    },
    {
      code: 'SCTID: 60621009',
      name: 'BMI (body mass index)',
      type: 'N',
      unit: 'kg/m2',
      range: [18.5, 35.0],
      category: 'Vital Signs',
    },
    {
      code: 'LID: 6298-4',
      name: 'Kalium',
      type: 'N',
      unit: 'mmol/l',
      range: [3.5, 5.1],
      category: 'Laboratory',
    },
    {
      code: 'LID: 2947-0',
      name: 'Natrium (mole/volume) in Blood',
      type: 'N',
      unit: 'mmol/l',
      range: [135, 145],
      category: 'Laboratory',
    },
    {
      code: 'LID: 38483-4',
      name: 'kreatinin (Mass/Voloume) in Blood',
      type: 'N',
      unit: 'umol/l',
      range: [60, 120],
      category: 'Laboratory',
    },
    {
      code: 'LID: 74246-8',
      name: 'Haemoglobin A1c/haemoglobin.total in Blood durch IFCC-protokoll',
      type: 'N',
      unit: '%',
      range: [4.0, 10.0],
      category: 'Laboratory',
    },
    {
      code: 'LID: 8310-5',
      name: 'Body temperature',
      type: 'N',
      unit: 'Cel',
      range: [36.0, 38.5],
      category: 'Laboratory',
    },
    {
      code: 'LID: 9279-1',
      name: 'Respiratory rate',
      type: 'N',
      unit: '/min',
      range: [12, 20],
      category: 'Laboratory',
    },

    // Text concepts (T) - Diagnoses, Medications, Assessments
    {
      code: 'LID: 18630-4',
      name: 'Primary Diagnosis',
      type: 'T',
      value: 'Hypertension',
      category: 'Diagnosis',
    },
    {
      code: 'SCTID: 47965005',
      name: 'Differential diagnosis',
      type: 'T',
      value: 'Rule out myocardial infarction',
      category: 'Diagnosis',
    },
    {
      code: 'LID: 74287-4',
      name: 'Occupation',
      type: 'T',
      value: 'Office worker',
      category: 'Demographics',
    },
    {
      code: 'SCTID: 262188008',
      name: 'Stress',
      type: 'T',
      value: 'Moderate stress',
      category: 'General',
    },
    {
      code: 'SCTID: 302147001',
      name: 'Demographic history detail',
      type: 'T',
      value: 'Retired professional',
      category: 'Social History',
    },

    // Medication concept (M)
    {
      code: 'LID: 52418-1',
      name: 'Current medication, Name',
      type: 'M',
      value: 'Aspirin 100mg',
      category: 'Medications',
    },

    // Date concepts (D) - Medical Events
    {
      code: 'SCTID: 399423000',
      name: 'Date of admission',
      type: 'D',
      category: 'General',
    },
    {
      code: 'CUSTOM: ASSESSMENT_DATE',
      name: 'Datum der Erhebung / Date assessment',
      type: 'D',
      category: 'Assessment',
    },
  ]

  const concept = concepts[Math.floor(Math.random() * concepts.length)]

  let observation = {
    PATIENT_NUM: patientNum,
    ENCOUNTER_NUM: encounterNum,
    CONCEPT_CD: concept.code,
    CATEGORY_CHAR: concept.category,
    START_DATE: visitDate,
    VALTYPE_CD: concept.type,
    SOURCESYSTEM_CD: 'DEMO',
    UPLOAD_ID: 1,
  }

  // Add value based on type
  if (concept.type === 'N') {
    const [min, max] = concept.range
    const value = Math.random() * (max - min) + min
    observation.NVAL_NUM = Math.round(value * 10) / 10 // Round to 1 decimal
    observation.UNIT_CD = concept.unit
    observation.TVAL_CHAR = null // Explicitly set to null for numeric values
  } else if (concept.type === 'T') {
    observation.TVAL_CHAR = concept.value
    observation.NVAL_NUM = null // Explicitly set to null for text values
    observation.UNIT_CD = null // No unit for text values
  } else if (concept.type === 'M') {
    // Medication type - use TVAL_CHAR for the medication name
    observation.TVAL_CHAR = concept.value
    observation.NVAL_NUM = null // No numeric value for medications
    observation.UNIT_CD = null // No unit for medications
  } else if (concept.type === 'D') {
    // Generate a random date within the last 30 days from visit date
    const visitDateObj = new Date(visitDate)
    const daysOffset = Math.floor(Math.random() * 30) // 0-30 days before visit
    const eventDate = new Date(visitDateObj)
    eventDate.setDate(eventDate.getDate() - daysOffset)
    observation.TVAL_CHAR = eventDate.toISOString().split('T')[0] // YYYY-MM-DD format
    observation.NVAL_NUM = null // No numeric value for dates
    observation.UNIT_CD = null // No unit for dates
  }

  return observation
}

// Test the function
console.log('Testing generateObservationData function:')
console.log('Generated observation 1:', JSON.stringify(generateObservationData(1, 1001, 1, '2024-01-15'), null, 2))
console.log('\nGenerated observation 2:', JSON.stringify(generateObservationData(2, 1002, 2, '2024-01-16'), null, 2))
console.log('\nGenerated observation 3:', JSON.stringify(generateObservationData(3, 1003, 3, '2024-01-17'), null, 2))
