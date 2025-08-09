import videojs from 'video.js';
import Player from 'video.js/dist/types/player';
import { TrackItem, TrackManager, SyncMetrics } from '../../types/index';
import { masterClock } from '../services/MasterClock';
import { findItemAtTime, calculateItemRelativeTime, debugTimeCalculation } from '../utils/timeUtils';
import 'video.js/dist/video-js.css';

interface VideoJsSource {
  src: string;
  type: string;
}

export class VideoJsManager implements TrackManager {
  private items: TrackItem[] = [];
  private currentItemIndex: number = -1;
  private player: Player | null = null;
  private containerElement: HTMLDivElement | null = null;
  private basePath: string = '';
  
  // Sync metrics
  private syncMetrics: SyncMetrics = {
    drift: 0,
    corrections: 0,
    averageDrift: 0,
    maxDrift: 0,
  };
  
  private driftHistory: number[] = [];
  private readonly MAX_DRIFT_HISTORY = 100;
  private readonly SYNC_TOLERANCE = 200; // Increased tolerance to reduce corrections (ms)
  
  // State management
  private isTransitioning: boolean = false;
  private isSeeking: boolean = false;
  private pendingSeek: number | null = null;
  private lastSyncTime: number = 0;
  private loadingPromise: Promise<void> | null = null;
  private seekQueue: Promise<void> = Promise.resolve();
  private playPromise: Promise<void> | null = null;
  private lastSeekTime: number = 0;
  
  // Video.js specific
  private playlist: Array<{ sources: VideoJsSource[], item: TrackItem }> = [];
  private playlistIndex: number = -1;
  
  constructor(container?: HTMLElement) {
    if (container) {
      this.initializeContainer(container);
    }
    
    // Register with MasterClock for coordination
    masterClock.registerManager(this);
  }
  
  private initializeContainer(container: HTMLElement): void {
    // console.log('[VideoJsManager] Initializing container');
    
    // Remove any existing container
    const existing = container.querySelector('.videojs-manager-container');
    if (existing) {
      existing.remove();
    }
    
    // Create new container
    this.containerElement = document.createElement('div');
    this.containerElement.className = 'videojs-manager-container';
    this.containerElement.style.cssText = `
      width: 100%;
      height: 100%;
      background: #000;
      position: relative;
      display: block;
    `;
    container.appendChild(this.containerElement);
    
    // Create video element for Video.js
    const videoElement = document.createElement('video');
    videoElement.id = 'videojs-player';
    videoElement.className = 'video-js vjs-default-skin vjs-big-play-centered vjs-fluid';
    videoElement.setAttribute('preload', 'auto');
    
    this.containerElement.appendChild(videoElement);
    
    // Initialize Video.js player
    this.initializePlayer(videoElement);
  }
  
  private initializePlayer(videoElement: HTMLVideoElement): void {
    // console.log('[VideoJsManager] Initializing Video.js player');
    
    // Video.js options
    const options = {
      controls: false, // We'll use our custom controls
      autoplay: false,
      preload: 'auto',
      fluid: true,
      responsive: true,
      playbackRates: [0.5, 1, 1.5, 2],
      html5: {
        vhs: {
          withCredentials: false,
          overrideNative: true,
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false,
      },
    };
    
    // Create Video.js player
    this.player = videojs(videoElement, options, () => {
      // console.log('[VideoJsManager] Video.js player ready');
      this.setupEventListeners();
    });
    
    // Override default error display
    const errorDisplay = (this.player as any).errorDisplay;
    if (errorDisplay && errorDisplay.hide) {
      errorDisplay.hide();
    }
  }
  
  private async initializePlayerAsync(videoElement: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
      // console.log('[VideoJsManager] Initializing Video.js player (async)');
      
      // Video.js options with optimized settings for video switching
      const options = {
        controls: false,
        autoplay: false,
        preload: 'metadata', // Changed from 'auto' to reduce memory usage
        fluid: true,
        responsive: true,
        playbackRates: [0.5, 1, 1.5, 2],
        html5: {
          vhs: {
            withCredentials: false,
            overrideNative: true,
          },
          nativeVideoTracks: false,
          nativeAudioTracks: false,
          nativeTextTracks: false,
          // Add settings to prevent decode errors
          hls: {
            overrideNative: true,
            smoothQualityChange: true,
            fastQualityChange: true,
          },
        },
        // Add error recovery options
        techOrder: ['html5'],
        sources: [],
      };
      
      // Create Video.js player with ready callback
      this.player = videojs(videoElement, options, () => {
        // console.log('[VideoJsManager] Video.js player ready (async)');
        this.setupEventListeners();
        
        // Override default error display
        const errorDisplay = (this.player as any).errorDisplay;
        if (errorDisplay && errorDisplay.hide) {
          errorDisplay.hide();
        }
        
        resolve();
      });
      
      // Add timeout in case ready never fires
      setTimeout(() => {
        if (this.player) {
          // console.log('[VideoJsManager] Player initialization timeout - proceeding');
          resolve();
        }
      }, 2000);
    });
  }
  
  private setupEventListeners(): void {
    if (!this.player) return;
    
    // Playback events
    this.player.on('play', () => {
      // console.log('[VideoJsManager] Play event');
      this.updateMasterClock(true);
    });
    
    this.player.on('pause', () => {
      // console.log('[VideoJsManager] Pause event');
      if (!this.isSeeking && !this.isTransitioning) {
        this.updateMasterClock(false);
      }
    });
    
    this.player.on('timeupdate', () => {
      // Only update master clock if we're not seeking or transitioning
      if (this.currentItemIndex >= 0 && !this.isSeeking && !this.isTransitioning) {
        const item = this.items[this.currentItemIndex];
        if (item) {
          const currentVideoTime = this.player?.currentTime() ?? 0;
          const masterTime = currentVideoTime * 1000 + item.start_ms;
          const isPlaying = !this.player!.paused();
          
          // Validate that the time makes sense for this item
          const itemEndTime = item.end_ms || (item.start_ms + (item.duration_ms || 0));
          
          // Only update if video time seems reasonable (not a reset or error state)
          if (currentVideoTime >= 0 && 
              masterTime >= item.start_ms && 
              masterTime <= itemEndTime + 1000 && // Allow 1 second buffer
              !this.player?.error()) { // Don't update during error state
            masterClock.updateTimeFromVideo(masterTime, isPlaying);
          }
          
          // Check for video end to transition
          const duration = this.player?.duration() ?? 0;
          if (duration && currentVideoTime >= duration - 0.1) {
            this.checkForNextVideo();
          }
        }
      }
    });
    
    this.player.on('ended', () => {
      // console.log('[VideoJsManager] Video ended');
      this.transitionToNextVideo();
    });
    
    this.player.on('loadedmetadata', () => {
      // console.log('[VideoJsManager] Metadata loaded, duration:', this.player!.duration());
      this.ensureVisible();
    });
    
    this.player.on('waiting', () => {
      // console.log('[VideoJsManager] Buffering...');
    });
    
    this.player.on('canplay', () => {
      // console.log('[VideoJsManager] Can play');
    });
    
    this.player.on('error', (error: any) => {
      const videoError = this.player?.error();
      let errorCode = 'UNKNOWN';
      if (videoError) {
        switch(videoError.code) {
          case 1: errorCode = 'MEDIA_ERR_ABORTED'; break;
          case 2: errorCode = 'MEDIA_ERR_NETWORK'; break;
          case 3: errorCode = 'MEDIA_ERR_DECODE'; break;
          case 4: errorCode = 'MEDIA_ERR_SRC_NOT_SUPPORTED'; break;
        }
      }
      console.error('[VideoJsManager] Player error:', errorCode, error);
      
      // With the disposal strategy, MEDIA_ERR_DECODE should be much rarer
      // Only log and clear errors during transitions/seeks
      if (videoError?.code === 3) {
        if (this.isTransitioning || this.isSeeking) {
          // console.log('[VideoJsManager] MEDIA_ERR_DECODE during transition/seek - clearing');
          (this.player as any).error(null);
          return;
        }
        
        // For other cases, just log - recovery will happen on next video switch
        console.warn('[VideoJsManager] MEDIA_ERR_DECODE detected - will be resolved on next video switch');
        (this.player as any).error(null);
      }
    });
    
    // Seeking events
    this.player.on('seeking', () => {
      // console.log('[VideoJsManager] Seeking...');
    });
    
    this.player.on('seeked', () => {
      // console.log('[VideoJsManager] Seeked');
      if (this.isSeeking) {
        this.isSeeking = false;
      }
    });
  }
  
  private updateMasterClock(isPlaying: boolean): void {
    if (!this.player || this.currentItemIndex < 0) return;
    
    const item = this.items[this.currentItemIndex];
    if (item) {
      const masterTime = ((this.player?.currentTime() ?? 0) * 1000) + item.start_ms;
      masterClock.updateTimeFromVideo(masterTime, isPlaying);
    }
  }
  
  private ensureVisible(): void {
    if (this.containerElement) {
      this.containerElement.style.display = 'block';
      this.containerElement.style.visibility = 'visible';
      this.containerElement.style.opacity = '1';
    }
    
    if (this.player) {
      const el = this.player.el() as HTMLElement;
      if (el) {
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
      }
    }
  }
  
  async load(items: TrackItem[], basePath: string = ''): Promise<void> {
    // console.log('[VideoJsManager] Loading items:', items.length);
    
    this.items = items;
    this.basePath = basePath;
    
    // Build playlist
    this.playlist = [];
    for (const item of items) {
      const videoUrl = await this.getVideoUrl(item.file);
      this.playlist.push({
        sources: [{
          src: videoUrl,
          type: this.getVideoType(item.file),
        }],
        item: item,
      });
    }
    
    // console.log('[VideoJsManager] Playlist built with', this.playlist.length, 'items');
    
    // Load first video if available
    if (this.playlist.length > 0) {
      await this.loadVideoAtIndex(0);
    }
    
    this.ensureVisible();
  }
  
  private getVideoType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'ogg':
      case 'ogv':
        return 'video/ogg';
      case 'm3u8':
        return 'application/x-mpegURL';
      default:
        return 'video/mp4';
    }
  }
  
  private async loadVideoAtIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.playlist.length) {
      // console.log('[VideoJsManager] Invalid index:', index);
      return;
    }
    
    const playlistItem = this.playlist[index];
    
    // FUNDAMENTAL SOLUTION: Dispose and recreate player for different video files
    // This prevents MEDIA_ERR_DECODE when switching between videos
    if (this.currentItemIndex !== index && this.currentItemIndex >= 0) {
      // console.log('[VideoJsManager] Different video detected - disposing and recreating player');
      
      // Cancel any pending play promise
      this.playPromise = null;
      
      // Store state before disposal
      const wasPlaying = this.player ? !this.player.paused() : false;
      
      // Completely dispose the current player
      if (this.player) {
        try {
          this.player.pause();
          this.player.dispose();
          // console.log('[VideoJsManager] Player disposed successfully');
        } catch (err) {
          console.warn('[VideoJsManager] Error during player disposal:', err);
        }
        this.player = null;
      }
      
      // Remove old video element
      const oldVideo = document.getElementById('videojs-player');
      if (oldVideo) {
        oldVideo.remove();
      }
      
      // Wait for browser cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create new video element
      const videoElement = document.createElement('video');
      videoElement.id = 'videojs-player';
      videoElement.className = 'video-js vjs-default-skin vjs-big-play-centered vjs-fluid';
      videoElement.setAttribute('preload', 'auto');
      
      if (this.containerElement) {
        this.containerElement.appendChild(videoElement);
      } else {
        console.error('[VideoJsManager] No container element available');
        return;
      }
      
      // Initialize new Video.js player
      await this.initializePlayerAsync(videoElement);
      
      if (!this.player) {
        console.error('[VideoJsManager] Failed to create new player');
        return;
      }
      
      // Store playing state for restoration
      (this as any).wasPlayingBeforeSwitch = wasPlaying;
    }
    
    // Check if we have a valid player
    if (!this.player) {
      // console.log('[VideoJsManager] No player available, creating one');
      const videoElement = document.createElement('video');
      videoElement.id = 'videojs-player';
      videoElement.className = 'video-js vjs-default-skin vjs-big-play-centered vjs-fluid';
      videoElement.setAttribute('preload', 'auto');
      
      if (this.containerElement) {
        this.containerElement.appendChild(videoElement);
        await this.initializePlayerAsync(videoElement);
      }
      
      if (!this.player) {
        console.error('[VideoJsManager] Failed to create player');
        return;
      }
    }
    
    // console.log('[VideoJsManager] Loading video at index:', index);
    this.isTransitioning = true;
    
    // Check if video is already loaded (for same index)
    if (this.currentItemIndex === index) {
      const currentSrc = this.player.src(undefined as any);
      const expectedSrc = playlistItem.sources[0]?.src;
      const readyState = this.player.readyState();
      
      if (currentSrc === expectedSrc && readyState && readyState >= 2 && !this.player.error()) {
        // console.log('[VideoJsManager] Video already loaded at index:', index);
        this.isTransitioning = false;
        this.ensureVisible();
        return;
      }
    }
    
    this.currentItemIndex = index;
    this.playlistIndex = index;
    
    return new Promise(async (resolve, reject) => {
      if (!this.player) {
        reject(new Error('No player'));
        return;
      }
      
      // Check if we should restore playing state from before disposal
      const wasPlaying = (this as any).wasPlayingBeforeSwitch || masterClock.getState().isPlaying;
      delete (this as any).wasPlayingBeforeSwitch;
      
      // Load new source
      this.player.src(playlistItem.sources);
      
      // Wait for loadedmetadata event
      let loadTimeout: NodeJS.Timeout | null = null;
      
      const onLoaded = () => {
        // console.log('[VideoJsManager] Video loaded successfully');
        if (loadTimeout) clearTimeout(loadTimeout);
        this.isTransitioning = false;
        this.ensureVisible();
        
        // Restore playing state with proper promise handling
        setTimeout(() => {
          if (wasPlaying && this.player) {
            this.playPromise = null;
            
            const promise = this.player.play();
            if (promise !== undefined) {
              this.playPromise = promise;
              promise.then(() => {
                this.playPromise = null;
              }).catch(e => {
                if (this.playPromise === promise) {
                  // console.log('[VideoJsManager] Play after load interrupted:', e instanceof Error ? e.message : String(e));
                }
                this.playPromise = null;
              });
            }
          }
        }, 100);
        
        this.player?.off('loadedmetadata', onLoaded);
        this.player?.off('error', onError);
        resolve();
      };
      
      const onError = (e: any) => {
        console.error('[VideoJsManager] Load error:', e);
        if (loadTimeout) clearTimeout(loadTimeout);
        this.isTransitioning = false;
        this.player?.off('loadedmetadata', onLoaded);
        this.player?.off('error', onError);
        
        // Since we're using fresh players, errors are less recoverable
        reject(new Error(`Failed to load video at index ${index}: ${e?.message || 'Unknown error'}`));
      };
      
      // Set up timeout
      loadTimeout = setTimeout(() => {
        console.warn('[VideoJsManager] Video load timeout');
        this.player?.off('loadedmetadata', onLoaded);
        this.player?.off('error', onError);
        this.isTransitioning = false;
        resolve(); // Resolve instead of reject to continue
      }, 5000); // Reduced timeout since we have fresh player
      
      this.player.one('loadedmetadata', onLoaded);
      this.player.one('error', onError);
      
      // Load the video
      this.player.load();
    });
  }
  
  private async getVideoUrl(filePath: string): Promise<string> {
    if (filePath.startsWith('http://') || 
        filePath.startsWith('https://') || 
        filePath.startsWith('content://')) {
      return filePath;
    }
    
    if (window.electronAPI && window.electronAPI.getVideoUrl) {
      // Use content:// protocol with byte-range support for video streaming
      return await window.electronAPI.getVideoUrl(filePath);
    } else if (window.electronAPI) {
      // Fallback to generic file URL
      return await window.electronAPI.getFileUrl(filePath);
    }
    
    return `file:///${filePath.replace(/\\/g, '/')}`;
  }
  
  private checkForNextVideo(): void {
    const nextIndex = this.currentItemIndex + 1;
    if (nextIndex < this.items.length) {
      // console.log('[VideoJsManager] Next video available at index:', nextIndex);
    }
  }
  
  private async transitionToNextVideo(): Promise<void> {
    const nextIndex = this.currentItemIndex + 1;
    if (nextIndex < this.playlist.length) {
      // console.log('[VideoJsManager] Transitioning to next video:', nextIndex);
      await this.loadVideoAtIndex(nextIndex);
      
      // Continue playing
      if (masterClock.getState().isPlaying) {
        this.player?.play()?.catch(e => {
          console.error('[VideoJsManager] Failed to play next video:', e);
        });
      }
    }
  }
  
  sync(masterTime: number, playbackRate: number): void {
    if (!this.player || this.isTransitioning) return;
    
    // Find target video using unified time calculation
    const targetItem = findItemAtTime(this.items, masterTime);
    
    if (process.env.NODE_ENV === 'development') {
      debugTimeCalculation('VideoJsManager', this.items, masterTime, targetItem);
    }
    if (!targetItem) {
      if (masterTime > 0 && this.items.length > 0) {
        const lastItem = this.items[this.items.length - 1];
        const lastEndTime = lastItem.end_ms || (lastItem.start_ms + (lastItem.duration_ms || 0));
        if (masterTime > lastEndTime && !this.player.paused()) {
          this.player.pause();
        }
      }
      return;
    }
    
    const targetIndex = this.items.indexOf(targetItem);
    
    // Switch videos if needed
    if (targetIndex !== this.currentItemIndex && targetIndex >= 0) {
      if (!this.loadingPromise) {
        // console.log('[VideoJsManager] Switching to video:', targetIndex);
        this.loadingPromise = this.loadVideoAtIndex(targetIndex).then(() => {
          this.loadingPromise = null;
          
          // Sync position after loading using unified calculation
          if (this.player && targetItem) {
            const videoTime = calculateItemRelativeTime(targetItem, masterClock.getState().currentTime);
            const clampedTime = Math.max(0, Math.min(videoTime, this.player.duration() || videoTime));
            this.player.currentTime(clampedTime);
          }
        }).catch(err => {
          console.error('[VideoJsManager] Failed to switch video:', err);
          this.loadingPromise = null;
        });
      }
      return;
    }
    
    // Sync current video
    if (this.currentItemIndex >= 0 && targetItem === this.items[this.currentItemIndex]) {
      this.syncCurrentVideo(masterTime, playbackRate, targetItem);
    }
  }
  
  private syncCurrentVideo(masterTime: number, playbackRate: number, item: TrackItem): void {
    if (!this.player || this.isSeeking) return;
    
    // Use unified time calculation
    const videoTime = calculateItemRelativeTime(item, masterTime);
    const videoDuration = item.duration_ms ? item.duration_ms / 1000 : this.player.duration();
    
    if (videoTime < 0 || (videoDuration && videoTime > videoDuration + 0.5)) {
      return;
    }
    
    const currentVideoTime = this.player.currentTime() ?? 0;
    const drift = Math.abs(currentVideoTime - videoTime) * 1000;
    
    this.updateSyncMetrics(drift);
    
    // Apply sync correction only if drift is significant and we're not already seeking
    if (drift > this.SYNC_TOLERANCE && !this.isSeeking) {
      const now = Date.now();
      // Throttle corrections to prevent seek loops
      if (now - this.lastSyncTime > 2000) { // Increased to 2 seconds
        const targetTime = Math.max(0, Math.min(videoTime, videoDuration || videoTime));
        
        // Only update if the difference is really significant
        if (Math.abs(currentVideoTime - targetTime) > 0.5) { // 500ms threshold
          // console.log('[VideoJsManager] Sync correction:', currentVideoTime.toFixed(2), '->', targetTime.toFixed(2));
          
          // Mark as seeking to prevent sync during seek
          this.isSeeking = true;
          this.player.currentTime(targetTime);
          
          // Reset seeking flag after a delay
          setTimeout(() => {
            this.isSeeking = false;
          }, 500);
          
          this.lastSyncTime = now;
          this.syncMetrics.corrections++;
        }
      }
    }
    
    // Update playback rate
    if (Math.abs((this.player.playbackRate() ?? 1) - playbackRate) > 0.01) {
      this.player.playbackRate(playbackRate);
    }
    
    // Ensure playing state
    if (this.player.paused() && videoTime >= 0 && (!videoDuration || videoTime < videoDuration)) {
      this.ensureVisible();
      this.player.play()?.catch(e => {
        console.error('[VideoJsManager] Failed to play:', e);
      });
    }
  }
  
  // Removed: Using unified findItemAtTime from timeUtils instead
  
  private updateSyncMetrics(drift: number): void {
    this.syncMetrics.drift = drift;
    this.driftHistory.push(drift);
    
    if (this.driftHistory.length > this.MAX_DRIFT_HISTORY) {
      this.driftHistory.shift();
    }
    
    const sum = this.driftHistory.reduce((a, b) => a + b, 0);
    this.syncMetrics.averageDrift = sum / this.driftHistory.length;
    this.syncMetrics.maxDrift = Math.max(this.syncMetrics.maxDrift, drift);
  }
  
  play(): void {
    if (!this.player || !this.player.paused()) return;
    
    // Cancel any pending play promise
    this.playPromise = null;
    
    this.ensureVisible();
    
    // Handle play promise properly
    const promise = this.player.play();
    if (promise !== undefined) {
      this.playPromise = promise;
      promise.then(() => {
        // console.log('[VideoJsManager] Playback started successfully');
        this.playPromise = null;
      }).catch(e => {
        // Only log if this is still the current play promise
        if (this.playPromise === promise) {
          // console.log('[VideoJsManager] Play interrupted or failed:', e instanceof Error ? e.message : String(e));
        }
        this.playPromise = null;
      });
    }
  }
  
  pause(): void {
    if (!this.player) return;
    
    // Wait for any pending play promise before pausing
    if (this.playPromise) {
      this.playPromise.then(() => {
        this.player?.pause();
      }).catch(() => {
        // Play failed, safe to pause
        this.player?.pause();
      });
    } else {
      this.player.pause();
    }
  }
  
  async seek(timeMs: number): Promise<void> {
    // console.log('[VideoJsManager] Coordinated seek to:', timeMs, 'ms');
    
    // Queue seeks to prevent overlapping operations
    this.seekQueue = this.seekQueue.then(async () => {
      await this.performSeek(timeMs);
    }).catch(error => {
      console.error('[VideoJsManager] Seek queue error:', error);
      throw error;
    });
    
    return this.seekQueue;
  }
  
  private async performSeek(timeMs: number): Promise<void> {
    // Prevent duplicate seeks to same time
    const now = Date.now();
    if (Math.abs(timeMs - this.lastSeekTime) < 1 && (now - this.lastSyncTime) < 100) {
      // console.log('[VideoJsManager] Ignoring duplicate seek to:', timeMs);
      return;
    }
    
    this.lastSeekTime = timeMs;
    this.lastSyncTime = now;
    
    // Set seeking flag to prevent sync conflicts
    this.isSeeking = true;
    
    // Cancel any pending play promise during seek
    if (this.playPromise) {
      this.playPromise = null;
    }
    
    // Clear any existing errors before seeking
    if (this.player && (this.player as any).error()) {
      // console.log('[VideoJsManager] Clearing error before seek');
      (this.player as any).error(null);
    }
    
    try {
      // Find the correct item for this time
      const targetItem = findItemAtTime(this.items, timeMs);
      
      if (process.env.NODE_ENV === 'development') {
        debugTimeCalculation('VideoJsManager', this.items, timeMs, targetItem);
      }
      
      if (!targetItem) {
        // console.log('[VideoJsManager] No video item for time:', timeMs);
        // Pause if no video should be playing
        if (this.player && !this.player.paused()) {
          this.player.pause();
        }
        this.isSeeking = false;
        return;
      }
      
      const targetIndex = this.items.indexOf(targetItem);
      const shouldBePlaying = masterClock.getState().isPlaying;
      
      // Check if we need to load a different video
      // With disposal strategy, we always load when switching videos
      const needsLoad = targetIndex !== this.currentItemIndex || !this.player;
      
      if (needsLoad) {
        // console.log('[VideoJsManager] Loading video at index:', targetIndex, 'current:', this.currentItemIndex);
        await this.loadVideoAtIndex(targetIndex);
      }
      
      // Ensure player is ready
      if (!this.player) {
        console.warn('[VideoJsManager] No player available after load');
        this.isSeeking = false;
        return;
      }
      
      // Wait for minimum readiness
      let waitAttempts = 0;
      while ((this.player.readyState() ?? 0) < 2 && waitAttempts < 30) { // Increased attempts
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced wait time
        waitAttempts++;
      }
      
      if ((this.player.readyState() ?? 0) < 2) {
        console.warn('[VideoJsManager] Player not ready after waiting, proceeding anyway');
      }
      
      // Calculate precise time within this video
      const videoTime = calculateItemRelativeTime(targetItem, timeMs);
      const videoDuration = this.player.duration() || Infinity;
      const targetTime = Math.max(0, Math.min(videoTime, videoDuration));
      
      // Only seek if time difference is significant (>100ms)
      const currentTime = this.player.currentTime() ?? 0;
      const timeDiff = Math.abs(currentTime - targetTime);
      
      if (timeDiff > 0.1) {
        // console.log('[VideoJsManager] Seeking video from', currentTime, 'to', targetTime, 'seconds');
        
        // Clear any error state before seeking
        if ((this.player as any).error()) {
          (this.player as any).error(null);
        }
        
        // Don't pause if we're already at the correct position
        // This prevents play interruption when minor adjustments are made
        const wasPlaying = !this.player.paused();
        
        this.player.currentTime(targetTime);
        
        // Wait for seek to complete with error handling
        await new Promise<void>((resolve) => {
          let seekCompleted = false;
          
          const onSeeked = () => {
            if (!seekCompleted) {
              seekCompleted = true;
              this.player?.off('seeked', onSeeked);
              this.player?.off('error', onError);
              clearTimeout(timeout);
              resolve();
            }
          };
          
          const onError = () => {
            if (!seekCompleted) {
              seekCompleted = true;
              console.warn('[VideoJsManager] Error during seek, continuing');
              this.player?.off('seeked', onSeeked);
              this.player?.off('error', onError);
              clearTimeout(timeout);
              resolve();
            }
          };
          
          // Set timeout to prevent infinite wait
          const timeout = setTimeout(() => {
            if (!seekCompleted) {
              seekCompleted = true;
              this.player?.off('seeked', onSeeked);
              this.player?.off('error', onError);
              console.warn('[VideoJsManager] Seek event timeout, continuing');
              resolve();
            }
          }, 2000); // Increased timeout for backward seeks
          
          this.player?.one('seeked', onSeeked);
          this.player?.one('error', onError);
        });
        
        // Resume playing if needed, but handle play promise properly
        if (wasPlaying && shouldBePlaying) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Cancel any existing play promise
          this.playPromise = null;
          
          const promise = this.player.play();
          if (promise !== undefined) {
            this.playPromise = promise;
            try {
              await promise;
              this.playPromise = null;
            } catch (err) {
              if (this.playPromise === promise) {
                // console.log('[VideoJsManager] Resume after seek interrupted:', err instanceof Error ? err.message : String(err));
              }
              this.playPromise = null;
            }
          }
        }
      }
      
      // Ensure visibility
      this.ensureVisible();
      
      // Restore playing state with a small delay for stability
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (shouldBePlaying && this.player.paused()) {
        try {
          await this.player.play();
          // console.log('[VideoJsManager] Playback resumed after seek');
        } catch (playErr) {
          console.warn('[VideoJsManager] Failed to resume playback:', playErr);
        }
      } else if (!shouldBePlaying && !this.player.paused()) {
        this.player.pause();
        // console.log('[VideoJsManager] Playback paused after seek');
      }
      
      // console.log('[VideoJsManager] Seek completed successfully to', timeMs, 'ms');
      
    } catch (error) {
      console.error('[VideoJsManager] Seek failed:', error);
      throw error; // Re-throw for MasterClock coordination
    } finally {
      // Always clear seeking flag
      this.isSeeking = false;
    }
  }
  
  setPlaybackRate(rate: number): void {
    this.player?.playbackRate(rate);
  }
  
  getCurrentItem(): TrackItem | null {
    if (this.currentItemIndex >= 0 && this.currentItemIndex < this.items.length) {
      return this.items[this.currentItemIndex];
    }
    return null;
  }
  
  getElement(): HTMLElement | null {
    return this.containerElement;
  }
  
  getSyncMetrics(): SyncMetrics {
    return { ...this.syncMetrics };
  }
  
  destroy(): void {
    // console.log('[VideoJsManager] Destroying player');
    
    // Unregister from MasterClock
    masterClock.unregisterManager(this);
    
    // Cancel any pending operations
    this.playPromise = null;
    this.loadingPromise = null;
    this.seekQueue = Promise.resolve();
    
    if (this.player) {
      try {
        // Ensure player is paused before disposal
        if (!this.player.paused()) {
          this.player.pause();
        }
        // Clear any errors
        if ((this.player as any).error()) {
          (this.player as any).error(null);
        }
        this.player.dispose();
      } catch (err) {
        console.warn('[VideoJsManager] Error during player disposal:', err);
      }
      this.player = null;
    }
    
    // Remove all video elements to ensure cleanup
    const videoElements = this.containerElement?.querySelectorAll('video');
    videoElements?.forEach(video => video.remove());
    
    if (this.containerElement) {
      this.containerElement.remove();
      this.containerElement = null;
    }
    
    this.items = [];
    this.playlist = [];
    this.currentItemIndex = -1;
    this.playlistIndex = -1;
    this.driftHistory = [];
    this.isTransitioning = false;
    this.isSeeking = false;
  }
  
  
  // Additional Video.js specific methods
  
  getPlayer(): Player | null {
    return this.player;
  }
  
  setVolume(volume: number): void {
    if (this.player) {
      this.player.volume(Math.max(0, Math.min(1, volume)));
    }
  }
  
  getVolume(): number {
    return this.player?.volume() || 0;
  }
  
  toggleMute(): void {
    if (this.player) {
      this.player.muted(!this.player.muted());
    }
  }
  
  isMuted(): boolean {
    return this.player?.muted() || false;
  }
  
  getDuration(): number {
    if (!this.player || this.currentItemIndex < 0) return 0;
    
    const item = this.items[this.currentItemIndex];
    if (item?.duration_ms) {
      return item.duration_ms / 1000;
    }
    
    return this.player.duration() || 0;
  }
  
  getCurrentTime(): number {
    return this.player?.currentTime() || 0;
  }
  
  isReady(): boolean {
    return (this.player?.readyState() ?? 0) >= 2;
  }
  
  getBufferedPercent(): number {
    if (!this.player) return 0;
    
    const buffered = this.player.buffered();
    const duration = this.player.duration();
    
    if (!duration || buffered.length === 0) return 0;
    
    const bufferedEnd = buffered.end?.(buffered.length - 1) ?? 0;
    return (bufferedEnd / duration) * 100;
  }
}