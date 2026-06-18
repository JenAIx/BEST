import { Workbox } from 'workbox-window'
import { Notify } from 'quasar'

let wb

if ('serviceWorker' in navigator) {
  wb = new Workbox(process.env.SERVICE_WORKER_FILE)

  wb.addEventListener('activated', (event) => {
    // event.isUpdate === true: ein neuer Service-Worker hat eine vorherige Version
    // abgelöst (= frischer Deploy). Nutzer auf Reload hinweisen, damit die neuen
    // Assets geladen werden (der SW selbst ist via skipWaiting bereits aktiv).
    if (event.isUpdate) {
      Notify.create({
        message: 'Neue Version verfügbar.',
        caption: 'Zum Aktualisieren neu laden.',
        color: 'primary',
        icon: 'system_update',
        timeout: 0, // bleibt stehen, bis der Nutzer reagiert
        position: 'bottom',
        actions: [
          { label: 'Neu laden', color: 'white', handler: () => window.location.reload() },
          { label: 'Später', color: 'white', flat: true },
        ],
      })
    }
  })

  wb.register()
}

export { wb }
