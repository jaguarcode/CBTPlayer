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
export declare class ContentLoader {
    private currentPackagePath;
    private extractedPath;
    loadPackage(packagePath: string): Promise<Manifest>;
    loadZipPackage(zipPath: string): Promise<Manifest>;
    loadManifest(manifestPath: string): Promise<Manifest>;
    private validateManifest;
    private updateManifestPaths;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=contentLoader.d.ts.map