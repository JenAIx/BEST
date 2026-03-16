import { boot } from 'quasar/wrappers'
import { createI18n } from 'vue-i18n'
import de from 'src/i18n/de.json'

const i18n = createI18n({
  locale: 'de',
  fallbackLocale: 'de',
  messages: { de },
  legacy: true,
})

export default boot(({ app }) => {
  app.use(i18n)
})

export { i18n }
