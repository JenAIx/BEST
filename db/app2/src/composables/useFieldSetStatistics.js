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

        totalConcepts += conceptCount
        filledConcepts += observationCount

        // Store details for consistent ordering in tooltips
        categoryDetails.push({
          id: fieldSet.id,
          name: fieldSet.name,
          icon: fieldSet.icon,
          conceptCount,
          observationCount,
          percentage: conceptCount > 0 ? Math.round((observationCount / conceptCount) * 100) : 0,
        })
      }
    })

    // Add uncategorized observations to the statistics
    const uncategorizedCount = uncategorizedObservations?.value?.length || 0
    if (uncategorizedCount > 0) {
      // Don't add to total concepts (they're not "expected" concepts)
      // But add to filled concepts to show total observations count
      filledConcepts += uncategorizedCount

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

    const percentage = totalConcepts > 0 ? Math.round(((filledConcepts - uncategorizedCount) / totalConcepts) * 100) : 0

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
      filled: filledConcepts,
      total: totalConcepts,
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
