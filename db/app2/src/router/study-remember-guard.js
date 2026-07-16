/**
 * Remember-last-study Route Guard
 *
 * A fresh navigation to /studies re-opens the study the user last had
 * selected (persisted via local-settings-store). Coming FROM a study details
 * page (back button / sidebar while inside a study) or from the list itself
 * always shows the list — otherwise it would be unreachable. `?stay=1` is an
 * explicit escape hatch for links.
 *
 * Stale ids self-heal: study-store.loadStudyById clears the remembered id
 * when the study no longer exists, deleteStudy clears it on delete.
 */

import { useLocalSettingsStore } from 'src/stores/local-settings-store'

export const reopenLastStudy = (to, from, next) => {
  if (from.path === '/studies' || from.path.startsWith('/studies/') || to.query.stay === '1') {
    next()
    return
  }
  const lastStudyId = useLocalSettingsStore().getLastSelectedStudyId()
  if (lastStudyId != null && lastStudyId !== '') {
    next(`/studies/${lastStudyId}`)
    return
  }
  next()
}
