/**
 * usePatientStudyActions — shared action layer for the PatientCard concept.
 *
 * Every place a patient card offers study operations (PatientCard context
 * menu, PatientStudyInfoCard on the Patientendaten tab, the grid's patient
 * cell) uses these functions instead of talking to repositories directly.
 *
 * Contract: each mutating action awaits the DB write, shows the user
 * notification itself, and returns a **confirmed change detail**
 *   { type: 'enroll' | 'withdraw' | 'status', studyNum, patientNum, status }
 * on success (or null on failure). Callers pass that detail up (e.g. via the
 * card's `changed` callback) so list views can patch the affected card in
 * place instead of reloading the whole page.
 *
 * Layering: composable = controller (notify/i18n/detail objects),
 * study-store = model (DB writes + audit-cache refresh).
 */

import { useI18n } from 'vue-i18n'
import { useDatabaseStore } from 'src/stores/database-store'
import { useStudyStore } from 'src/stores/study-store'
import { useNotify } from 'src/composables/useNotify'
import { useLoggingStore } from 'src/stores/logging-store'
import { normalizeEnrollmentStatus } from 'src/shared/utils/enrollment-status.js'

export function usePatientStudyActions() {
  const { t } = useI18n()
  const dbStore = useDatabaseStore()
  const studyStore = useStudyStore()
  const notify = useNotify()
  const logger = useLoggingStore().createLogger('PatientStudyActions')

  /**
   * Resolve PATIENT_NUM from any card shape (raw row, PatientCard shape,
   * grid row); falls back to a DB lookup by PATIENT_CD.
   */
  const resolvePatientNum = async (patient) => {
    const direct = patient?.PATIENT_NUM ?? patient?.patient_num ?? patient?.originalData?.PATIENT_NUM ?? patient?.rawData?.PATIENT_NUM
    if (direct != null) return direct
    const code = patient?.id ?? patient?.PATIENT_CD ?? patient?.patientId
    if (code == null) return null
    const result = await dbStore.executeQuery('SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?', [code])
    return result.success && result.data.length > 0 ? result.data[0].PATIENT_NUM : null
  }

  /** All studies (for pickers/submenus): [{ studyNum, studyCd, label }] */
  const loadAllStudies = async () => {
    const result = await dbStore.executeQuery('SELECT STUDY_NUM, STUDY_CD, NAME_CHAR FROM STUDY_DIMENSION ORDER BY NAME_CHAR')
    return (result.success ? result.data : []).map((s) => ({
      studyNum: s.STUDY_NUM,
      studyCd: s.STUDY_CD,
      label: s.NAME_CHAR,
    }))
  }

  /**
   * A patient's study memberships (any STUDY_PATIENT_LOOKUP row, incl.
   * withdrawn): [{ studyNum, label, status, enrollmentDate, withdrawalDate }]
   */
  const loadMemberships = async (patientNum) => {
    if (patientNum == null) return []
    const studyRepo = dbStore.getRepository('study')
    const rows = await studyRepo.getPatientStudies(patientNum)
    return rows.map((m) => ({
      studyNum: m.STUDY_NUM,
      label: m.NAME_CHAR,
      status: normalizeEnrollmentStatus(m.ENROLLMENT_STATUS_CD),
      enrollmentDate: m.ENROLLMENT_DATE,
      withdrawalDate: m.WITHDRAWAL_DATE,
    }))
  }

  /** Enroll (status 'active'). Returns confirmed detail or null. */
  const enroll = async (studyNum, patientNum, studyLabel = '') => {
    try {
      if (patientNum == null) return null
      await studyStore.enrollPatientInStudy(studyNum, patientNum)
      notify.success(t('patient.menuAssignedToStudy', { study: studyLabel }))
      return { type: 'enroll', studyNum, patientNum, status: 'active' }
    } catch (error) {
      logger.error('Failed to assign patient to study', error)
      notify.error(t('study.failedToEnroll'))
      return null
    }
  }

  /** Withdraw. Returns confirmed detail or null. */
  const withdraw = async (studyNum, patientNum, studyLabel = '') => {
    try {
      if (patientNum == null) return null
      await studyStore.withdrawPatientFromStudy(studyNum, patientNum)
      notify.success(t('patient.menuUnassignedFromStudy', { study: studyLabel }))
      return { type: 'withdraw', studyNum, patientNum, status: 'withdrawn' }
    } catch (error) {
      logger.error('Failed to withdraw patient from study', error)
      notify.error(t('study.failedToWithdraw'))
      return null
    }
  }

  /** Set enrollment status. Returns confirmed detail or null. */
  const setStatus = async (studyNum, patientNum, status) => {
    try {
      if (patientNum == null) return null
      await studyStore.setEnrollmentStatus(studyNum, [patientNum], status)
      notify.success(t('study.statusChanged'))
      return { type: 'status', studyNum, patientNum, status }
    } catch (error) {
      logger.error('Failed to set enrollment status', error)
      notify.error(t('study.failedToSetStatus'))
      return null
    }
  }

  return {
    resolvePatientNum,
    loadAllStudies,
    loadMemberships,
    enroll,
    withdraw,
    setStatus,
  }
}
