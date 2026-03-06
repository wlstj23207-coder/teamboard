const { app, BrowserWindow } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'default',
  })

  win.loadFile(path.join(__dirname, '../dist/index.html'))
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

autoUpdater.on('update-available', () => {
  console.log('새 버전 발견, 다운로드 중...')
})

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})
