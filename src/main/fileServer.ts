import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

export class FileServer {
  private server: http.Server | null = null;
  private port: number = 8888;
  
  start(contentPath: string, port: number = 8888): Promise<void> {
    this.port = port;
    
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url || '');
        const pathname = decodeURIComponent(parsedUrl.pathname || '/');
        const filePath = path.join(contentPath, pathname);
        
        // Security: Prevent directory traversal
        if (!filePath.startsWith(contentPath)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        
        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          
          // Set appropriate headers
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: { [key: string]: string } = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.html': 'text/html',
            '.vtt': 'text/vtt',
            '.json': 'application/json',
          };
          
          const mimeType = mimeTypes[ext] || 'application/octet-stream';
          
          // Support range requests for video/audio
          const range = req.headers.range;
          
          if (range && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
            const chunkSize = end - start + 1;
            
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${stats.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': mimeType,
              'Access-Control-Allow-Origin': '*',
            });
            
            const stream = fs.createReadStream(filePath, { start, end });
            stream.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': stats.size,
              'Content-Type': mimeType,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=3600',
            });
            
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
          }
        });
      });
      
      this.server.listen(this.port, () => {
        console.log(`File server running on http://localhost:${this.port}`);
        resolve();
      });
      
      this.server.on('error', reject);
    });
  }
  
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
  
  getUrl(filePath: string): string {
    return `http://localhost:${this.port}/${filePath}`;
  }
}