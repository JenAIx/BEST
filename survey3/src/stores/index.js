import { createPinia } from 'pinia'
import { store } from 'quasar/wrappers'

export default store(function () {
  return createPinia()
})
