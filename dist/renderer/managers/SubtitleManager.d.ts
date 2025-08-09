import { TrackItem, TrackManager } from '../../types/index';
export declare class SubtitleManager implements TrackManager {
    private items;
    private currentItemIndex;
    private containerElement;
    private subtitleDisplay;
    private currentCues;
    private activeCue;
    private basePath;
    private currentPlaybackRate;
    constructor(container?: HTMLElement);
    private initializeContainer;
    load(items: TrackItem[], basePath?: string): Promise<void>;
    private loadSubtitleAtIndex;
    private loadVTTFile;
    private parseVTT;
    private parseVTTTime;
    sync(masterTime: number, playbackRate: number): void;
    private displaySubtitleForTime;
    private showSubtitle;
    private hideSubtitle;
    private processVTTText;
    private adjustSubtitleSize;
    play(): void;
    pause(): void;
    seek(timeMs: number): Promise<void>;
    setPlaybackRate(rate: number): void;
    setStyle(styles: Partial<CSSStyleDeclaration>): void;
    getCurrentItem(): TrackItem | null;
    getElement(): HTMLElement | null;
    destroy(): void;
}
//# sourceMappingURL=SubtitleManager.d.ts.map