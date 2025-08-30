import { app, BrowserWindow } from 'electron'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// needed in case process is undefined under Linux
const platform = process.platform || os.platform()

let mainWindow

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(__dirname, 'icons/icon.png'), // tray icon
    width: 1600,
    height: 900,
    x: 10,
    y: 10,
    useContentSize: false,
    show: true,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: process.env.QUASAR_ELECTRON_PRELOAD ? path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD) : path.resolve(__dirname, 'preload/electron-preload.cjs'),
      sandbox: false,
      // Allow external HTTP requests like in the original working app
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  })

  const appURL = process.env.APP_URL || 'http://localhost:9000'
  console.log('Loading URL:', appURL)
  mainWindow.loadURL(appURL)

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('Electron window ready - showing window for VNC access')
    mainWindow.show()
    mainWindow.focus()
    mainWindow.moveTop()
    console.log('Window bounds:', mainWindow.getBounds())
    console.log('Window visible:', mainWindow.isVisible())
  })

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools()
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      // mainWindow.webContents.closeDevTools()
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
