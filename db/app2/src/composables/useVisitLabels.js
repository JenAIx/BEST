/**
 * useVisitLabels — resolves visit-type and visit-status display metadata for a
 * whole visit list ONCE (no per-card async, no label flicker) and exposes
 * synchronous lookups for templates.
 *
 * Label source of truth: globalSettingsStore.getVisitTypeOptions() (CODE_LOOKUP
 * VISIT_DIMENSION/VISIT_TYPE_CD, LOOKUP_BLOB.label — e.g. "Stroke-Lipid V1 -
 * Index Stroke"). Codes not found there fall back to the concept-resolution
 * store, then to the static maps in visit-labels.js.
 */

import { reactive } from 'vue'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { extractVisitType, buildTypeMeta, statusCssClass, DEFAULT_TYPE_META, DEFAULT_STATUS_META } from 'src/shared/utils/visit-labels.js'

export function useVisitLabels() {
  const globalSettingsStore = useGlobalSettingsStore()
  const conceptStore = useConceptResolutionStore()
  const logger = useLoggingStore().createLogger('VisitLabels')

  // code → {label, icon, color} / status → {label, color, cssClass}
  const typeMetaByCode = reactive({})
  const statusMetaByCode = reactive({})

  /** Resolve every distinct type/status code in the given visits. */
  const resolveAll = async (visits = []) => {
    if (!visits.length) return

    let options = []
    try {
      options = (await globalSettingsStore.getVisitTypeOptions()) || []
    } catch (error) {
      logger.warn('Failed to load visit type options, using fallbacks', { error: error.message })
    }

    const typeCodes = new Set()
    const statusCodes = new Set()
    for (const visit of visits) {
      const type = extractVisitType(visit)
      if (type) typeCodes.add(type)
      if (visit.status) statusCodes.add(visit.status)
    }

    await Promise.all([
      ...[...typeCodes].map(async (code) => {
        const meta = buildTypeMeta(code, options)
        // Not in the DB options → try concept resolution before the static fallback
        if (!options.some((vt) => vt.value === code)) {
          try {
            const resolved = await conceptStore.resolveConcept(code, {
              context: 'visit_type',
              table: 'VISIT_DIMENSION',
              column: 'VISIT_TYPE_CD',
            })
            if (resolved?.label) meta.label = resolved.label
            if (resolved?.color) meta.color = resolved.color
          } catch {
            // keep static fallback
          }
        }
        typeMetaByCode[code] = meta
      }),
      ...[...statusCodes].map(async (status) => {
        try {
          const resolved = await conceptStore.resolveConcept(status, {
            context: 'visit_status',
            table: 'VISIT_DIMENSION',
            column: 'ACTIVE_STATUS_CD',
          })
          statusMetaByCode[status] = {
            label: resolved?.label || status,
            color: resolved?.color || DEFAULT_STATUS_META.color,
            cssClass: statusCssClass(resolved?.label, status),
          }
        } catch {
          statusMetaByCode[status] = {
            ...DEFAULT_STATUS_META,
            cssClass: statusCssClass(null, status),
          }
        }
      }),
    ])
  }

  /** Synchronous lookup for templates (safe before resolveAll finishes). */
  const typeMeta = (visit) => {
    const code = extractVisitType(visit)
    if (!code) return DEFAULT_TYPE_META
    return typeMetaByCode[code] || { ...DEFAULT_TYPE_META, label: code }
  }

  const statusMeta = (visit) => {
    if (!visit?.status) return DEFAULT_STATUS_META
    return (
      statusMetaByCode[visit.status] || {
        ...DEFAULT_STATUS_META,
        cssClass: statusCssClass(null, visit.status),
      }
    )
  }

  return { resolveAll, typeMeta, statusMeta }
}
