// Type definitions for the CBT Multimedia Sync application

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

export interface TrackManager {
  load(items: TrackItem[], basePath?: string): Promise<void>;
  sync(masterTime: number, playbackRate: number): void;
  play(): void;
  pause(): void;
  seek(timeMs: number): void;
  setPlaybackRate(rate: number): void;
  getCurrentItem(): TrackItem | null;
  getElement(): HTMLElement | null;
  destroy(): void;
}

export interface SyncMetrics {
  drift: number;
  corrections: number;
  averageDrift: number;
  maxDrift: number;
}

// Electron API exposed to renderer
declare global {
  interface Window {
    electronAPI: {
      openContentPackage: () => Promise<{
        success: boolean;
        manifest?: Manifest;
        basePath?: string;
        error?: string;
      }>;
      loadLocalManifest: (manifestPath: string) => Promise<{
        success: boolean;
        manifest?: Manifest;
        basePath?: string;
        error?: string;
      }>;
      getFileUrl: (filePath: string) => Promise<string>;
      getVideoUrl: (filePath: string) => Promise<string>;
      getAudioUrl: (filePath: string) => Promise<string>;
    };
  }
}