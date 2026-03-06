const { app, BrowserWindow, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  win.loadFile(path.join(__dirname, '../dist/index.html'))

  // 앱 시작 3초 후 업데이트 체크
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000)
}

app.whenReady().then(createWindow)

// 업데이트 발견 시
autoUpdater.on('update-available', () => {
  console.log('새 버전 발견, 다운로드 중...')
})

// 다운로드 완료 시 → 재시작하면 적용
autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})