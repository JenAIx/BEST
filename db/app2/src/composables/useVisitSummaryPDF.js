/**
 * Composable for generating PDF content from visit summary data
 */
import { formatFileSize } from 'src/shared/utils/medical-utils.js'

export function useVisitSummaryPDF() {

  const getPatientName = (patient) => {
    if (!patient) return 'Unknown Patient'

    if (patient.PATIENT_BLOB) {
      try {
        const blob = JSON.parse(patient.PATIENT_BLOB)
        if (blob.name) return blob.name
        if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
      } catch {
        // Fallback to PATIENT_CD
      }
    }
    return patient.PATIENT_CD || 'Unknown Patient'
  }

  const getPatientBasicDetails = (patient) => {
    if (!patient) return ''

    const details = []

    // Patient ID
    if (patient.PATIENT_CD) {
      details.push(`ID: ${patient.PATIENT_CD}`)
    }

    // Age
    if (patient.AGE_IN_YEARS) {
      details.push(`${patient.AGE_IN_YEARS} years`)
    } else if (patient.BIRTH_DATE) {
      const birthYear = new Date(patient.BIRTH_DATE).getFullYear()
      const currentYear = new Date().getFullYear()
      details.push(`${currentYear - birthYear} years`)
    }

    return details.join(' • ')
  }

  const getPatientBirthdate = (patient) => {
    if (!patient) return ''

    if (patient.BIRTH_DATE) {
      return new Date(patient.BIRTH_DATE).toLocaleDateString()
    }

    // Check PATIENT_BLOB for birthdate
    if (patient.PATIENT_BLOB) {
      try {
        const blob = JSON.parse(patient.PATIENT_BLOB)
        if (blob.birthDate) {
          return new Date(blob.birthDate).toLocaleDateString()
        }
        if (blob.dateOfBirth) {
          return new Date(blob.dateOfBirth).toLocaleDateString()
        }
      } catch {
        // Ignore parsing errors
      }
    }

    return ''
  }

  const getPatientGender = (patient) => {
    if (!patient) return ''

    if (patient.SEX_RESOLVED) {
      return patient.SEX_RESOLVED
    }

    if (patient.SEX_CD) {
      // Map common codes to readable text
      const genderMap = {
        M: 'Male',
        F: 'Female',
        U: 'Unknown',
        O: 'Other',
      }
      return genderMap[patient.SEX_CD] || patient.SEX_CD
    }

    // Check PATIENT_BLOB for gender
    if (patient.PATIENT_BLOB) {
      try {
        const blob = JSON.parse(patient.PATIENT_BLOB)
        if (blob.gender) {
          return blob.gender
        }
        if (blob.sex) {
          return blob.sex
        }
      } catch {
        // Ignore parsing errors
      }
    }

    return ''
  }

  const formatResponseValueForPDF = (value) => {
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No'
    }
    if (value === null || value === undefined || value === '') {
      return 'No response'
    }
    return String(value)
  }

  const getResponseValueColorForPDF = (value) => {
    if (value === null || value === undefined || value === '') return '#9e9e9e'
    if (Array.isArray(value)) return '#9c27b0'
    if (typeof value === 'boolean') return value ? '#4caf50' : '#f44336'
    if (typeof value === 'number') return '#2196f3'

    // Color based on common health survey responses
    const val = String(value).toLowerCase()
    if (val.includes('excellent') || val.includes('very good')) return '#4caf50'
    if (val.includes('good') || val.includes('fair')) return '#ff9800'
    if (val.includes('poor') || val.includes('bad')) return '#f44336'

    return '#1976d2'
  }

  const getValueTypeColorHex = (valueType) => {
    // Convert Quasar color names to hex values for PDF
    switch (valueType) {
      case 'N':
        return '#2196f3' // blue
      case 'T':
        return '#4caf50' // green
      case 'M':
        return '#ff9800' // orange
      case 'Q':
        return '#9c27b0' // purple
      case 'R':
        return '#795548' // brown
      case 'B':
        return '#607d8b' // blue-grey
      default:
        return '#9e9e9e' // grey
    }
  }

  const generateQuestionnaireHTML = (questionnaire, obs) => {
    const questionnaireTitle = questionnaire.title || obs.conceptName || 'Questionnaire'
    const completionDate = obs.date ? new Date(obs.date).toLocaleDateString() : 'Unknown date'

    // Generate results summary
    let resultsHTML = ''
    const results = questionnaire.results || []
    if (Array.isArray(results) && results.length > 0) {
      resultsHTML = `
        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <h3 style="color: #2e7d32; margin-bottom: 16px;">
            <i class="material-icons" style="font-size: 24px; vertical-align: middle;">assessment</i>
            Final Results
          </h3>
          <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
            ${results
              .map(
                (result) => `
              <div style="text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #2e7d32;">${result.value}</div>
                <div style="font-size: 14px; color: #666;">${result.coding?.display || result.label}</div>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Generate individual responses
    let responsesHTML = ''
    if (questionnaire.items && questionnaire.items.length > 0) {
      responsesHTML = `
        <h4 style="color: #1976d2; margin-bottom: 16px; margin-top: 20px;">
          <i class="material-icons" style="vertical-align: middle;">quiz</i>
          Individual Responses
        </h4>
        <div style="display: grid; gap: 12px;">
          ${questionnaire.items
            .map((item, index) => {
              const formattedValue = formatResponseValueForPDF(item.value)
              const valueColor = getResponseValueColorForPDF(item.value)

              return `
              <div style="border: 1px solid #ddd; border-radius: 6px; padding: 12px; page-break-inside: avoid;">
                <div style="display: flex; align-items: start; gap: 10px; margin-bottom: 10px;">
                  <div style="background: ${item.ignore_for_result ? '#9e9e9e' : '#1976d2'}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; font-size: 12px;">
                    ${index + 1}
                  </div>
                  <div style="flex: 1;">
                    <div style="font-weight: 500; margin-bottom: 4px; font-size: 14px;">${item.label || item.tag || item.id}</div>
                    ${item.ignore_for_result ? '<div style="font-size: 11px; color: #666;"><i class="material-icons" style="font-size: 12px; vertical-align: middle;">info</i> Not included in scoring</div>' : ''}
                  </div>
                </div>
                <div style="background: ${valueColor}; color: white; padding: 10px 14px; border-radius: 4px; font-weight: 500; text-align: center; font-size: 13px;">
                  ${formattedValue}
                </div>
              </div>
            `
            })
            .join('')}
        </div>
      `
    }

    return `
      <div style="margin-bottom: 40px; page-break-before: auto; page-break-inside: avoid;">
        <div style="border-bottom: 2px solid #9c27b0; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #9c27b0; margin-bottom: 8px;">
            <i class="material-icons" style="vertical-align: middle;">quiz</i>
            ${questionnaireTitle}
          </h2>
          <div style="font-size: 14px; color: #666;">
            Completed on ${completionDate} • ${obs.conceptName}
          </div>
        </div>
        ${resultsHTML}
        ${responsesHTML}
      </div>
    `
  }

  const generatePDFContent = async ({
    patient,
    visit,
    formattedDate,
    visitTypeLabel,
    totalObservations,
    categorizedObservations,
    questionnaireObservations,
    loadedQuestionnaires,
    loadQuestionnaireData,
  }) => {
    const patientName = getPatientName(patient)
    const patientBasic = getPatientBasicDetails(patient)
    const patientBirth = getPatientBirthdate(patient)
    const patientGender = getPatientGender(patient)

    let categoriesHTML = ''

    categorizedObservations.forEach((category) => {
      let observationsHTML = ''

      category.observations.forEach((obs) => {
        let valueHTML = ''

        if (obs.valueType === 'Q') {
          valueHTML = `<span style="color: #7b1fa2;"><i class="material-icons" style="font-size: 14px; vertical-align: middle;">quiz</i> ${obs.displayValue || 'Questionnaire'}</span>`
        } else if (obs.valueType === 'R' && obs.fileInfo) {
          valueHTML = `<span><i class="material-icons" style="font-size: 14px; vertical-align: middle;">attach_file</i> ${obs.fileInfo.filename} (${formatFileSize(obs.fileInfo.size)})</span>`
        } else if (obs.valueType !== 'R') {
          valueHTML = `<span>${obs.displayValue || 'No value'}</span>`
          if (obs.unit) {
            valueHTML += ` <span style="color: #666; font-style: italic;">${obs.unit}</span>`
          }
        } else {
          valueHTML = '<span style="color: #666; font-style: italic;">No file attached</span>'
        }

        observationsHTML += `
          <tr>
            <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">
              <span style="background: ${getValueTypeColorHex(obs.valueType)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${obs.valueType}</span>
            </td>
            <td style="text-align: left; padding: 8px; border: 1px solid #ddd; font-weight: 500;">${obs.conceptName}</td>
            <td style="text-align: left; padding: 8px; border: 1px solid #ddd;">${valueHTML}</td>
          </tr>
        `
      })

      categoriesHTML += `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
          <h3 style="color: #1976d2; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #ddd;">
            ${category.name} (${category.observations.length} observations)
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="text-align: center; padding: 12px 8px; border: 1px solid #ddd; font-weight: 600;">Type</th>
                <th style="text-align: left; padding: 12px 8px; border: 1px solid #ddd; font-weight: 600;">Concept</th>
                <th style="text-align: left; padding: 12px 8px; border: 1px solid #ddd; font-weight: 600;">Value</th>
              </tr>
            </thead>
            <tbody>
              ${observationsHTML}
            </tbody>
          </table>
        </div>
      `
    })

    // Generate questionnaires HTML for PDF
    let questionnairesHTML = ''
    if (questionnaireObservations.length > 0) {
      for (const obs of questionnaireObservations) {
        // Ensure questionnaire is loaded
        if (!loadedQuestionnaires[obs.observationId]) {
          await loadQuestionnaireData(obs)
        }

        const questionnaire = loadedQuestionnaires[obs.observationId]
        if (!questionnaire) continue

        questionnairesHTML += generateQuestionnaireHTML(questionnaire, obs)
      }
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Visit Summary - ${patientName}</title>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.4;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
          }
          .patient-header {
            background: #f5f5f5;
            padding: 16px;
            border-radius: 8px;
            border-left: 4px solid #9c27b0;
            margin-bottom: 20px;
          }
          .patient-name {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
          }
          .patient-details {
            font-size: 14px;
            color: #666;
          }
          .visit-header {
            border-bottom: 2px solid #1976d2;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .visit-title {
            font-size: 24px;
            color: #1976d2;
            margin-bottom: 8px;
          }
          .visit-meta {
            font-size: 16px;
            color: #333;
          }
          .visit-notes {
            background: #f5f5f5;
            padding: 12px 16px;
            border-radius: 4px;
            border-left: 3px solid #1976d2;
            font-style: italic;
            margin-top: 12px;
          }
          .material-icons {
            vertical-align: middle;
            margin-right: 4px;
          }
          @media print {
            body { margin: 0; padding: 15px; }
            .material-icons { font-size: 14px !important; }
          }
        </style>
      </head>
      <body>
        <div class="patient-header">
          <div class="patient-name">${patientName}</div>
          <div class="patient-details">${patientBasic}</div>
          ${
            patientBirth || patientGender
              ? `<div class="patient-details">
            ${patientBirth ? `Born: ${patientBirth}` : ''}
            ${patientBirth && patientGender ? ' • ' : ''}
            ${patientGender || ''}
          </div>`
              : ''
          }
        </div>

        <div class="visit-header">
          <div class="visit-title">
            <i class="material-icons">event</i>
            Visit Summary Report
          </div>
          <div class="visit-meta">
            <strong>Date:</strong> ${formattedDate} •
            <strong>Type:</strong> ${visitTypeLabel} •
            <strong>Total Observations:</strong> ${totalObservations}
          </div>
          ${visit.notes ? `<div class="visit-notes"><strong>Notes:</strong> ${visit.notes}</div>` : ''}
        </div>

        ${categoriesHTML}

        ${
          questionnairesHTML
            ? `
        <div style="margin-top: 50px; page-break-before: always;">
          <h2 style="color: #9c27b0; margin-bottom: 20px; border-bottom: 2px solid #9c27b0; padding-bottom: 12px;">
            <i class="material-icons" style="vertical-align: middle;">quiz</i>
            Questionnaires & Surveys
          </h2>
          ${questionnairesHTML}
        </div>
        `
            : ''
        }

        <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px;">
          Generated on ${new Date().toLocaleString()} • BEST Scientific DB Manager
        </div>
      </body>
      </html>
    `
  }

  return {
    generatePDFContent,
    getPatientName,
    getPatientBasicDetails,
    getPatientBirthdate,
    getPatientGender,
  }
}

