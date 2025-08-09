export declare class MediaProtocolHandlerLegacy {
    /**
     * Register custom protocols for media streaming
     */
    static registerProtocols(): void;
    /**
     * Setup protocol handlers after app is ready using legacy API
     */
    static setupHandlers(): void;
    /**
     * Handle buffer protocol requests
     */
    private static handleBufferRequest;
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
//# sourceMappingURL=mediaProtocolHandlerLegacy.d.ts.map