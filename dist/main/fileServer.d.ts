export declare class FileServer {
    private server;
    private port;
    start(contentPath: string, port?: number): Promise<void>;
    stop(): void;
    getUrl(filePath: string): string;
}
//# sourceMappingURL=fileServer.d.ts.map