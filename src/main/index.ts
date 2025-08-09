import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ContentLoader } from './contentLoader';
import { FileServer } from './fileServer';
// MediaProtocolHandlerLegacy is no longer needed - using unified content:// protocol
// import { MediaProtocolHandlerLegacy } from './protocols/mediaProtocolHandlerLegacy';

let mainWindow: BrowserWindow | null = null;
let contentLoader: ContentLoader;
let fileServer: FileServer;

const isDev = process.argv.includes('--dev');

// NOTE: Custom video:// and audio:// protocols removed - using content:// for everything
// // console.log('[Main] Registering custom protocols...');
// MediaProtocolHandlerLegacy.registerProtocols();

// Register content:// protocol for ALL files (including media with byte-range support)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'content',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: false
    }
  }
]);
// console.log('[Main] Protocol schemes registered as privileged');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDev, // Disable in dev for easier testing
      allowRunningInsecureContent: isDev, // Allow mixed content in dev
    },
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
  
  // Add crash and error handlers
  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('[Main] Renderer process crashed!', { killed });
    dialog.showErrorBox('Application Crashed', 'The application has crashed. Please restart.');
  });
  
  mainWindow.webContents.on('unresponsive', () => {
    console.error('[Main] Renderer process is unresponsive!');
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: 'warning',
      buttons: ['Wait', 'Reload'],
      title: 'Application Unresponsive',
      message: 'The application is not responding. Would you like to wait or reload?'
    });
    if (choice === 1) {
      mainWindow?.webContents.reload();
    }
  });
  
  mainWindow.webContents.on('responsive', () => {
    // console.log('[Main] Renderer process is responsive again');
  });
  
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Main] Render process gone!', details);
    dialog.showErrorBox('Render Process Error', `The render process has terminated: ${details.reason}`);
  });

  const indexPath = isDev
    ? `http://localhost:8080` // Webpack dev server
    : `file://${path.join(__dirname, '../renderer/index.html')}`;

  mainWindow.loadURL(indexPath);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Register keyboard shortcuts for the window
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 to toggle DevTools
    if (input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
    // Ctrl+Shift+I to toggle DevTools
    if (input.control && input.shift && input.key === 'I') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
    // F5 to reload
    if (input.key === 'F5') {
      mainWindow?.webContents.reload();
      event.preventDefault();
    }
    // Ctrl+R to reload
    if (input.control && input.key === 'R') {
      mainWindow?.webContents.reload();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Protocol for serving local content files with byte-range support for media
function setupProtocol() {
  // console.log('[Protocol] Setting up content:// protocol handler with byte-range support');
  
  protocol.handle('content', async (request) => {
    // console.log('[Protocol] ========== REQUEST START ==========');
    // console.log('[Protocol] Full request URL:', request.url);
    // console.log('[Protocol] Request method:', request.method);
    // console.log('[Protocol] Request headers:', JSON.stringify(request.headers));
    
    const url = request.url.replace('content://', '');
    const decodedUrl = decodeURIComponent(url);
    
    // Handle Windows paths correctly
    let filePath = decodedUrl;
    
    // Remove any leading slashes for Windows absolute paths
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.substring(1);
    }
    
    // console.log('[Protocol] Decoded URL:', decodedUrl);
    // console.log('[Protocol] Final file path:', filePath);
    // console.log('[Protocol] File extension:', path.extname(filePath));
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('[Protocol] File not found:', filePath);
        return new Response('File not found', { 
          status: 404,
          statusText: 'Not Found'
        });
      }
      
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      // Determine MIME type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'application/octet-stream';
      
      switch (ext) {
        case '.mp4':
          mimeType = 'video/mp4';
          break;
        case '.webm':
          mimeType = 'video/webm';
          break;
        case '.ogg':
        case '.ogv':
          mimeType = 'video/ogg';
          break;
        case '.wav':
          mimeType = 'audio/wav';
          break;
        case '.mp3':
          mimeType = 'audio/mpeg';
          break;
        case '.m4a':
          mimeType = 'audio/mp4';
          break;
        case '.vtt':
          mimeType = 'text/vtt';
          break;
        case '.html':
          mimeType = 'text/html';
          break;
        case '.css':
          mimeType = 'text/css';
          break;
        case '.js':
          mimeType = 'application/javascript';
          break;
        case '.json':
          mimeType = 'application/json';
          break;
      }
      
      // Check for Range header (for media seeking support)
      const rangeHeader = request.headers.get('range');
      
      if (rangeHeader && (ext === '.mp4' || ext === '.webm' || ext === '.mp3' || ext === '.wav' || ext === '.m4a')) {
        // Handle byte-range request for media files
        // console.log('[Protocol] Range request detected:', rangeHeader);
        
        const range = parseRangeHeader(rangeHeader, fileSize);
        if (!range) {
          return new Response('Range Not Satisfiable', {
            status: 416,
            statusText: 'Range Not Satisfiable',
            headers: {
              'Content-Range': `bytes */${fileSize}`
            }
          });
        }
        
        // console.log('[Protocol] Range request - start:', range.start, 'end:', range.end, 'total:', fileSize);
        
        // Read only the requested range
        const contentLength = range.end - range.start + 1;
        const buffer = Buffer.alloc(contentLength);
        const fd = fs.openSync(filePath, 'r');
        
        try {
          fs.readSync(fd, buffer, 0, contentLength, range.start);
        } finally {
          fs.closeSync(fd);
        }
        
        // console.log('[Protocol] Serving partial content:', contentLength, 'bytes');
        
        return new Response(buffer, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Type': mimeType,
            'Content-Length': contentLength.toString(),
            'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache'
          }
        });
      } else {
        // Handle full file request
        // console.log('[Protocol] Full file request, size:', fileSize, 'MIME:', mimeType);
        
        // Read entire file
        const fileData = fs.readFileSync(filePath);
        
        // Log first few bytes for debugging audio files
        if (ext === '.wav') {
          const header = fileData.slice(0, 4).toString('ascii');
          const fmt = fileData.slice(8, 12).toString('ascii');
          // console.log('[Protocol] WAV file header:', header, '(should be RIFF)');
          // console.log('[Protocol] WAV format chunk:', fmt, '(should be WAVE)');
        }
        
        // Return response with proper headers
        const headers: any = {
          'Content-Type': mimeType,
          'Content-Length': fileSize.toString(),
          'Cache-Control': 'no-cache',
          'Accept-Ranges': 'bytes'
        };
        
        // Add headers for HTML files to allow iframe embedding
        if (ext === '.html') {
          headers['X-Frame-Options'] = 'SAMEORIGIN';
          // Allow content:// protocol in CSP
          headers['Content-Security-Policy'] = "default-src 'self' 'unsafe-inline' 'unsafe-eval' content: file: data:; frame-ancestors 'self' content: file:;";
        }
        
        const response = new Response(fileData, {
          status: 200,
          statusText: 'OK',
          headers
        });
        
        // console.log('[Protocol] ========== REQUEST END (SUCCESS) ==========');
        return response;
      }
    } catch (error) {
      console.error('[Protocol] Error loading file:', error);
      // console.log('[Protocol] ========== REQUEST END (ERROR) ==========');
      return new Response('File read error', { 
        status: 500,
        statusText: 'Internal Server Error'
      });
    }
  });
  
  // console.log('[Protocol] content:// protocol handler registered with byte-range support');
}

// Helper function to parse Range header
function parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  
  if (!matches) {
    return null;
  }

  const startStr = matches[1];
  const endStr = matches[2];

  let start: number;
  let end: number;

  if (startStr === '' && endStr === '') {
    return null;
  } else if (startStr === '') {
    // Range: bytes=-100 (last 100 bytes)
    const suffixLength = parseInt(endStr, 10);
    if (suffixLength === 0) {
      return null;
    }
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else if (endStr === '') {
    // Range: bytes=100- (from byte 100 to end)
    start = parseInt(startStr, 10);
    end = fileSize - 1;
  } else {
    // Range: bytes=100-200
    start = parseInt(startStr, 10);
    end = parseInt(endStr, 10);
  }

  // Validate range
  if (start < 0 || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

// Create application menu
function createMenu() {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Content Package',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu-open-content');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'F5',
          click: () => {
            mainWindow?.webContents.reload();
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow?.webContents.reloadIgnoringCache();
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          }
        },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About CBT Multimedia Sync',
              message: 'CBT Multimedia Sync',
              detail: 'Version 1.0.0\nA synchronized multimedia player for CBT content',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // console.log('[Main] App ready, setting up protocol handlers...');
  
  // Setup unified content:// protocol with byte-range support for all files
  setupProtocol();
  
  // NOTE: MediaProtocolHandlerLegacy is no longer needed - content:// handles everything
  // MediaProtocolHandlerLegacy.setupHandlers(); // DISABLED - using content:// instead
  
  // Initialize services
  contentLoader = new ContentLoader();
  fileServer = new FileServer();
  
  // Create menu
  createMenu();
  
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

// IPC Handlers
ipcMain.handle('open-content-package', async () => {
  // console.log('[Main] Opening content package dialog');
  
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Content Package', extensions: ['zip', 'pak'] },
      { name: 'Manifest', extensions: ['json'] },
    ],
  });

  if (!result.canceled && result.filePaths[0]) {
    // console.log('[Main] File selected:', result.filePaths[0]);
    
    try {
      const manifest = await contentLoader.loadPackage(result.filePaths[0]);
      // console.log('[Main] Package loaded successfully');
      // console.log('[Main] Manifest tracks:', manifest.tracks.map(t => `${t.type}(${t.items.length} items)`).join(', '));
      
      // For ZIP files, the basePath is handled by the content loader
      // It updates all paths to absolute paths pointing to the extracted temp directory
      const basePath = path.dirname(result.filePaths[0]);
      
      return { success: true, manifest, basePath };
    } catch (error) {
      console.error('[Main] Error loading package:', error);
      return { success: false, error: (error as Error).message + '\n' + (error as Error).stack };
    }
  }
  
  return { success: false, error: 'No file selected' };
});

ipcMain.handle('load-local-manifest', async (event, manifestPath: string) => {
  // console.log('[Main] Loading local manifest:', manifestPath);
  
  try {
    const manifest = await contentLoader.loadManifest(manifestPath);
    // console.log('[Main] Local manifest loaded successfully');
    
    return { success: true, manifest, basePath: path.dirname(manifestPath) };
  } catch (error) {
    console.error('[Main] Error loading local manifest:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-file-url', (event, filePath: string) => {
  // Now use content:// protocol for ALL files including media
  const normalizedPath = filePath.replace(/\\/g, '/');
  const url = `content://${encodeURIComponent(normalizedPath)}`;
  
  const ext = path.extname(filePath).toLowerCase();
  if (['.mp4', '.webm', '.ogg', '.ogv', '.avi', '.mkv', '.mov'].includes(ext)) {
    // console.log('[Main] Converting video file to content:// URL with byte-range support:');
  } else if (['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.flac', '.weba'].includes(ext)) {
    // console.log('[Main] Converting audio file to content:// URL with byte-range support:');
  } else {
    // console.log('[Main] Converting file path to content:// URL:');
  }
  // console.log('  Input:', filePath);
  // console.log('  URL:', url);
  return url;
});

// Add specific handlers for video and audio URLs - now using content:// protocol
ipcMain.handle('get-video-url', (event, filePath: string) => {
  // Use content:// protocol for all media files now
  const normalizedPath = filePath.replace(/\\/g, '/');
  const url = `content://${encodeURIComponent(normalizedPath)}`;
  // console.log('[Main] Converting video file to content:// URL:');
  // console.log('  Input:', filePath);
  // console.log('  URL:', url);
  return url;
});

ipcMain.handle('get-audio-url', (event, filePath: string) => {
  // Use content:// protocol for all media files now
  const normalizedPath = filePath.replace(/\\/g, '/');
  const url = `content://${encodeURIComponent(normalizedPath)}`;
  // console.log('[Main] Converting audio file to content:// URL:');
  // console.log('  Input:', filePath);
  // console.log('  URL:', url);
  return url;
});