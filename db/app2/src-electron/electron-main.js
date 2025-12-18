import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// needed in case process is undefined under Linux
const platform = process.platform || os.platform()

let mainWindow

async function createWindow() {
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
      allowRunningInsecureContent: true,
    },
  })

  const appURL = process.env.APP_URL
  console.log('Resolved APP_URL:', appURL)

  const loadPackagedIndex = async () => {
    const packagedIndex = path.join(process.resourcesPath, 'app.asar', 'index.html')
    console.log('Falling back to packaged index:', packagedIndex)
    try {
      await mainWindow.loadFile(packagedIndex)
    } catch (err) {
      console.error('Failed to load packaged index.html:', err)
      throw err
    }
  }

  try {
    if (appURL && appURL.length > 0) {
      console.log('Loading APP_URL:', appURL)
      await mainWindow.loadURL(appURL).catch(async (e) => {
        console.error('loadURL rejected:', e)
        await loadPackagedIndex()
      })
    } else {
      const devIndex = path.resolve(__dirname, '../index.html')
      console.log('APP_URL missing, loading dev-built file:', devIndex)
      await mainWindow.loadFile(devIndex).catch(async (e) => {
        console.error('loadFile(dev) rejected:', e)
        await loadPackagedIndex()
      })
    }
  } catch (err) {
    console.error('Failed initial load, trying packaged index:', err)
    await loadPackagedIndex()
  }

  // Optional diagnostics (keep listeners minimal in production)
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load:', { errorCode, errorDescription, validatedURL })
  })

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

// IPC Handlers
ipcMain.handle('dialog:openDirectory', async (event, options) => {
  // Merge user options with smart defaults
  const dialogOptions = {
    properties: ['openDirectory'],
    title: 'Select Folder',
    // Default to app directory if no defaultPath is provided
    defaultPath: options?.defaultPath || app.getPath('userData'),
    ...options,
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, dialogOptions)
    return result
  } catch (error) {
    console.error('Error showing open dialog:', error)
    return { canceled: true, filePaths: [] }
  }
})

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
