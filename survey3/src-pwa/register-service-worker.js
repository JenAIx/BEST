import { Workbox } from 'workbox-window'

let wb

if ('serviceWorker' in navigator) {
  wb = new Workbox(process.env.SERVICE_WORKER_FILE)

  wb.addEventListener('activated', (event) => {
    // event.isUpdate will be true if another version of the
    // service worker was controlling the page when this version was registered
    if (event.isUpdate) {
      // Optional: prompt user to reload
    }
  })

  wb.register()
}

export { wb }
