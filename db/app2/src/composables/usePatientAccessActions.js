/**
 * usePatientAccessActions — shared action layer for a patient's access/rights
 * (owner + public visibility). Mirrors usePatientStudyActions in style:
 * each mutation awaits the DB write, notifies the user, and returns a confirmed
 * detail object (or null on failure) so callers can patch UI in place.
 *
 * The "may I manage this?" decision uses the shared canManagePatientAccess
 * policy (admin | owner | ownerless-public) so UI and the store guard agree.
 */

import { useI18n } from 'vue-i18n'
import { useDatabaseStore } from 'src/stores/database-store'
import { useAuthStore } from 'src/stores/auth-store'
import { useNotify } from 'src/composables/useNotify'
import { useLoggingStore } from 'src/stores/logging-store'
import { canManagePatientAccess } from 'src/shared/utils/patient-access.js'

export function usePatientAccessActions() {
  const { t } = useI18n()
  const dbStore = useDatabaseStore()
  const authStore = useAuthStore()
  const notify = useNotify()
  const logger = useLoggingStore().createLogger('PatientAccessActions')

  /** { ownerUserId, ownerUserCd, ownerName, isPublic } for one patient. */
  const loadAccessInfo = async (patientNum) => {
    if (patientNum == null) return { ownerUserId: null, ownerUserCd: null, ownerName: null, isPublic: false }
    const map = await dbStore.getPatientAccessInfo([patientNum])
    return map.get(patientNum) || { ownerUserId: null, ownerUserCd: null, ownerName: null, isPublic: false }
  }

  /** Whether the current user may change owner/public for this access info. */
  const canManage = (accessInfo) =>
    canManagePatientAccess({
      isAdmin: authStore.isAdmin,
      currentUserId: authStore.currentUser?.USER_ID,
      ownerUserId: accessInfo?.ownerUserId ?? null,
      isPublic: !!accessInfo?.isPublic,
    })

  /** Selectable owners: [{ label, value, disable }] (excludes public user 0). */
  const loadUserOptions = async (currentOwnerId = null) => {
    const result = await dbStore.executeQuery(
      'SELECT USER_ID, USER_CD, NAME_CHAR FROM USER_MANAGEMENT WHERE USER_ID != 0 ORDER BY USER_CD',
    )
    return (result.success ? result.data : []).map((user) => ({
      label: user.NAME_CHAR ? `${user.NAME_CHAR} (${user.USER_CD})` : user.USER_CD,
      value: user.USER_ID,
      disable: user.USER_ID === currentOwnerId,
    }))
  }

  /** Toggle public visibility. Returns confirmed detail or null. */
  const setPublic = async (patientNum, isPublic) => {
    try {
      if (patientNum == null) return null
      await dbStore.setPatientPublicAccess(patientNum, isPublic)
      notify.success(isPublic ? t('patient.menuNowPublic') : t('patient.menuNowPrivate'))
      return { type: 'public', patientNum, isPublic }
    } catch (error) {
      logger.error('Failed to toggle public access', error)
      notify.error(error.message)
      return null
    }
  }

  /** Transfer ownership to another user. Returns confirmed detail or null. */
  const transferOwner = async (patientNum, newUserId) => {
    try {
      if (patientNum == null || newUserId == null) return null
      await dbStore.transferPatientOwnership(patientNum, newUserId)
      notify.success(t('patient.menuOwnerChanged'))
      return { type: 'owner', patientNum, newUserId }
    } catch (error) {
      logger.error('Failed to transfer ownership', error)
      notify.error(error.message)
      return null
    }
  }

  return {
    loadAccessInfo,
    canManage,
    loadUserOptions,
    setPublic,
    transferOwner,
  }
}
