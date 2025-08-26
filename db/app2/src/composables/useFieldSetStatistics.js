/**
 * Field Set Statistics Composable
 *
 * Provides reactive statistics computation for field set completion tracking
 */

import { computed } from 'vue'

export function useFieldSetStatistics(availableFieldSets, activeFieldSets, getFieldSetObservationCount, uncategorizedObservations = null) {
  // Overall completion statistics across all active field sets
  const overallStats = computed(() => {
    let totalConcepts = 0
    let filledConcepts = 0
    const categoryDetails = []

    // Calculate totals using the same order as activeFieldSetsList
    const activeFieldSetsList = availableFieldSets.value?.filter((fs) => activeFieldSets.value?.includes(fs.id)) || []

    activeFieldSetsList.forEach((fieldSet) => {
      if (fieldSet && fieldSet.concepts) {
        const conceptCount = fieldSet.concepts.length
        const observationCount = getFieldSetObservationCount(fieldSet.id)

        // For medications, count all observations instead of concepts
        if (fieldSet.id === 'medications') {
          totalConcepts += observationCount || 0 // Total medication observations
          filledConcepts += Math.min(observationCount || 0, 1) // Simplified: if any medications exist, count as 1 filled for now
        } else {
          // For regular field sets, use concept-based counting
          const filledConceptsInSet = observationCount > 0 ? 1 : 0
          totalConcepts += conceptCount
          filledConcepts += filledConceptsInSet
        }

        // Store details for consistent ordering in tooltips
        const categoryTotal = fieldSet.id === 'medications' ? observationCount || 0 : conceptCount
        const categoryFilled = fieldSet.id === 'medications' ? Math.min(observationCount || 0, 1) : observationCount > 0 ? 1 : 0

        categoryDetails.push({
          id: fieldSet.id,
          name: fieldSet.name,
          icon: fieldSet.icon,
          conceptCount: categoryTotal, // For medications, show observation count instead
          observationCount,
          percentage: categoryTotal > 0 ? Math.round((categoryFilled / categoryTotal) * 100) : 0,
        })
      }
    })

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
