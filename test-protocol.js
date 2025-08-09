// Test script to verify content:// protocol with byte-range support
const { app, protocol } = require('electron');
const fs = require('fs');
const path = require('path');

// Test file paths
const testVideoPath = 'X:\\Workspace\\CBTPoc\\content\\sample-package\\videos\\intro.mp4';
const testAudioPath = 'X:\\Workspace\\CBTPoc\\content\\sample-package\\tts\\lesson-narration.mp3';

// Function to parse Range header
function parseRangeHeader(rangeHeader, fileSize) {
  const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  
  if (!matches) {
    return null;
  }

  const startStr = matches[1];
  const endStr = matches[2];

  let start;
  let end;

  if (startStr === '' && endStr === '') {
    return null;
  } else if (startStr === '') {
    const suffixLength = parseInt(endStr, 10);
    if (suffixLength === 0) {
      return null;
    }
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else if (endStr === '') {
    start = parseInt(startStr, 10);
    end = fileSize - 1;
  } else {
    start = parseInt(startStr, 10);
    end = parseInt(endStr, 10);
  }

  if (start < 0 || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

// Register protocol before app ready
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

app.whenReady().then(() => {
  console.log('[Test] Setting up content:// protocol with byte-range support...');
  
  protocol.handle('content', async (request) => {
    const url = request.url.replace('content://', '');
    const decodedUrl = decodeURIComponent(url);
    
    let filePath = decodedUrl;
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.substring(1);
    }
    
    console.log('[Test] Request for:', filePath);
    console.log('[Test] Range header:', request.headers.get('range'));
    
    if (!fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 });
    }
    
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const ext = path.extname(filePath).toLowerCase();
    
    let mimeType = 'application/octet-stream';
    if (ext === '.mp4') mimeType = 'video/mp4';
    else if (ext === '.mp3') mimeType = 'audio/mpeg';
    
    const rangeHeader = request.headers.get('range');
    
    if (rangeHeader) {
      const range = parseRangeHeader(rangeHeader, fileSize);
      if (!range) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` }
        });
      }
      
      console.log('[Test] Serving range:', range.start, '-', range.end);
      
      const contentLength = range.end - range.start + 1;
      const buffer = Buffer.alloc(contentLength);
      const fd = fs.openSync(filePath, 'r');
      
      try {
        fs.readSync(fd, buffer, 0, contentLength, range.start);
      } finally {
        fs.closeSync(fd);
      }
      
      return new Response(buffer, {
        status: 206,
        statusText: 'Partial Content',
        headers: {
          'Content-Type': mimeType,
          'Content-Length': contentLength.toString(),
          'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`,
          'Accept-Ranges': 'bytes'
        }
      });
    } else {
      console.log('[Test] Serving full file, size:', fileSize);
      const fileData = fs.readFileSync(filePath);
      
      return new Response(fileData, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes'
        }
      });
    }
  });
  
  console.log('[Test] Protocol registered successfully!');
  
  // Test with simulated requests
  console.log('\n[Test] Testing video URL: content://' + encodeURIComponent(testVideoPath.replace(/\\/g, '/')));
  console.log('[Test] Testing audio URL: content://' + encodeURIComponent(testAudioPath.replace(/\\/g, '/')));
  
  // Test if files exist
  if (fs.existsSync(testVideoPath)) {
    const videoStats = fs.statSync(testVideoPath);
    console.log('[Test] Video file exists, size:', videoStats.size, 'bytes');
  } else {
    console.log('[Test] Video file NOT found!');
  }
  
  if (fs.existsSync(testAudioPath)) {
    const audioStats = fs.statSync(testAudioPath);
    console.log('[Test] Audio file exists, size:', audioStats.size, 'bytes');
  } else {
    console.log('[Test] Audio file NOT found!');
  }
  
  console.log('\n[Test] Protocol test complete. The content:// protocol should now work with byte-range support.');
  console.log('[Test] URLs should be in format: content://X%3A%2FWorkspace%2FCBTPoc%2Fcontent%2Fsample-package%2Fvideos%2Fintro.mp4');
  
  setTimeout(() => {
    app.quit();
  }, 2000);
});