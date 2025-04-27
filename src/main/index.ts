import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.icns?asset'
import { setupAuthHandlers } from './handlers/auth'
import { setupEmailHandlers } from './handlers/email'
import { setupActionItemsHandlers } from './handlers/action-items'
import { SyncService } from './services/sync'
import { emailRepository } from './services/database/email'
import { setupPeopleHandlers } from './handlers/people'
import { authService } from './services/auth'
import { setupSettingsHandlers } from './handlers/settings'
import { setupDownloadHandlers } from './handlers/download'

let isQuitting = false

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cid',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

const setupHandlers = (): void => {
  setupAuthHandlers()
  setupEmailHandlers()
  setupPeopleHandlers()
  setupActionItemsHandlers()
  setupSettingsHandlers()
  setupDownloadHandlers()
}

// Instantiate services - SyncService constructor now sets up listeners
new SyncService()

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 10 },
    icon,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // TODO: this is too dumb, may have some cross-platform issues
  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault()
      app.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.on('before-quit', () => {
  isQuitting = true
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  createWindow()
  protocol.handle('cid', async (request) => {
    const cid = new URL(request.url).hostname

    try {
      const attachment = await emailRepository.getAttachmentByCid(cid)

      if (!attachment) return new Response('Not found', { status: 404 })
      return new Response(attachment?.data, { headers: { 'Content-Type': attachment?.mimeType } })
    } catch (error) {
      console.error(`Failed to load image for CID ${cid}:`, error)
      return new Response()
    }
  })

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.debug('pong'))

  setupHandlers()

  // Check initial auth status which will trigger SyncService initialization if needed
  try {
    await authService.checkInitialAuthStatus()
  } catch (error) {
    console.error('Failed to check initial authentication status:', error)
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
