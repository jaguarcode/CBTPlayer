/**
 * Time calculation utilities for media synchronization
 */

import { TrackItem } from '../../types/index';

/**
 * Find the appropriate track item for a given master time
 * Uses precise boundary handling to ensure consistent results across all managers
 */
export function findItemAtTime(items: TrackItem[], timeMs: number): TrackItem | null {
  if (!items || items.length === 0) {
    return null;
  }
  
  // Clamp time to positive values
  const clampedTime = Math.max(0, timeMs);
  
  // Binary search for better performance with many items
  let left = 0;
  let right = items.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const item = items[mid];
    const startTime = item.start_ms;
    const endTime = item.end_ms || (item.start_ms + (item.duration_ms || 0));
    
    // Check if time falls within this item's range
    // Use inclusive start, exclusive end for precise boundary handling
    if (clampedTime >= startTime && clampedTime < endTime) {
      return item;
    }
    
    // Special case: handle the exact end time of the last item
    if (mid === items.length - 1 && clampedTime === endTime) {
      return item;
    }
    
    // Binary search navigation
    if (clampedTime < startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  
  return null;
}

/**
 * Calculate the relative time within an item for a given master time
 * Returns the time in seconds from the start of the item
 */
export function calculateItemRelativeTime(item: TrackItem, masterTimeMs: number): number {
  // Calculate relative time from item start
  const relativeMs = masterTimeMs - item.start_ms;
  
  // Handle negative times (before item start)
  if (relativeMs < 0) {
    return 0;
  }
  
  const relativeSeconds = relativeMs / 1000;
  
  // Ensure we don't exceed the item's duration
  if (item.duration_ms) {
    const maxSeconds = item.duration_ms / 1000;
    return Math.min(relativeSeconds, maxSeconds);
  }
  
  return relativeSeconds;
}

/**
 * Get the index of an item within the items array
 */
export function getItemIndex(items: TrackItem[], item: TrackItem): number {
  return items.indexOf(item);
}

/**
 * Validate time boundaries and provide detailed logging for debugging
 */
export function debugTimeCalculation(
  managerName: string, 
  items: TrackItem[], 
  masterTime: number, 
  foundItem: TrackItem | null
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${managerName}] Time calculation debug:`, {
      masterTime,
      foundItem: foundItem ? {
        id: foundItem.id,
        start: foundItem.start_ms,
        end: foundItem.end_ms || (foundItem.start_ms + (foundItem.duration_ms || 0)),
        relativeTime: foundItem ? calculateItemRelativeTime(foundItem, masterTime) : null
      } : null,
      availableItems: items.map(item => ({
        id: item.id,
        start: item.start_ms,
        end: item.end_ms || (item.start_ms + (item.duration_ms || 0))
      }))
    });
  }
}

/**
 * Check if a time falls within valid playback range for the given items
 */
export function isTimeInValidRange(items: TrackItem[], timeMs: number): boolean {
  if (!items || items.length === 0) {
    return false;
  }
  
  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  const lastEndTime = lastItem.end_ms || (lastItem.start_ms + (lastItem.duration_ms || 0));
  
  return timeMs >= firstItem.start_ms && timeMs <= lastEndTime;
}

/**
 * Find the next item after the current time
 * Useful for preloading and smooth transitions
 */
export function findNextItem(items: TrackItem[], currentTimeMs: number): TrackItem | null {
  if (!items || items.length === 0) {
    return null;
  }
  
  for (const item of items) {
    if (item.start_ms > currentTimeMs) {
      return item;
    }
  }
  
  return null;
}

/**
 * Find the previous item before the current time
 * Useful for backward navigation
 */
export function findPreviousItem(items: TrackItem[], currentTimeMs: number): TrackItem | null {
  if (!items || items.length === 0) {
    return null;
  }
  
  // Iterate in reverse to find the last item before current time
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const endTime = item.end_ms || (item.start_ms + (item.duration_ms || 0));
    
    if (endTime < currentTimeMs) {
      return item;
    }
  }
  
  return null;
}

/**
 * Check if we're near the end of an item (within threshold)
 * Useful for preloading next content
 */
export function isNearItemEnd(item: TrackItem, currentTimeMs: number, thresholdMs: number = 1000): boolean {
  const endTime = item.end_ms || (item.start_ms + (item.duration_ms || 0));
  const timeUntilEnd = endTime - currentTimeMs;
  
  return timeUntilEnd > 0 && timeUntilEnd <= thresholdMs;
}

/**
 * Get precise item boundaries for accurate transitions
 */
export function getItemBoundaries(item: TrackItem): { start: number; end: number; duration: number } {
  const start = item.start_ms;
  const end = item.end_ms || (item.start_ms + (item.duration_ms || 0));
  const duration = end - start;
  
  return { start, end, duration };
}

/**
 * Validate item continuity - check if items have gaps or overlaps
 */
export function validateItemContinuity(items: TrackItem[]): { valid: boolean; gaps: number[]; overlaps: number[] } {
  const gaps: number[] = [];
  const overlaps: number[] = [];
  
  for (let i = 0; i < items.length - 1; i++) {
    const currentItem = items[i];
    const nextItem = items[i + 1];
    
    const currentEnd = currentItem.end_ms || (currentItem.start_ms + (currentItem.duration_ms || 0));
    const nextStart = nextItem.start_ms;
    
    if (currentEnd < nextStart) {
      // Gap detected
      gaps.push(i);
    } else if (currentEnd > nextStart) {
      // Overlap detected
      overlaps.push(i);
    }
  }
  
  return {
    valid: gaps.length === 0 && overlaps.length === 0,
    gaps,
    overlaps
  };
}