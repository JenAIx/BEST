/**
 * Field Set Statistics Composable
 *
 * Provides reactive statistics computation for field set completion tracking
 */

import { computed } from 'vue'

export function useFieldSetStatistics(availableFieldSets, activeFieldSets, getFieldSetObservationCount, uncategorizedObservations = null, getFieldSetObservations = null) {
  // Overall completion statistics across all active field sets
  const overallStats = computed(() => {
    let totalConcepts = 0
    let filledConcepts = 0
    const categoryDetails = []
    const allActiveConcepts = new Set() // Track all concepts across active field sets
    const allFilledConcepts = new Set() // Track which concepts have observations

    // Calculate totals using the same order as activeFieldSetsList
    const activeFieldSetsList = availableFieldSets.value?.filter((fs) => activeFieldSets.value?.includes(fs.id)) || []

    // Helper function to check if observation matches concept
    const observationMatchesConcept = (obs, concept) => {
      if (obs.conceptCode === concept) return true
      
      // Extract numeric codes and compare
      const conceptMatch = concept.match(/[:\s]([0-9-]+)$/)
      const obsMatch = obs.conceptCode.match(/[:\s]([0-9-]+)$/)
      if (conceptMatch && obsMatch && conceptMatch[1] === obsMatch[1]) return true
      
      // Partial matches
      if (concept.includes(obs.conceptCode) || obs.conceptCode.includes(concept)) return true
      
      // Case-insensitive match
      if (obs.conceptCode.toLowerCase().includes(concept.toLowerCase())) return true
      
      return false
    }

    // Helper function to check if observation has a valid non-empty value
    const observationHasValue = (obs) => {
      const value = obs.tval_char || obs.TVAL_CHAR || obs.nval_num || obs.NVAL_NUM || obs.observation_blob || obs.OBSERVATION_BLOB || obs.originalValue || obs.value
      return value !== null && value !== undefined && value !== '' && String(value).trim() !== ''
    }

    activeFieldSetsList.forEach((fieldSet) => {
      if (fieldSet && fieldSet.concepts) {
        const conceptCount = fieldSet.concepts.length
        const observationCount = getFieldSetObservationCount(fieldSet.id)

        // For medications, handle separately
        if (fieldSet.id === 'medications') {
          if (getFieldSetObservations) {
            const observations = getFieldSetObservations(fieldSet.id)
            const validMedications = observations.filter(obs => observationHasValue(obs))
            totalConcepts += validMedications.length // Total valid medication observations
            filledConcepts += Math.min(validMedications.length, 1) // If any valid medications exist, count as 1 filled
          } else {
            // Fallback if getFieldSetObservations not available
            totalConcepts += observationCount || 0
            filledConcepts += Math.min(observationCount || 0, 1)
          }
        } else {
          // For regular field sets, add all concepts to the global total
          fieldSet.concepts.forEach(concept => allActiveConcepts.add(concept))
          
          // Track which concepts have observations with valid values
          if (getFieldSetObservations && observationCount > 0) {
            const observations = getFieldSetObservations(fieldSet.id)
            
            fieldSet.concepts.forEach(concept => {
              const hasValidObservation = observations.some(obs => 
                observationMatchesConcept(obs, concept) && observationHasValue(obs)
              )
              if (hasValidObservation) {
                allFilledConcepts.add(concept)
              }
            })
          }
        }

        // Store details for consistent ordering in tooltips (per field set stats)
        let categoryTotal = conceptCount
        if (fieldSet.id === 'medications') {
          if (getFieldSetObservations) {
            const observations = getFieldSetObservations(fieldSet.id)
            const validMedications = observations.filter(obs => observationHasValue(obs))
            categoryTotal = validMedications.length
          } else {
            categoryTotal = observationCount || 0
          }
        }
        let categoryFilled = 0
        
        if (fieldSet.id === 'medications') {
          if (getFieldSetObservations) {
            const observations = getFieldSetObservations(fieldSet.id)
            const validMedications = observations.filter(obs => observationHasValue(obs))
            categoryFilled = Math.min(validMedications.length, 1)
          } else {
            // Fallback
            categoryFilled = Math.min(observationCount || 0, 1)
          }
        } else if (getFieldSetObservations && observationCount > 0) {
          // Count filled concepts in this specific field set (only those with valid values)
          const observations = getFieldSetObservations(fieldSet.id)
          categoryFilled = fieldSet.concepts.filter(concept => 
            observations.some(obs => observationMatchesConcept(obs, concept) && observationHasValue(obs))
          ).length
        }

        categoryDetails.push({
          id: fieldSet.id,
          name: fieldSet.name,
          icon: fieldSet.icon,
          conceptCount: categoryTotal,
          observationCount,
          percentage: categoryTotal > 0 ? Math.round((categoryFilled / categoryTotal) * 100) : 0,
        })
      }
    })

    // Calculate overall totals: sum of all individual concepts across all active field sets
    if (activeFieldSetsList.some(fs => fs.id !== 'medications')) {
      // Override totals with concept-based counting across ALL active field sets
      totalConcepts = allActiveConcepts.size // Total unique concepts across all active field sets
      filledConcepts = allFilledConcepts.size // Total unique concepts that have observations
      
      // Add medication counts to the totals (only valid medications)
      const medicationFieldSet = activeFieldSetsList.find(fs => fs.id === 'medications')
      if (medicationFieldSet && getFieldSetObservations) {
        const medicationObservations = getFieldSetObservations('medications')
        const validMedications = medicationObservations.filter(obs => observationHasValue(obs))
        totalConcepts += validMedications.length
        filledConcepts += Math.min(validMedications.length, 1)
      } else if (medicationFieldSet) {
        // Fallback
        const medicationCount = getFieldSetObservationCount('medications')
        totalConcepts += medicationCount || 0
        filledConcepts += Math.min(medicationCount || 0, 1)
      }
    }

    // Add uncategorized observations to the statistics
    const uncategorizedCount = uncategorizedObservations?.value?.length || 0
    if (uncategorizedCount > 0) {
      categoryDetails.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        icon: 'help_outline',
        conceptCount: 0, // These aren't planned concepts
        observationCount: uncategorizedCount,
        percentage: 0, // Can't calculate percentage for unplanned observations
        isUncategorized: true,
      })
    }

    // Calculate percentage based on filled concepts vs total concepts (excluding uncategorized)
    const percentage = totalConcepts > 0 ? Math.round((filledConcepts / totalConcepts) * 100) : 0

    // Color coding based on completion percentage
    let color = 'grey-6'
    let textColor = 'white'

    if (percentage >= 80) {
      color = 'positive' // Green for 80%+
      textColor = 'white'
    } else if (percentage >= 50) {
      color = 'warning' // Orange for 50-79%
      textColor = 'white'
    } else if (percentage > 0) {
      color = 'info' // Blue for 1-49%
      textColor = 'white'
    }

    return {
      percentage,
      filled: filledConcepts, // Number of concepts that have observations
      total: totalConcepts, // Total expected concepts
      activeCategories: activeFieldSets.value?.length + (uncategorizedCount > 0 ? 1 : 0),
      categoryDetails, // Same order as displayed chips
      uncategorizedCount,
      color,
      textColor,
      isEmpty: percentage === 0,
      isComplete: percentage === 100,
      isHighProgress: percentage >= 80,
      isMediumProgress: percentage >= 50,
    }
  })

  return {
    overallStats,
  }
}
