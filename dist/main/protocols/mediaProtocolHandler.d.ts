export declare class MediaProtocolHandler {
    private static readonly CHUNK_SIZE;
    private static readonly VIDEO_PROTOCOL;
    private static readonly AUDIO_PROTOCOL;
    /**
     * Register custom protocols for media streaming with byte-range support
     */
    static registerProtocols(): void;
    /**
     * Setup protocol handlers after app is ready
     */
    static setupHandlers(): void;
    /**
     * Handle media requests with proper byte-range support
     */
    private static handleMediaRequest;
    /**
     * Parse Range header
     */
    private static parseRangeHeader;
    /**
     * Get MIME type based on file extension
     */
    private static getMimeType;
    /**
     * Convert file path to custom protocol URL
     */
    static getVideoUrl(filePath: string): string;
    static getAudioUrl(filePath: string): string;
}
//# sourceMappingURL=mediaProtocolHandler.d.ts.map