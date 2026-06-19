import { boot } from 'quasar/wrappers'
import { useMainStore } from 'src/stores/main'

// Exponiert den Pinia-Store NUR, wenn Cypress den Browser steuert (window.Cypress
// ist sonst undefined). Ermöglicht E2E-Tests, die strukturierte Store-Inhalte
// (z. B. QUESTMAN.summary mit multiple_radio-Arrays + berechnete results) prüfen.
// In Produktion ein No-op.
export default boot(() => {
  if (typeof window !== 'undefined' && window.Cypress) {
    window.__mainStore = useMainStore()
  }
})
