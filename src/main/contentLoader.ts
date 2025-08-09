import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

export interface Manifest {
  version: string;
  duration_ms: number;
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    created?: string;
  };
  tracks: Track[];
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'html' | 'subtitle';
  items: TrackItem[];
}

export interface TrackItem {
  id: string;
  file: string;
  start_ms: number;
  duration_ms?: number;
  end_ms?: number;
  layer?: number;
  metadata?: any;
}

export class ContentLoader {
  private currentPackagePath: string | null = null;
  private extractedPath: string | null = null;

  async loadPackage(packagePath: string): Promise<Manifest> {
    console.log('[ContentLoader] Loading package:', packagePath);
    const ext = path.extname(packagePath).toLowerCase();
    
    if (ext === '.zip' || ext === '.pak') {
      return this.loadZipPackage(packagePath);
    } else if (ext === '.json') {
      return this.loadManifest(packagePath);
    }
    
    throw new Error(`Unsupported package format: ${ext}`);
  }

  async loadZipPackage(zipPath: string): Promise<Manifest> {
    console.log('[ContentLoader] Loading ZIP package:', zipPath);
    
    try {
      const data = await fs.readFile(zipPath);
      console.log('[ContentLoader] ZIP file read, size:', data.length, 'bytes');
      
      const zip = await JSZip.loadAsync(data);
      console.log('[ContentLoader] ZIP loaded, files:', Object.keys(zip.files).length);
      
      // Extract to temp directory
      const tempDir = path.join(process.env.TEMP || '/tmp', `cbt-content-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      console.log('[ContentLoader] Extracting to:', tempDir);
      
      // Extract all files
      let extractedCount = 0;
      for (const [fileName, file] of Object.entries(zip.files)) {
        if (!file.dir) {
          const filePath = path.join(tempDir, fileName);
          const dirPath = path.dirname(filePath);
          
          await fs.mkdir(dirPath, { recursive: true });
          const content = await file.async('nodebuffer');
          await fs.writeFile(filePath, content);
          extractedCount++;
          console.log('[ContentLoader] Extracted:', fileName, '(' + content.length + ' bytes)');
        }
      }
      console.log('[ContentLoader] Extracted', extractedCount, 'files');
      
      // Load manifest
      const manifestPath = path.join(tempDir, 'manifest.json');
      console.log('[ContentLoader] Loading manifest from:', manifestPath);
      
      const manifestExists = await fs.access(manifestPath).then(() => true).catch(() => false);
      if (!manifestExists) {
        throw new Error('manifest.json not found in ZIP package');
      }
      
      const manifest = await this.loadManifest(manifestPath);
      console.log('[ContentLoader] Manifest loaded, duration:', manifest.duration_ms, 'ms');
      
      // Don't update paths again - loadManifest already does this
      // The paths are already updated to be absolute in loadManifest
      
      this.currentPackagePath = zipPath;
      this.extractedPath = tempDir;
      
      console.log('[ContentLoader] ZIP package loaded successfully');
      return manifest;
    } catch (error) {
      console.error('[ContentLoader] Error loading ZIP package:', error);
      throw error;
    }
  }

  async loadManifest(manifestPath: string): Promise<Manifest> {
    console.log('[ContentLoader] Loading manifest:', manifestPath);
    
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as Manifest;
    
    console.log('[ContentLoader] Manifest parsed, tracks:', manifest.tracks.length);
    
    // Validate manifest structure
    this.validateManifest(manifest);
    
    // Update paths to be absolute
    const basePath = path.dirname(manifestPath);
    console.log('[ContentLoader] Base path for files:', basePath);
    this.updateManifestPaths(manifest, basePath);
    
    return manifest;
  }

  private validateManifest(manifest: Manifest): void {
    if (!manifest.version) {
      throw new Error('Manifest missing version');
    }
    
    if (!manifest.duration_ms || manifest.duration_ms <= 0) {
      throw new Error('Invalid duration_ms in manifest');
    }
    
    if (!manifest.tracks || !Array.isArray(manifest.tracks)) {
      throw new Error('Manifest missing tracks array');
    }
    
    for (const track of manifest.tracks) {
      if (!track.id || !track.type || !track.items) {
        throw new Error(`Invalid track structure: ${track.id}`);
      }
      
      for (const item of track.items) {
        if (!item.id || !item.file || item.start_ms === undefined) {
          throw new Error(`Invalid item in track ${track.id}: ${item.id}`);
        }
      }
    }
  }

  private updateManifestPaths(manifest: Manifest, basePath: string): void {
    console.log('[ContentLoader] Updating manifest paths with base:', basePath);
    
    for (const track of manifest.tracks) {
      console.log(`[ContentLoader] Processing track: ${track.type} with ${track.items.length} items`);
      
      for (const item of track.items) {
        if (!path.isAbsolute(item.file)) {
          const originalPath = item.file;
          // Use path.resolve to get the absolute path correctly
          item.file = path.resolve(basePath, item.file);
          
          // Check if file exists
          const exists = fsSync.existsSync(item.file);
          console.log(`[ContentLoader] Updated path: ${originalPath} -> ${item.file} (exists: ${exists})`);
          
          if (!exists) {
            console.error(`[ContentLoader] WARNING: File does not exist: ${item.file}`);
          }
        }
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.extractedPath) {
      try {
        await fs.rm(this.extractedPath, { recursive: true, force: true });
      } catch (error) {
        console.error('Failed to cleanup extracted content:', error);
      }
      this.extractedPath = null;
    }
  }
}