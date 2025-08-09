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
export declare class MasterClock {
    private currentTime;
    private duration;
    private playbackRate;
    private isPlaying;
    private startTime;
    private lastUpdateTime;
    private animationFrameId;
    private listeners;
    private syncInterval;
    private frameCount;
    private lastFpsTime;
    private currentFps;
    private useVideoSync;
    private lastVideoUpdateTime;
    private managers;
    private isSeeking;
    private lastSeekTime;
    private lastSeekTimestamp;
    private seekPromise;
    constructor();
    /**
     * Register a manager for direct coordination
     */
    registerManager(manager: any): void;
    /**
     * Unregister a manager
     */
    unregisterManager(manager: any): void;
    /**
     * Initialize the clock with a specific duration
     */
    initialize(durationMs: number): void;
    /**
     * Start playback
     */
    play(): void;
    /**
     * Pause playback
     */
    pause(): void;
    /**
     * Stop playback and reset to beginning
     */
    stop(): void;
    /**
     * Seek to specific time with coordinated manager sync
     */
    seek(timeMs: number): Promise<void>;
    private performSeek;
    /**
     * Set playback rate (0.5x, 1.0x, 1.5x, 2.0x, etc.)
     */
    setPlaybackRate(rate: number): void;
    /**
     * Update time from video element (video-driven sync)
     * This allows the video to be the master time source
     */
    updateTimeFromVideo(timeMs: number, isVideoPlaying: boolean): void;
    /**
     * Get current state
     */
    getState(): {
        currentTime: number;
        duration: number;
        playbackRate: number;
        isPlaying: boolean;
        fps: number;
    };
    /**
     * Subscribe to clock events
     */
    subscribe(listener: ClockListener): () => void;
    /**
     * Main update loop using requestAnimationFrame
     */
    private update;
    /**
     * Start the update loop
     */
    private startUpdateLoop;
    /**
     * Stop the update loop
     */
    private stopUpdateLoop;
    /**
     * Start sync interval for media synchronization
     * This runs separately from the update loop at a lower frequency
     */
    private startSyncInterval;
    /**
     * Stop sync interval
     */
    private stopSyncInterval;
    /**
     * Emit event to all listeners
     */
    private emit;
    /**
     * Cleanup
     */
    destroy(): void;
}
export declare const masterClock: MasterClock;
//# sourceMappingURL=MasterClock.d.ts.map