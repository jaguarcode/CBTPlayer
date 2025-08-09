/**
 * MasterClock Service
 * Central timing controller for all media synchronization
 */

export type ClockEventType = 'play' | 'pause' | 'seek' | 'ratechange' | 'timeupdate' | 'ended' | 'sync';

export interface ClockEvent {
  type: ClockEventType;
  time: number;
  playbackRate: number;
  isPlaying: boolean;
}

export type ClockListener = (event: ClockEvent) => void;

export class MasterClock {
  private currentTime: number = 0; // Current position in ms
  private duration: number = 0; // Total duration in ms
  private playbackRate: number = 1.0;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private lastUpdateTime: number = 0;
  private animationFrameId: number | null = null;
  private listeners: Set<ClockListener> = new Set();
  private syncInterval: number | null = null;
  
  // Performance monitoring
  private frameCount: number = 0;
  private lastFpsTime: number = 0;
  private currentFps: number = 0;
  
  // Video-driven sync mode
  private useVideoSync: boolean = true;
  private lastVideoUpdateTime: number = 0;
  
  // Manager coordination
  private managers: Set<any> = new Set();
  private isSeeking: boolean = false;
  private lastSeekTime: number = 0;
  private lastSeekTimestamp: number = 0;
  private seekPromise: Promise<void> | null = null;
  
  constructor() {
    this.update = this.update.bind(this);
  }
  
  /**
   * Register a manager for direct coordination
   */
  registerManager(manager: any): void {
    this.managers.add(manager);
    console.log('[MasterClock] Manager registered, total:', this.managers.size);
  }
  
  /**
   * Unregister a manager
   */
  unregisterManager(manager: any): void {
    this.managers.delete(manager);
    console.log('[MasterClock] Manager unregistered, total:', this.managers.size);
  }
  
  /**
   * Initialize the clock with a specific duration
   */
  initialize(durationMs: number): void {
    console.log('[MasterClock] Initializing with duration:', durationMs, 'ms');
    
    this.duration = durationMs;
    this.currentTime = 0;
    this.isPlaying = false;
    this.playbackRate = 1.0;
    
    // Don't call stop() here as it might cause issues
    this.stopUpdateLoop();
    
    console.log('[MasterClock] Initialized successfully');
  }
  
  /**
   * Start playback
   */
  play(): void {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.startTime = performance.now() - (this.currentTime / this.playbackRate);
    this.lastUpdateTime = performance.now();
    
    this.emit({
      type: 'play',
      time: this.currentTime,
      playbackRate: this.playbackRate,
      isPlaying: true,
    });
    
    this.startUpdateLoop();
    this.startSyncInterval();
  }
  
  /**
   * Pause playback
   */
  pause(): void {
    console.log('[MasterClock] pause() called, isPlaying:', this.isPlaying);
    if (!this.isPlaying) {
      console.log('[MasterClock] Already paused, returning');
      return;
    }
    
    this.isPlaying = false;
    this.stopUpdateLoop();
    this.stopSyncInterval();
    
    console.log('[MasterClock] Emitting pause event');
    this.emit({
      type: 'pause',
      time: this.currentTime,
      playbackRate: this.playbackRate,
      isPlaying: false,
    });
  }
  
  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.pause();
    this.seek(0);
  }
  
  /**
   * Seek to specific time with coordinated manager sync
   */
  async seek(timeMs: number): Promise<void> {
    const clampedTime = Math.max(0, Math.min(timeMs, this.duration));
    
    // Prevent duplicate seeks to same time
    const now = Date.now();
    if (Math.abs(clampedTime - this.lastSeekTime) < 1 && (now - this.lastSeekTimestamp) < 200) {
      console.log('[MasterClock] Ignoring duplicate seek to:', clampedTime);
      return this.seekPromise || Promise.resolve();
    }
    
    // If already seeking, wait for current seek to complete
    if (this.isSeeking && this.seekPromise) {
      console.log('[MasterClock] Already seeking, waiting for completion');
      return this.seekPromise;
    }
    
    this.lastSeekTime = clampedTime;
    this.lastSeekTimestamp = now;
    
    console.log('[MasterClock] Coordinated seek to:', clampedTime, 'ms');
    
    // Create and store the seek promise
    this.seekPromise = this.performSeek(clampedTime);
    return this.seekPromise;
  }
  
  private async performSeek(clampedTime: number): Promise<void> {
    this.isSeeking = true;
    this.currentTime = clampedTime;
    
    if (this.isPlaying) {
      this.startTime = performance.now() - (this.currentTime / this.playbackRate);
    }
    
    // Coordinate all managers to seek simultaneously with timeout
    const seekPromises: Promise<void>[] = [];
    const SEEK_TIMEOUT = 3000; // 3 second timeout for each manager
    
    for (const manager of this.managers) {
      if (manager && typeof manager.seek === 'function') {
        try {
          // Wrap each seek in a timeout promise
          const seekWithTimeout = new Promise<void>((resolve, reject) => {
            // Create timeout
            const timeoutId = setTimeout(() => {
              console.warn(`[MasterClock] Manager seek timeout after ${SEEK_TIMEOUT}ms:`, manager.constructor.name);
              resolve(); // Resolve instead of reject to continue with other managers
            }, SEEK_TIMEOUT);
            
            // Execute seek
            const seekPromise = manager.seek(clampedTime);
            
            if (seekPromise instanceof Promise) {
              seekPromise
                .then(() => {
                  clearTimeout(timeoutId);
                  resolve();
                })
                .catch(error => {
                  clearTimeout(timeoutId);
                  console.error(`[MasterClock] Manager ${manager.constructor.name} seek failed:`, error);
                  resolve(); // Resolve to continue with other managers
                });
            } else {
              clearTimeout(timeoutId);
              resolve();
            }
          });
          
          seekPromises.push(seekWithTimeout);
        } catch (error) {
          console.error('[MasterClock] Manager seek initiation failed:', error);
        }
      }
    }
    
    // Wait for all managers to complete their seek (with timeout)
    try {
      const results = await Promise.allSettled(seekPromises);
      
      // Log results for debugging
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        console.warn(`[MasterClock] ${failed.length} manager seeks failed`);
      } else {
        console.log('[MasterClock] All managers seek completed successfully');
      }
    } catch (error) {
      console.error('[MasterClock] Critical error during seek coordination:', error);
    }
    
    // Update time and notify listeners regardless of individual manager failures
    this.emit({
      type: 'seek',
      time: this.currentTime,
      playbackRate: this.playbackRate,
      isPlaying: this.isPlaying,
    });
    
    this.isSeeking = false;
    this.seekPromise = null;
    
    // Force a sync after seek to ensure all managers are aligned
    setTimeout(() => {
      if (!this.isSeeking) {
        this.emit({
          type: 'timeupdate',
          time: this.currentTime,
          playbackRate: this.playbackRate,
          isPlaying: this.isPlaying,
        });
      }
    }, 100);
  }
  
  /**
   * Set playback rate (0.5x, 1.0x, 1.5x, 2.0x, etc.)
   */
  setPlaybackRate(rate: number): void {
    if (rate <= 0 || rate > 4) {
      console.warn('Invalid playback rate:', rate);
      return;
    }
    
    // Calculate current position before rate change
    if (this.isPlaying) {
      const now = performance.now();
      const elapsed = now - this.startTime;
      this.currentTime = elapsed * this.playbackRate;
      this.startTime = now - (this.currentTime / rate);
    }
    
    this.playbackRate = rate;
    
    this.emit({
      type: 'ratechange',
      time: this.currentTime,
      playbackRate: this.playbackRate,
      isPlaying: this.isPlaying,
    });
  }
  
  /**
   * Update time from video element (video-driven sync)
   * This allows the video to be the master time source
   */
  updateTimeFromVideo(timeMs: number, isVideoPlaying: boolean): void {
    // Don't update during coordinated seeking to prevent conflicts
    if (this.isSeeking) {
      return;
    }
    
    // Only update if we're in video sync mode and time has changed significantly
    if (!this.useVideoSync) return;
    
    const now = performance.now();
    const timeDiff = Math.abs(this.currentTime - timeMs);
    
    // Validate time is within valid range to prevent invalid jumps
    if (timeMs < 0 || timeMs > this.duration + 1000) {
      console.warn('[MasterClock] Invalid time update rejected:', timeMs, 'ms (duration:', this.duration, 'ms)');
      return;
    }
    
    // For backward seeks or large jumps, be more permissive with updates
    const isLargeJump = timeDiff > 1000; // 1 second jump
    const isBackwardJump = timeMs < this.currentTime - 500; // Going backward by more than 500ms
    
    // Special handling for jumps to 0 (often error recovery)
    const isResetToZero = timeMs === 0 && this.currentTime > 1000;
    if (isResetToZero) {
      console.warn('[MasterClock] Unexpected reset to 0 detected, ignoring');
      return; // Ignore unexpected resets to 0
    }
    
    // Update if time difference is significant, state changed, or it's a seek operation
    if (timeDiff > 50 || this.isPlaying !== isVideoPlaying || isLargeJump || isBackwardJump) {
      // For large jumps (likely seeks), check if it's a sync correction loop
      if (isLargeJump || isBackwardJump) {
        // Ignore rapid jumps which are likely sync correction oscillations
        const timeSinceLastJump = now - ((this as any).lastJumpTime || 0);
        if (timeSinceLastJump < 1000) {
          console.warn('[MasterClock] Ignoring rapid time jump (sync loop detected):', this.currentTime.toFixed(0), '->', timeMs.toFixed(0), 'ms');
          return;
        }
        console.log('[MasterClock] Time jump detected:', this.currentTime.toFixed(0), '->', timeMs.toFixed(0), 'ms');
        (this as any).lastJumpTime = now;
      }
      
      this.currentTime = timeMs;
      
      // Update playing state to match video
      if (this.isPlaying !== isVideoPlaying) {
        this.isPlaying = isVideoPlaying;
        if (isVideoPlaying) {
          this.startTime = now - (this.currentTime / this.playbackRate);
        }
      }
      
      // For large jumps, update immediately. Otherwise, throttle updates
      const shouldUpdateImmediately = isLargeJump || isBackwardJump || (now - this.lastVideoUpdateTime > 100);
      
      if (shouldUpdateImmediately) {
        this.lastVideoUpdateTime = now;
        // Don't emit through regular emit to avoid feedback loop
        // Just update UI directly
        this.listeners.forEach(listener => {
          try {
            listener({
              type: 'timeupdate',
              time: this.currentTime,
              playbackRate: this.playbackRate,
              isPlaying: this.isPlaying,
            });
          } catch (error) {
            console.error('Error in clock listener:', error);
          }
        });
      }
    }
  }
  
  /**
   * Get current state
   */
  getState() {
    return {
      currentTime: this.currentTime,
      duration: this.duration,
      playbackRate: this.playbackRate,
      isPlaying: this.isPlaying,
      fps: this.currentFps,
    };
  }
  
  /**
   * Subscribe to clock events
   */
  subscribe(listener: ClockListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Main update loop using requestAnimationFrame
   */
  private update(): void {
    const now = performance.now();
    
    // Skip updates during seeking
    if (this.isSeeking) {
      if (this.isPlaying) {
        this.animationFrameId = requestAnimationFrame(this.update);
      }
      return;
    }
    
    if (this.isPlaying) {
      // Always calculate elapsed time for fallback
      const elapsed = (now - this.startTime) * this.playbackRate;
      
      // If NOT in video sync mode OR video hasn't updated recently, calculate time ourselves
      if (!this.useVideoSync || (now - this.lastVideoUpdateTime > 500)) {
        // Use calculated time if video isn't updating (500ms timeout for responsiveness)
        this.currentTime = Math.min(elapsed, this.duration);
        
        // Check if we've reached the end
        if (this.currentTime >= this.duration) {
          this.currentTime = this.duration;
          this.pause();
          this.emit({
            type: 'ended',
            time: this.currentTime,
            playbackRate: this.playbackRate,
            isPlaying: false,
          });
          return;
        }
      }
      
      // Emit time updates for UI updates (not for sync)
      // This ensures UI components stay updated
      if (now - this.lastUpdateTime >= 100) { // 10fps for UI updates
        this.emit({
          type: 'timeupdate',
          time: this.currentTime,
          playbackRate: this.playbackRate,
          isPlaying: this.isPlaying,
        });
        this.lastUpdateTime = now;
      }
      
      // Calculate FPS
      this.frameCount++;
      if (now - this.lastFpsTime >= 1000) {
        this.currentFps = this.frameCount;
        this.frameCount = 0;
        this.lastFpsTime = now;
      }
      
      this.animationFrameId = requestAnimationFrame(this.update);
    }
  }
  
  /**
   * Start the update loop
   */
  private startUpdateLoop(): void {
    if (this.animationFrameId === null) {
      this.lastFpsTime = performance.now();
      this.frameCount = 0;
      this.animationFrameId = requestAnimationFrame(this.update);
    }
  }
  
  /**
   * Stop the update loop
   */
  private stopUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Start sync interval for media synchronization
   * This runs separately from the update loop at a lower frequency
   */
  private startSyncInterval(): void {
    if (this.syncInterval === null) {
      // Sync every 500ms to reduce sync corrections
      // Changed from 200ms to prevent excessive corrections
      this.syncInterval = window.setInterval(() => {
        // Skip sync during seeking
        if (this.isPlaying && !this.isSeeking) {
          // This will be used by track managers to sync their media elements
          // Emitting a special sync event that managers can use for drift correction
          this.emit({
            type: 'sync',  // Changed to 'sync' to differentiate from regular timeupdate
            time: this.currentTime,
            playbackRate: this.playbackRate,
            isPlaying: this.isPlaying,
          });
        }
      }, 500);  // Increased interval to reduce correction frequency
    }
  }
  
  /**
   * Stop sync interval
   */
  private stopSyncInterval(): void {
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  /**
   * Emit event to all listeners
   */
  private emit(event: ClockEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in clock listener:', error);
      }
    });
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    this.listeners.clear();
  }
}

// Singleton instance
export const masterClock = new MasterClock();