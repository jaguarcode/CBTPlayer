import { TrackItem, TrackManager } from '../../types/index';
export declare class HtmlManager implements TrackManager {
    private items;
    private currentItemIndex;
    private containerElement;
    private iframeElement;
    private basePath;
    private currentItem;
    private switchTimeout;
    private lastSwitchTime;
    constructor(container?: HTMLElement);
    private initializeContainer;
    private showPlaceholder;
    load(items: TrackItem[], basePath?: string): Promise<void>;
    sync(masterTime: number, playbackRate: number): void;
    private loadHtmlContent;
    private getHtmlUrl;
    private showError;
    play(): void;
    pause(): void;
    seek(timeMs: number): Promise<void>;
    setPlaybackRate(rate: number): void;
    getCurrentItem(): TrackItem | null;
    getElement(): HTMLElement | null;
    destroy(): void;
}
//# sourceMappingURL=HtmlManager.d.ts.map