import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Disable webSecurity to allow loading local assets from python server
    },
    title: "AI Visual Novel Engine",
    backgroundColor: "#0a0a0c"
  });

  // Remove default menu bar for cinematic feel
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    // Development mode: Attempt loading Vite server, retry on connection failure
    const devUrl = 'http://localhost:5173';
    
    const loadUrlWithRetry = () => {
      mainWindow.loadURL(devUrl).catch((err) => {
        console.log("Vite dev server starting, retrying in 500ms...");
        setTimeout(loadUrlWithRetry, 500);
      });
    };
    
    loadUrlWithRetry();
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode: Load compiled index.html
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
