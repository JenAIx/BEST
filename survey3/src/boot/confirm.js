import { boot } from 'quasar/wrappers'
import { Dialog } from 'quasar'
import { i18n } from 'src/boot/i18n'

// Einheitlicher Bestätigungsdialog als Ersatz für das native window.confirm.
// Gibt ein Promise<boolean> zurück -> Aufruf: `if (!(await this.$confirm(msg))) return`.
// Quasar-Dialog ist konsistent gestylt und auf Touch/Mobil bedienbar.
export function confirm(message, opts = {}) {
  const t = i18n.global.t
  return new Promise((resolve) => {
    Dialog.create({
      title: opts.title || t('btn.confirm_title'),
      message,
      cancel: { label: t('btn.no'), flat: true, color: 'grey-8' },
      ok: { label: opts.okLabel || t('btn.yes'), color: opts.color || 'primary' },
      persistent: true,
    })
      .onOk(() => resolve(true))
      .onCancel(() => resolve(false))
  })
}

export default boot(({ app }) => {
  // global als this.$confirm verfügbar (Options API)
  app.config.globalProperties.$confirm = confirm
})
