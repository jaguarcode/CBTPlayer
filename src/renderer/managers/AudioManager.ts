import { TrackItem, TrackManager, SyncMetrics } from '../../types/index';
import { masterClock } from '../services/MasterClock';
import { findItemAtTime, calculateItemRelativeTime, debugTimeCalculation } from '../utils/timeUtils';

// Import SoundTouch for pitch-preserved playback rate changes
// @ts-ignore - SoundTouch doesn't have TypeScript definitions
// Optional dependency - will fallback if not available
let PitchShifter: any;
try {
  PitchShifter = require('soundtouchjs').PitchShifter;
} catch (e) {
  // SoundTouch not available, using native playback rate
}

export class AudioManager implements TrackManager {
  private items: TrackItem[] = [];
  private currentItemIndex: number = -1;
  private audioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private pitchShifter: any = null; // SoundTouch PitchShifter
  private gainNode: GainNode | null = null;
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
  private readonly SYNC_TOLERANCE = 100; // Increased tolerance to reduce corrections (ms)
  
  // Audio state
  private isBuffering: boolean = false;
  private currentPlaybackRate: number = 1.0;
  private usePitchCorrection: boolean = true;
  private playPromise: Promise<void> | null = null;
  private lastSeekTime: number = 0;
  private lastSeekTimestamp: number = 0;
  
  constructor(private volume: number = 1.0) {
    this.initializeAudioContext();
    
    // Register with MasterClock for coordination
    masterClock.registerManager(this);
  }
  
  private initializeAudioContext(): void {
    // WebAudio API disabled
    this.usePitchCorrection = false;
    this.audioContext = null;
    this.gainNode = null;
    return;
    
    /* Original code commented out for debugging
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.volume;
      this.gainNode.connect(this.audioContext.destination);
      
      console.log('[AudioManager] AudioContext initialized successfully');
    } catch (error) {
      // console.warn('[AudioManager] Failed to initialize AudioContext, will use basic audio:', error);
      this.usePitchCorrection = false;
      this.audioContext = null;
      this.gainNode = null;
    }
    */
  }
  
  private createAudioElement(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      
      // Disconnect existing nodes
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
    }
    
    this.audioElement = document.createElement('audio');
    this.audioElement.preload = 'auto';
    // Remove crossOrigin for local files
    // this.audioElement.crossOrigin = 'anonymous'; // Required for Web Audio API
    
    // Don't set type attribute here - let browser detect from file
    
    // Add event listeners
    this.audioElement.addEventListener('waiting', () => {
      this.isBuffering = true;
    });
    
    this.audioElement.addEventListener('playing', () => {
      this.isBuffering = false;
    });
    
    this.audioElement.addEventListener('error', (e) => {
      this.recoverFromAudioError();
    });
    
    // Connect to Web Audio API if available
    if (this.audioContext && this.gainNode) {
      try {
        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        
        if (this.usePitchCorrection && typeof PitchShifter !== 'undefined' && PitchShifter) {
          this.setupPitchShifter();
        } else {
          // Direct connection without pitch correction
          this.sourceNode.connect(this.gainNode);
        }
      } catch (error) {
        this.usePitchCorrection = false;
        // Audio will still play without Web Audio API
      }
    } else {
      // Using basic HTML5 audio without Web Audio API
    }
  }
  
  private setupPitchShifter(): void {
    if (!this.sourceNode || !this.audioContext) return;
    
    try {
      // Initialize SoundTouch pitch shifter
      this.pitchShifter = new PitchShifter(this.audioContext, this.sourceNode, 16384);
      
      // Connect pitch shifter to gain node
      if (this.pitchShifter && this.gainNode) {
        this.pitchShifter.connect(this.gainNode);
        
        // Set initial parameters
        this.pitchShifter.pitch = 1.0; // No pitch change
        this.pitchShifter.tempo = this.currentPlaybackRate;
      }
    } catch (error) {
      // Fallback to direct connection
      if (this.sourceNode && this.gainNode) {
        this.sourceNode.connect(this.gainNode);
      }
      this.usePitchCorrection = false;
    }
  }
  
  async load(items: TrackItem[], basePath: string = ''): Promise<void> {
    this.items = items;
    this.basePath = basePath;
    this.currentItemIndex = -1;
    
    // Load the first audio that should be playing at time 0
    const initialItem = findItemAtTime(this.items, 0);
    
    if (process.env.NODE_ENV === 'development') {
      debugTimeCalculation('AudioManager', this.items, 0, initialItem);
    }
    if (initialItem) {
      const index = this.items.indexOf(initialItem);
      try {
        await this.loadAudioAtIndex(index);
      } catch (err) {
        // Don't throw - allow other media to continue
      }
    }
  }
  
  private async loadAudioAtIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.items.length) {
      return;
    }
    
    const item = this.items[index];
    
    // Check if file exists and has content before trying to load
    if (item.file && window.electronAPI) {
      try {
        // Try to get file URL to check if file exists
        await this.getAudioUrl(item.file);
      } catch (err) {
        // Audio file not accessible - set index but don't attempt to load
        this.currentItemIndex = index;
        return;
      }
    }
    
    this.currentItemIndex = index;
    
    this.createAudioElement();
    
    if (!this.audioElement) {
      return; // Don't throw, just return
    }
    
    // Convert file path to URL if needed
    const audioUrl = await this.getAudioUrl(item.file);
    
    return new Promise((resolve, reject) => {
      if (!this.audioElement) {
        reject(new Error('No audio element'));
        return;
      }
      
      const audio = this.audioElement;
      
      const onLoadedMetadata = () => {
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('error', onError);
        
        // Resume audio context if suspended (Chrome autoplay policy)
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }
        
        resolve();
      };
      
      const onError = (e: Event) => {
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('error', onError);
        // Don't reject - resolve to allow other media to continue
        resolve();
      };
      
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('error', onError);
      
      audio.src = audioUrl;
      audio.load();
    });
  }
  
  private async getAudioUrl(filePath: string): Promise<string> {
    // If it's already a URL, return as is
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('content://')) {
      return filePath;
    }
    
    // Use content:// protocol with byte-range support for media streaming
    if (window.electronAPI && window.electronAPI.getAudioUrl) {
      const contentUrl = await window.electronAPI.getAudioUrl(filePath);
      return contentUrl;
    } else if (window.electronAPI) {
      // Fallback to generic file URL
      const contentUrl = await window.electronAPI.getFileUrl(filePath);
      return contentUrl;
    }
    
    // Fallback to file:// protocol
    const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
    return fileUrl;
  }
  
  sync(masterTime: number, playbackRate: number): void {
    if (!this.audioElement || this.isBuffering) {
      return;
    }
    
    // Find which audio should be playing at this time
    const targetItem = findItemAtTime(this.items, masterTime);
    
    if (process.env.NODE_ENV === 'development') {
      debugTimeCalculation('AudioManager', this.items, masterTime, targetItem);
    }
    
    if (!targetItem) {
      // No audio should be playing at this time
      if (this.audioElement && !this.audioElement.paused) {
        this.audioElement.pause();
      }
      return;
    }
    
    // Check if we need to switch audio tracks
    const targetIndex = this.items.indexOf(targetItem);
    if (targetIndex !== this.currentItemIndex) {
      this.loadAudioAtIndex(targetIndex)
        .then(() => {
          this.syncCurrentAudio(masterTime, playbackRate, targetItem);
        })
        .catch(err => {
          // Continue without audio
        });
      return;
    }
    
    // Sync current audio
    this.syncCurrentAudio(masterTime, playbackRate, targetItem);
  }
  
  private syncCurrentAudio(masterTime: number, playbackRate: number, item: TrackItem): void {
    if (!this.audioElement) return;
    
    // Skip sync during seeking to prevent conflicts
    const now = Date.now();
    if ((now - this.lastSeekTimestamp) < 500) {
      return; // Just seeked, skip sync for a moment
    }
    
    // Calculate where we should be in this audio using unified calculation
    const audioTime = calculateItemRelativeTime(item, masterTime);
    const audioDuration = item.duration_ms ? item.duration_ms / 1000 : this.audioElement.duration;
    
    // Validate audio time is within bounds
    if (audioTime < 0) {
      // Haven't reached this audio yet
      if (!this.audioElement.paused) {
        console.log('[AudioManager] Audio time is negative, pausing');
        this.audioElement.pause();
      }
      return;
    }
    
    if (audioDuration && audioTime > audioDuration + 0.1) {
      // Past this audio's end
      if (!this.audioElement.paused) {
        console.log('[AudioManager] Past audio end, pausing');
        this.audioElement.pause();
      }
      return;
    }
    
    const currentAudioTime = this.audioElement.currentTime;
    const drift = Math.abs(currentAudioTime - audioTime) * 1000; // Convert back to ms
    
    // Update metrics
    this.updateSyncMetrics(drift);
    
    // Apply sync correction if drift exceeds tolerance
    if (drift > this.SYNC_TOLERANCE) {
      // Only correct if the drift is significant (>200ms) to avoid micro-corrections
      // Also avoid corrections during buffering or if audio was recently seeked
      const now = Date.now();
      const timeSinceSeek = now - this.lastSeekTimestamp;
      
      if (drift > 200 && timeSinceSeek > 1000 && !this.isBuffering) {
        const clampedTime = Math.max(0, Math.min(audioTime, audioDuration || audioTime));
        this.audioElement.currentTime = clampedTime;
        this.syncMetrics.corrections++;
        
        console.log(`[AudioManager] Audio sync correction: drift=${drift.toFixed(1)}ms, adjusted to ${clampedTime.toFixed(2)}s`);
      }
    }
    
    // Update playback rate if different
    if (Math.abs(this.currentPlaybackRate - playbackRate) > 0.01) {
      this.setPlaybackRate(playbackRate);
    }
    
    // Ensure audio is playing if it should be
    if (this.audioElement.paused && audioTime >= 0 && (!audioDuration || audioTime < audioDuration)) {
      // Only attempt to play if audio is ready and not already trying
      if (this.audioElement.readyState >= 2 && !this.playPromise) {
        // Throttle play attempts to prevent spamming
        const now = Date.now();
        const lastPlayAttempt = (this as any).lastPlayAttemptTime || 0;
        
        if (now - lastPlayAttempt > 1000) { // Only try once per second
          console.log('[AudioManager] Starting audio playback during sync');
          (this as any).lastPlayAttemptTime = now;
          
          const promise = this.audioElement.play();
          if (promise !== undefined) {
            this.playPromise = promise;
            promise.then(() => {
              this.playPromise = null;
            }).catch(e => {
              if (this.playPromise === promise) {
                console.log('[AudioManager] Play during sync interrupted:', e instanceof Error ? e.message : String(e));
              }
              this.playPromise = null;
            });
          }
        }
      }
    }
  }
  
  // Removed: Using unified findItemAtTime from timeUtils instead
  
  private updateSyncMetrics(drift: number): void {
    this.syncMetrics.drift = drift;
    
    // Update drift history
    this.driftHistory.push(drift);
    if (this.driftHistory.length > this.MAX_DRIFT_HISTORY) {
      this.driftHistory.shift();
    }
    
    // Calculate average drift
    const sum = this.driftHistory.reduce((a, b) => a + b, 0);
    this.syncMetrics.averageDrift = sum / this.driftHistory.length;
    
    // Update max drift
    this.syncMetrics.maxDrift = Math.max(this.syncMetrics.maxDrift, drift);
  }
  
  play(): void {
    if (!this.audioElement || !this.audioElement.paused) return;
    
    // Cancel any pending play promise
    this.playPromise = null;
    
    // Resume audio context if suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    const promise = this.audioElement.play();
    if (promise !== undefined) {
      this.playPromise = promise;
      promise.then(() => {
        console.log('[AudioManager] Audio playback started successfully');
        this.playPromise = null;
      }).catch(e => {
        // Only log if this is still the current play promise
        if (this.playPromise === promise) {
          console.log('[AudioManager] Play interrupted or failed:', e instanceof Error ? e.message : String(e));
        }
        this.playPromise = null;
      });
    }
  }
  
  pause(): void {
    if (!this.audioElement || this.audioElement.paused) return;
    
    // Wait for any pending play promise before pausing
    if (this.playPromise) {
      this.playPromise.then(() => {
        this.audioElement?.pause();
      }).catch(() => {
        // Play failed, safe to pause
        this.audioElement?.pause();
      });
    } else {
      this.audioElement.pause();
    }
  }
  
  async seek(timeMs: number): Promise<void> {
    // Prevent duplicate seeks to same time
    const now = Date.now();
    if (Math.abs(timeMs - this.lastSeekTime) < 1 && (now - this.lastSeekTimestamp) < 100) {
      console.log('[AudioManager] Ignoring duplicate seek to:', timeMs);
      return;
    }
    
    this.lastSeekTime = timeMs;
    this.lastSeekTimestamp = now;
    
    console.log('[AudioManager] Seeking to:', timeMs, 'ms');
    
    // Cancel any pending play promise during seek
    if (this.playPromise) {
      this.playPromise = null;
    }
    
    try {
      // Wrap entire seek operation with timeout
      await new Promise<void>(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
          // console.warn('[AudioManager] Seek timeout after 3 seconds');
          resolve(); // Resolve to not block other operations
        }, 3000);
        
        try {
          const targetItem = findItemAtTime(this.items, timeMs);
          
          if (process.env.NODE_ENV === 'development') {
            debugTimeCalculation('AudioManager', this.items, timeMs, targetItem);
          }
          
          if (!targetItem) {
            console.log('[AudioManager] No audio item for time:', timeMs, 'pausing audio');
            if (this.audioElement && !this.audioElement.paused) {
              this.audioElement.pause();
            }
            clearTimeout(timeoutId);
            resolve();
            return;
          }
          
          const targetIndex = this.items.indexOf(targetItem);
          
          // Load different audio track if needed
          if (targetIndex !== this.currentItemIndex) {
            console.log('[AudioManager] Switching audio track for seek:', this.currentItemIndex, '->', targetIndex);
            await this.loadAudioAtIndex(targetIndex);
          }
          
          // Wait for audio to be ready with timeout
          if (this.audioElement && this.audioElement.readyState < 2) {
            console.log('[AudioManager] Waiting for audio to be ready...');
            const readyTimeout = Date.now() + 2000; // 2 second max wait
            
            while (this.audioElement && this.audioElement.readyState < 2 && Date.now() < readyTimeout) {
              await new Promise(r => setTimeout(r, 50));
            }
            
            if (this.audioElement && this.audioElement.readyState < 2) {
              // console.warn('[AudioManager] Audio not ready after timeout, proceeding anyway');
            }
          }
          
          // Perform the seek (this will also resume playback if needed)
          this.seekInCurrentAudio(timeMs, targetItem);
          
          clearTimeout(timeoutId);
          console.log('[AudioManager] Audio seek completed to time:', timeMs);
          resolve();
          
        } catch (err) {
          clearTimeout(timeoutId);
          console.error('[AudioManager] Audio seek failed:', err);
          resolve(); // Still resolve to not block
        }
      });
    } catch (error) {
      console.error('[AudioManager] Critical seek error:', error);
      // Don't throw - gracefully handle
    }
  }
  
  private seekInCurrentAudio(timeMs: number, item: TrackItem): void {
    if (!this.audioElement) return;
    
    // Use unified time calculation
    const audioTime = calculateItemRelativeTime(item, timeMs);
    const clampedTime = Math.max(0, Math.min(audioTime, this.audioElement.duration || audioTime));
    
    console.log('[AudioManager] Setting audio time to:', clampedTime, 'seconds (master time:', timeMs, 'ms)');
    this.audioElement.currentTime = clampedTime;
    
    // Force sync update to master clock
    const masterTime = (clampedTime * 1000) + item.start_ms;
    console.log('[AudioManager] Updating master clock from audio seek:', masterTime);
    
    // Resume playback if master clock is playing
    const clockState = masterClock.getState();
    if (clockState.isPlaying && this.audioElement.paused) {
      console.log('[AudioManager] Resuming audio playback after seek (master clock is playing)');
      const promise = this.audioElement.play();
      if (promise !== undefined) {
        this.playPromise = promise;
        promise.then(() => {
          console.log('[AudioManager] Audio playback resumed successfully after seek');
          this.playPromise = null;
        }).catch(e => {
          console.log('[AudioManager] Failed to resume audio after seek:', e instanceof Error ? e.message : String(e));
          this.playPromise = null;
        });
      }
    }
  }
  
  setPlaybackRate(rate: number): void {
    this.currentPlaybackRate = rate;
    
    if (this.audioElement) {
      if (this.usePitchCorrection && this.pitchShifter) {
        // Use pitch shifter to maintain pitch while changing tempo
        this.pitchShifter.tempo = rate;
        this.pitchShifter.pitch = 1.0; // Keep original pitch
        // Keep audio element at normal speed when using pitch shifter
        this.audioElement.playbackRate = 1.0;
      } else {
        // Fallback to native playback rate (will change pitch)
        this.audioElement.playbackRate = rate;
      }
    }
  }
  
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    } else if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }
  
  getCurrentItem(): TrackItem | null {
    if (this.currentItemIndex >= 0 && this.currentItemIndex < this.items.length) {
      return this.items[this.currentItemIndex];
    }
    return null;
  }
  
  getElement(): HTMLElement | null {
    return this.audioElement;
  }
  
  getSyncMetrics(): SyncMetrics {
    return { ...this.syncMetrics };
  }
  
  destroy(): void {
    console.log('[AudioManager] Destroying audio manager');
    
    // Unregister from MasterClock
    masterClock.unregisterManager(this);
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement.remove();
      this.audioElement = null;
    }
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.pitchShifter) {
      this.pitchShifter.disconnect();
      this.pitchShifter = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.items = [];
    this.currentItemIndex = -1;
    this.driftHistory = [];
  }

  private recoverFromAudioError(): void {
    if (!this.audioElement || this.currentItemIndex < 0) return;
    
    // Prevent infinite recovery loops
    const now = Date.now();
    if ((this as any).lastRecoveryAttempt && now - (this as any).lastRecoveryAttempt < 5000) {
      // console.warn('[AudioManager] Skipping recovery - too frequent attempts');
      return;
    }
    (this as any).lastRecoveryAttempt = now;
    
    console.log('[AudioManager] Attempting to recover from audio error');
    
    const currentIndex = this.currentItemIndex;
    const currentTime = this.audioElement.currentTime || 0;
    const wasPlaying = !this.audioElement.paused;
    
    // For protocol errors, try recovery
    if (this.audioElement.src.startsWith('content://')) {
      console.log('[AudioManager] Content protocol error - attempting recovery');
      // Continue with recovery attempt
    }
    
    // Try gentle recovery first - reload without clearing source
    try {
      this.audioElement.load();
      
      setTimeout(async () => {
        if (this.audioElement && this.audioElement.error === null) {
          console.log('[AudioManager] Audio gentle recovery successful');
          this.audioElement.currentTime = currentTime;
          if (wasPlaying) {
            this.audioElement.play().catch(e => {
              // console.warn('[AudioManager] Failed to resume after recovery:', e);
            });
          }
          return;
        }
        
        // If gentle recovery failed, log but don't retry infinitely
        console.error('[AudioManager] Audio recovery failed - manual intervention needed');
      }, 200);
      
    } catch (err) {
      console.error('[AudioManager] Error during audio recovery:', err);
    }
  }
}