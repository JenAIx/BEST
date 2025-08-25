/**
 * Demo Patient Service
 *
 * Service for creating and managing demo patients with visits and observations for testing purposes.
 * Each patient gets 2-3 visits and 10 random observations per visit.
 * Uses proper concept codes from the database for demographic values.
 */

/**
 * Get concept answers for a given concept path
 * @param {Object} conceptRepository - Concept repository instance
 * @param {string} conceptPath - The concept path to search for answers (e.g., '\\SNOMED-CT\\365860008\\LA')
 * @returns {Promise<Array>} Array of concept codes
 */
async function getConceptAnswers(conceptRepository, conceptPath) {
  try {
    const concepts = await conceptRepository.findByConceptPath(conceptPath)
    return concepts.map((concept) => concept.CONCEPT_CD)
  } catch (error) {
    console.warn(`Failed to get concept answers for path ${conceptPath}:`, error)
    return []
  }
}

/**
 * Generate fake patient data with proper concept codes
 * @param {number} index - Patient index (1-20)
 * @param {Object} conceptAnswers - Pre-loaded concept answers for demographic fields
 * @returns {Object} Patient data object
 */
function generatePatientData(index, conceptAnswers) {
  const age = 18 + Math.floor(Math.random() * 62) // Ages 18-79

  // Generate birth date based on age (YYYY-MM-DD format)
  const currentYear = new Date().getFullYear()
  const birthYear = currentYear - age
  const birthMonth = Math.floor(Math.random() * 12) + 1
  const birthDay = Math.floor(Math.random() * 28) + 1 // Safe day range
  const birthDate = `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`

  // Generate death date for some patients (5% chance)
  let deathDate = null
  if (Math.random() < 0.05) {
    const deathYear = birthYear + Math.floor(Math.random() * (currentYear - birthYear))
    const deathMonth = Math.floor(Math.random() * 12) + 1
    const deathDay = Math.floor(Math.random() * 28) + 1
    deathDate = `${deathYear}-${deathMonth.toString().padStart(2, '0')}-${deathDay.toString().padStart(2, '0')}`
  }

  // Select random values from concept answers (use defaults if empty)
  const vitalStatusCodes =
    conceptAnswers.vitalStatus.length > 0 ? conceptAnswers.vitalStatus : ['SCTID: 438949009'] // Default to alive
  const sexCodes =
    conceptAnswers.sex.length > 0 ? conceptAnswers.sex : ['SCTID: 248153007', 'SCTID: 248152002'] // Default to male/female
  const raceCodes = conceptAnswers.race.length > 0 ? conceptAnswers.race : ['LID: LA4489-6'] // Default to unknown
  const languageCodes =
    conceptAnswers.language.length > 0 ? conceptAnswers.language : ['LID: LA43-5'] // Default to English
  const maritalStatusCodes =
    conceptAnswers.maritalStatus.length > 0 ? conceptAnswers.maritalStatus : ['LID: LA45404-1'] // Default to never married
  const religionCodes =
    conceptAnswers.religion.length > 0 ? conceptAnswers.religion : ['SCTID: 312864006'] // Default to unknown

  return {
    PATIENT_CD: `DEMO_PATIENT_${index.toString().padStart(2, '0')}`,
    SEX_CD: sexCodes[Math.floor(Math.random() * sexCodes.length)],
    AGE_IN_YEARS: age,
    BIRTH_DATE: birthDate,
    DEATH_DATE: deathDate,
    VITAL_STATUS_CD: deathDate
      ? 'SCTID: 419099009'
      : vitalStatusCodes[Math.floor(Math.random() * vitalStatusCodes.length)], // Dead if death date, otherwise random
    LANGUAGE_CD: languageCodes[Math.floor(Math.random() * languageCodes.length)],
    RACE_CD: raceCodes[Math.floor(Math.random() * raceCodes.length)],
    MARITAL_STATUS_CD: maritalStatusCodes[Math.floor(Math.random() * maritalStatusCodes.length)],
    RELIGION_CD: religionCodes[Math.floor(Math.random() * religionCodes.length)],
    SOURCESYSTEM_CD: 'DEMO',
    UPLOAD_ID: 1,
  }
}

/**
 * Generate visit data for a patient
 * @param {number} patientNum - Patient number
 * @param {Object} conceptAnswers - Pre-loaded concept answers for visit fields
 * @returns {Object} Visit data object
 */
function generateVisitData(patientNum, conceptAnswers) {
  const locations = [
    'DEMO_HOSPITAL/CARDIO',
    'DEMO_HOSPITAL/NEURO',
    'DEMO_HOSPITAL/ORTHO',
    'DEMO_HOSPITAL/EMERGENCY',
    'DEMO_HOSPITAL/INTERNAL',
    'DEMO_HOSPITAL/SURGERY',
    'DEMO_CLINIC/OUTPATIENT',
    'DEMO_CLINIC/FAMILY',
  ]

  const inoutCodes = ['I', 'O', 'E'] // Inpatient, Outpatient, Emergency

  // Select random values from concept answers (use defaults if empty)
  const activeStatusCodes =
    conceptAnswers.activeStatus.length > 0 ? conceptAnswers.activeStatus : ['SCTID: 55561003'] // Default to active

  // Generate visit date (within last 2 years)
  const daysAgo = Math.floor(Math.random() * 730) // 0-730 days ago
  const visitDate = new Date()
  visitDate.setDate(visitDate.getDate() - daysAgo)
  const startDate = visitDate.toISOString().split('T')[0]

  // End date (1-7 days after start for inpatients, same day for outpatients)
  const inoutCode = inoutCodes[Math.floor(Math.random() * inoutCodes.length)]
  let endDate = null
  if (inoutCode === 'I') {
    const lengthOfStay = Math.floor(Math.random() * 7) + 1 // 1-7 days
    const endDateObj = new Date(visitDate)
    endDateObj.setDate(endDateObj.getDate() + lengthOfStay)
    endDate = endDateObj.toISOString().split('T')[0]
  }

  return {
    PATIENT_NUM: patientNum,
    START_DATE: startDate,
    END_DATE: endDate,
    INOUT_CD: inoutCode,
    LOCATION_CD: locations[Math.floor(Math.random() * locations.length)],
    ACTIVE_STATUS_CD: activeStatusCodes[Math.floor(Math.random() * activeStatusCodes.length)],
    SOURCESYSTEM_CD: 'DEMO',
    UPLOAD_ID: 1,
  }
}

/**
 * Generate observation data for a visit
 * @param {number} patientNum - Patient number
 * @param {number} encounterNum - Encounter number
 * @param {number} obsIndex - Observation index
 * @param {string} visitDate - Visit date
 * @returns {Object} Observation data object
 */
function generateObservationData(patientNum, encounterNum, obsIndex, visitDate) {
  // Demo concepts that are created within this function
  // Using demo concepts to avoid database connection timeout issues during seeding
  const concepts = [
    // Numeric concepts (N) - Vital Signs and Lab Values
    {
      code: 'LID: 8480-6',
      name: 'Blood pressure systolic',
      type: 'N',
      unit: 'mmHg',
      range: [90, 180],
      category: 'VITAL_SIGNS',
    },
    {
      code: 'LID: 8462-4',
      name: 'Blood pressure diastolic',
      type: 'N',
      unit: 'mmHg',
      range: [60, 110],
      category: 'VITAL_SIGNS',
    },
    {
      code: 'LID: 8867-4',
      name: 'Heart rate',
      type: 'N',
      unit: 'beats/min',
      range: [60, 120],
      category: 'VITAL_SIGNS',
    },
    {
      code: 'SCTID: 27113001',
      name: 'Body weight',
      type: 'N',
      unit: 'kg',
      range: [45, 120],
      category: 'VITAL_SIGNS',
    },
    {
      code: 'SCTID: 1153637007',
      name: 'Body height',
      type: 'N',
      unit: 'cm',
      range: [150, 200],
      category: 'VITAL_SIGNS',
    },
    {
      code: 'SCTID: 60621009',
      name: 'BMI (body mass index)',
      type: 'N',
      unit: 'kg/m2',
      range: [18.5, 35.0],
      category: 'VITAL_SIGNS',
    },
    {
      code: 'LID: 6298-4',
      name: 'Kalium in Blood',
      type: 'N',
      unit: 'mmol/l',
      range: [3.5, 5.1],
      category: 'LAB',
    },
    {
      code: 'LID: 2947-0',
      name: 'Natrium (mole/volume) in Blood',
      type: 'N',
      unit: 'mmol/l',
      range: [135, 145],
      category: 'LAB',
    },
    {
      code: 'LID: 38483-4',
      name: 'kreatinin (Mass/Voloume) in Blood',
      type: 'N',
      unit: 'umol/l',
      range: [60, 120],
      category: 'LAB',
    },
    {
      code: 'LID: 74246-8',
      name: 'Haemoglobin A1c/haemoglobin.total in Blood durch IFCC-protokoll',
      type: 'N',
      unit: '%',
      range: [4.0, 10.0],
      category: 'LAB',
    },

    // Text concepts (T) - Diagnoses, Medications, Assessments
    {
      code: 'LID: 18630-4',
      name: 'Primary Diagnosis',
      type: 'T',
      values: [
        'Hypertension',
        'Diabetes mellitus type 2',
        'Hyperlipidemia',
        'Coronary artery disease',
        'Atrial fibrillation',
      ],
      category: 'DIAGNOSIS',
    },
    {
      code: 'LID: 52418-1',
      name: 'Current medication, Name',
      type: 'T',
      values: [
        'Aspirin 100mg',
        'Metformin 500mg',
        'Lisinopril 10mg',
        'Atorvastatin 20mg',
        'Warfarin 5mg',
      ],
      category: 'MEDICATION',
    },
    {
      code: 'SCTID: 47965005',
      name: 'Differential diagnosis',
      type: 'T',
      values: [
        'Rule out myocardial infarction',
        'Possible stroke',
        'Suspected pneumonia',
        'Exclude pulmonary embolism',
      ],
      category: 'DIAGNOSIS',
    },
    {
      code: 'LID: 74287-4',
      name: 'Occupation',
      type: 'T',
      values: ['Teacher', 'Engineer', 'Nurse', 'Retired', 'Office worker', 'Manual laborer'],
      category: 'SOCIAL_HISTORY',
    },
    {
      code: 'SCTID: 262188008',
      name: 'Stress',
      type: 'T',
      values: ['Mild stress', 'Moderate stress', 'High stress', 'No significant stress'],
      category: 'ASSESSMENT',
    },

    // Date concepts (D) - Medical Events
    {
      code: 'SCTID: 399423000',
      name: 'Date of admission',
      type: 'D',
      category: 'ADMINISTRATIVE',
    },
    {
      code: 'CUSTOM: ASSESSMENT_DATE',
      name: 'Date of assessment',
      type: 'D',
      category: 'ASSESSMENT',
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
    observation.TVAL_CHAR = concept.values[Math.floor(Math.random() * concept.values.length)]
    observation.NVAL_NUM = null // Explicitly set to null for text values
    observation.UNIT_CD = null // No unit for text values
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

/**
 * Create demo patients with visits and observations
 * @param {Object} repositories - Object containing repository instances
 * @param {number} count - Number of patients to create (default: 20)
 * @returns {Promise<Object>} Creation results
 */
export async function createDemoPatients(repositories, count = 20) {
  const { patientRepository, visitRepository, observationRepository, conceptRepository } =
    repositories

  const results = {
    patients: [],
    visits: [],
    observations: [],
    concepts: [],
    errors: [],
  }

  try {
    // Load concept answers for demographic fields
    const conceptAnswers = {
      vitalStatus: await getConceptAnswers(conceptRepository, '\\SNOMED-CT\\365860008\\LA'),
      sex: await getConceptAnswers(
        conceptRepository,
        '\\SNOMED-CT\\363787003\\278844005\\263495000\\LA',
      ),
      race: await getConceptAnswers(
        conceptRepository,
        '\\LOINC\\ADMIN.DEMOG\\Patient\\46463-6\\LA',
      ),
      language: await getConceptAnswers(
        conceptRepository,
        '\\LOINC\\ADMIN.DEMOG\\Patient\\54505-3\\LA',
      ),
      maritalStatus: await getConceptAnswers(
        conceptRepository,
        '\\LOINC\\ADMIN.PATIENT.DEMOG\\Patient\\45404-1\\LA',
      ),
      religion: await getConceptAnswers(conceptRepository, '\\SNOMED-CT\\160538000\\LA'),
      activeStatus: await getConceptAnswers(
        conceptRepository,
        '\\SNOMED-CT\\138875005\\362981000\\272099008\\106232001\\106234000\\LA',
      ),
    }

    // Note: Real LOINC/SNOMED concepts are loaded from concept_dimension_data.csv during database seeding
    // No need to create demo concepts anymore - we use the real ones from the CSV file

    // Create patients
    for (let i = 1; i <= count; i++) {
      try {
        const patientData = generatePatientData(i, conceptAnswers)
        const patient = await patientRepository.createPatient(patientData)
        results.patients.push(patient)

        // Create 2-3 visits per patient
        const visitCount = Math.floor(Math.random() * 2) + 2 // 2-3 visits
        for (let v = 1; v <= visitCount; v++) {
          try {
            const visitData = generateVisitData(patient.PATIENT_NUM, conceptAnswers)
            const visit = await visitRepository.createVisit(visitData)
            results.visits.push(visit)

            // Create 10 random observations per visit
            for (let o = 1; o <= 10; o++) {
              try {
                const observationData = generateObservationData(
                  patient.PATIENT_NUM,
                  visit.ENCOUNTER_NUM,
                  o,
                  visit.START_DATE,
                )
                const observation = await observationRepository.createObservation(observationData)
                results.observations.push(observation)
              } catch (error) {
                results.errors.push(
                  `Failed to create observation ${o} for visit ${visit.ENCOUNTER_NUM}: ${error.message}`,
                )
              }
            }
          } catch (error) {
            results.errors.push(
              `Failed to create visit ${v} for patient ${patient.PATIENT_CD}: ${error.message}`,
            )
          }
        }
      } catch (error) {
        results.errors.push(`Failed to create patient ${i}: ${error.message}`)
      }
    }
  } catch (error) {
    results.errors.push(`General error: ${error.message}`)
  }

  return results
}
