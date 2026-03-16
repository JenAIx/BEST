import { boot } from 'quasar/wrappers'
import { log } from 'src/tools/Logger'

export default boot(({ app }) => {
  app.config.errorHandler = (err, vm, info) => {
    log({ error: `[Vue] ${err.message}`, data: info })
  }
  window.addEventListener('unhandledrejection', (event) => {
    log({ error: `[Promise] ${event.reason}` })
  })
})
