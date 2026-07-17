/**
 * useVisitActions — shared per-visit actions (clone / delete with confirm
 * dialog, edit-dialog transform) for the unified timeline and, later, the
 * legacy timeline. Wraps the existing visitObservationService mutations.
 *
 * After every mutation BOTH stores are refreshed: the visit list AND the
 * patient-wide observation list — the unified cards render their bodies from
 * observationStore.allObservations, so a clone/delete without the second
 * reload would show an empty cloned card / orphaned rows.
 */

import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { buildVisitForEdit } from 'src/shared/utils/visit-edit-transform.js'
import { formatDate } from 'src/shared/utils/medical-utils.js'

export function useVisitActions({ getPatientNum, onChanged } = {}) {
  const $q = useQuasar()
  const { t } = useI18n()
  const visitStore = useVisitStore()
  const observationStore = useObservationStore()
  const logger = useLoggingStore().createLogger('VisitActions')

  const refresh = async () => {
    const patientNum = typeof getPatientNum === 'function' ? getPatientNum() : null
    if (patientNum != null) {
      await visitStore.loadVisitsForPatient(patientNum)
      await observationStore.loadAllObservationsForPatient(patientNum)
    }
    if (typeof onChanged === 'function') await onChanged()
  }

  const confirmClone = (visit) => {
    logger.logUserAction('visit_clone_dialog_opened', { visitId: visit.id })
    $q.dialog({
      title: t('visit.cloneVisitTitle'),
      message: t('visit.cloneVisitConfirm', { date: formatDate(visit.date) }),
      cancel: t('common.cancel'),
      persistent: true,
    }).onOk(async () => {
      try {
        await visitObservationService.duplicateVisit(visit)
        await refresh()
        logger.success('Visit cloned', { originalVisitId: visit.id })
      } catch (error) {
        logger.error('Visit clone failed', error, { originalVisitId: visit.id })
      }
    })
  }

  const confirmDelete = (visit) => {
    logger.logUserAction('visit_delete_dialog_opened', { visitId: visit.id, severity: 'high' })
    $q.dialog({
      title: t('visit.deleteVisitTitle'),
      message: t('visit.deleteVisitConfirm', {
        date: formatDate(visit.date),
        count: visit.observationCount || 0,
      }),
      cancel: t('common.cancel'),
      persistent: true,
      ok: { label: t('common.delete'), color: 'negative' },
    }).onOk(async () => {
      try {
        await visitObservationService.deleteVisit(visit)
        await refresh()
        logger.success('Visit deleted', { visitId: visit.id, severity: 'high' })
      } catch (error) {
        logger.error('Visit delete failed', error, { visitId: visit.id, severity: 'high' })
      }
    })
  }

  return { confirmClone, confirmDelete, buildVisitForEdit, refresh }
}
