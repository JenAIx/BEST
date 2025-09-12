import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import de from './locales/de.json'

const messages = {
  en,
  de,
}

// Simple locale detection with fallback
let locale = 'de' // Default to German

try {
  // Try to get saved locale first
  const saved = localStorage?.getItem('locale')
  if (saved && ['de', 'en'].includes(saved)) {
    locale = saved
  } else {
    // Try browser locale
    const browserLang = navigator?.language?.split('-')[0]
    if (browserLang && ['de', 'en'].includes(browserLang)) {
      locale = browserLang
    }
  }
} catch (error) {
  console.warn('I18n: Using default locale due to error:', error)
}

const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'de',
  messages,
  globalInjection: true,
  warnHtmlMessage: false,
})

export default i18n
