/**
 * Time calculation utilities for media synchronization
 */
import { TrackItem } from '../../types/index';
/**
 * Find the appropriate track item for a given master time
 * Uses precise boundary handling to ensure consistent results across all managers
 */
export declare function findItemAtTime(items: TrackItem[], timeMs: number): TrackItem | null;
/**
 * Calculate the relative time within an item for a given master time
 * Returns the time in seconds from the start of the item
 */
export declare function calculateItemRelativeTime(item: TrackItem, masterTimeMs: number): number;
/**
 * Get the index of an item within the items array
 */
export declare function getItemIndex(items: TrackItem[], item: TrackItem): number;
/**
 * Validate time boundaries and provide detailed logging for debugging
 */
export declare function debugTimeCalculation(managerName: string, items: TrackItem[], masterTime: number, foundItem: TrackItem | null): void;
/**
 * Check if a time falls within valid playback range for the given items
 */
export declare function isTimeInValidRange(items: TrackItem[], timeMs: number): boolean;
/**
 * Find the next item after the current time
 * Useful for preloading and smooth transitions
 */
export declare function findNextItem(items: TrackItem[], currentTimeMs: number): TrackItem | null;
/**
 * Find the previous item before the current time
 * Useful for backward navigation
 */
export declare function findPreviousItem(items: TrackItem[], currentTimeMs: number): TrackItem | null;
/**
 * Check if we're near the end of an item (within threshold)
 * Useful for preloading next content
 */
export declare function isNearItemEnd(item: TrackItem, currentTimeMs: number, thresholdMs?: number): boolean;
/**
 * Get precise item boundaries for accurate transitions
 */
export declare function getItemBoundaries(item: TrackItem): {
    start: number;
    end: number;
    duration: number;
};
/**
 * Validate item continuity - check if items have gaps or overlaps
 */
export declare function validateItemContinuity(items: TrackItem[]): {
    valid: boolean;
    gaps: number[];
    overlaps: number[];
};
//# sourceMappingURL=timeUtils.d.ts.map