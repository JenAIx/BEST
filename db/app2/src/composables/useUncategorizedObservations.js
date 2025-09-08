/**
 * Uncategorized Observations Composable
 *
 * Detects and provides uncategorized observations that don't match any configured field set concepts
 */

import { computed } from 'vue'
import { useLoggingStore } from 'src/stores/logging-store'

export function useUncategorizedObservations(visitStore, availableFieldSets, selectedVisit) {
  const loggingStore = useLoggingStore()
  const logger = loggingStore.createLogger('UncategorizedObservations')

  // Uncategorized observations detection
  const uncategorizedObservations = computed(() => {
    if (!selectedVisit.value) return []

    // Get all observations for the current visit
    const allVisitObservations = visitStore.observations || []

    // Get all concept codes that are covered by any field set (active or inactive)
    const allCoveredConcepts = new Set()
    availableFieldSets.value?.forEach((fieldSet) => {
      if (fieldSet.concepts) {
        fieldSet.concepts.forEach((concept) => allCoveredConcepts.add(concept))
      }
    })

    // Find observations that don't match any field set concept
    const uncategorized = allVisitObservations.filter((obs) => {
      // Check if this observation concept matches any field set concept
      for (const concept of allCoveredConcepts) {
        // Use the same matching logic as getFieldSetObservations
        if (obs.conceptCode === concept) return false

        // Extract numeric codes and compare
        const conceptMatch = concept.match(/[:\s]([0-9-]+)$/)
        const obsMatch = obs.conceptCode.match(/[:\s]([0-9-]+)$/)
        if (conceptMatch && obsMatch && conceptMatch[1] === obsMatch[1]) return false

        // Other matching strategies
        if (concept.includes(obs.conceptCode)) return false
        if (obs.conceptCode.includes(concept)) return false

        const [, code] = concept.split(':')
        if (code && obs.conceptCode.includes(code)) return false

        if (obs.conceptCode.toLowerCase().includes(concept.toLowerCase())) return false
      }

      // If no matches found, it's uncategorized
      return true
    })

    logger.debug('Uncategorized observations found', {
      visitId: selectedVisit.value.id,
      totalObservations: allVisitObservations.length,
      uncategorizedCount: uncategorized.length,
      uncategorizedConcepts: uncategorized.map((obs) => obs.conceptCode),
    })

    return uncategorized
  })

  // Virtual uncategorized field set
  const uncategorizedFieldSet = computed(() => {
    if (uncategorizedObservations.value.length === 0) return null

    return {
      id: 'uncategorized',
      name: 'Uncategorized',
      description: "Observations that don't belong to any configured category",
      icon: 'help_outline',
      concepts: uncategorizedObservations.value.map((obs) => obs.conceptCode),
      isVirtual: true,
    }
  })

  return {
    uncategorizedObservations,
    uncategorizedFieldSet,
  }
}
