import { TrackItem, TrackManager } from '../../types/index';
import { masterClock } from '../services/MasterClock';
import { findItemAtTime, debugTimeCalculation } from '../utils/timeUtils';

interface VTTCue {
  id?: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  settings?: string;
}

export class SubtitleManager implements TrackManager {
  private items: TrackItem[] = [];
  private currentItemIndex: number = -1;
  private containerElement: HTMLDivElement | null = null;
  private subtitleDisplay: HTMLDivElement | null = null;
  private currentCues: VTTCue[] = [];
  private activeCue: VTTCue | null = null;
  private basePath: string = '';
  private currentPlaybackRate: number = 1.0;
  
  constructor(container?: HTMLElement) {
    if (container) {
      this.initializeContainer(container);
    }
    
    // Register with MasterClock for coordination
    masterClock.registerManager(this);
  }
  
  private initializeContainer(container: HTMLElement): void {
    this.containerElement = document.createElement('div');
    this.containerElement.className = 'subtitle-manager-container';
    this.containerElement.style.cssText = `
      position: absolute;
      top: 10%;
      left: 0;
      right: 0;
      width: 100%;
      height: auto;
      max-height: 15vh;
      text-align: center;
      pointer-events: none;
      z-index: 100;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 0 20px;
      overflow: visible;
    `;
    
    this.subtitleDisplay = document.createElement('div');
    this.subtitleDisplay.className = 'subtitle-display';
    this.subtitleDisplay.style.cssText = `
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 22px;
      line-height: 1.4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: none;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9);
      max-width: 80%;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      width: auto;
      height: auto;
      max-height: 12vh;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-align: center;
      box-sizing: border-box;
      flex-shrink: 0;
    `;
    
    this.containerElement.appendChild(this.subtitleDisplay);
    container.appendChild(this.containerElement);
  }
  
  async load(items: TrackItem[], basePath: string = ''): Promise<void> {
    // console.log('[SubtitleManager] Loading items:', items.length, 'basePath:', basePath);
    if (items.length > 0) {
      // console.log('[SubtitleManager] First item:', items[0]);
    }
    
    this.items = items;
    this.basePath = basePath;
    this.currentItemIndex = -1;
    this.currentCues = [];
    this.activeCue = null;
    
    // RE-ENABLED: Subtitle loading
    // console.log('[SubtitleManager] Subtitle loading re-enabled');
    
    // Load the first subtitle that should be showing at time 0
    const initialItem = findItemAtTime(this.items, 0);
    
    if (process.env.NODE_ENV === 'development') {
      debugTimeCalculation('SubtitleManager', this.items, 0, initialItem);
    }
    if (initialItem) {
      const index = this.items.indexOf(initialItem);
      // console.log('[SubtitleManager] Loading initial subtitle at index:', index);
      await this.loadSubtitleAtIndex(index);
    }
  }
  
  private async loadSubtitleAtIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.items.length) {
      return;
    }
    
    const item = this.items[index];
    // console.log('[SubtitleManager] Loading subtitle at index:', index, 'file:', item.file);
    
    this.currentItemIndex = index;
    
    try {
      const vttContent = await this.loadVTTFile(item.file);
      this.currentCues = this.parseVTT(vttContent, item.start_ms);
      // console.log('[SubtitleManager] Loaded', this.currentCues.length, 'cues');
    } catch (error) {
      console.error('[SubtitleManager] Failed to load subtitle file:', error);
      this.currentCues = [];
    }
  }
  
  private async loadVTTFile(filePath: string): Promise<string> {
    // If it's a URL, fetch it
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      const response = await fetch(filePath);
      return await response.text();
    }
    
    // For local files, use Electron IPC to get content URL
    if (window.electronAPI) {
      const url = await window.electronAPI.getFileUrl(filePath);
      const response = await fetch(url);
      return await response.text();
    }
    
    throw new Error('Unable to load VTT file: ' + filePath);
  }
  
  private parseVTT(vttContent: string, offsetMs: number = 0): VTTCue[] {
    const cues: VTTCue[] = [];
    const lines = vttContent.split('\n');
    
    let i = 0;
    
    // Skip WEBVTT header
    while (i < lines.length && !lines[i].includes('WEBVTT')) {
      i++;
    }
    i++; // Skip the WEBVTT line itself
    
    // Parse cues
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Skip empty lines and notes
      if (!line || line.startsWith('NOTE')) {
        i++;
        continue;
      }
      
      // Check if this is a cue identifier or timing line
      let cueId: string | undefined;
      let timingLine: string;
      
      if (line.includes('-->')) {
        timingLine = line;
      } else {
        cueId = line;
        i++;
        if (i < lines.length) {
          timingLine = lines[i].trim();
        } else {
          break;
        }
      }
      
      // Parse timing
      const timingMatch = timingLine.match(/(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})(.*)/);
      
      if (timingMatch) {
        const startTime = this.parseVTTTime(timingMatch[1]) + offsetMs / 1000;
        const endTime = this.parseVTTTime(timingMatch[2]) + offsetMs / 1000;
        const settings = timingMatch[3]?.trim();
        
        // Collect cue text
        const textLines: string[] = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i]);
          i++;
        }
        
        if (textLines.length > 0) {
          cues.push({
            id: cueId,
            startTime,
            endTime,
            text: textLines.join('\n'),
            settings
          });
        }
      }
      
      i++;
    }
    
    return cues;
  }
  
  private parseVTTTime(timeString: string): number {
    const parts = timeString.split(':');
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    
    if (parts.length === 3) {
      hours = parseFloat(parts[0]);
      minutes = parseFloat(parts[1]);
      seconds = parseFloat(parts[2]);
    } else if (parts.length === 2) {
      minutes = parseFloat(parts[0]);
      seconds = parseFloat(parts[1]);
    }
    
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  sync(masterTime: number, playbackRate: number): void {
    this.currentPlaybackRate = playbackRate;
    
    // Find which subtitle file should be active
    const targetItem = findItemAtTime(this.items, masterTime);
    
    if (process.env.NODE_ENV === 'development') {
      debugTimeCalculation('SubtitleManager', this.items, masterTime, targetItem);
    }
    
    if (!targetItem) {
      // No subtitles should be showing
      this.hideSubtitle();
      return;
    }
    
    // Check if we need to switch subtitle files
    const targetIndex = this.items.indexOf(targetItem);
    if (targetIndex !== this.currentItemIndex) {
      this.loadSubtitleAtIndex(targetIndex).then(() => {
        this.displaySubtitleForTime(masterTime, targetItem);
      });
      return;
    }
    
    // Display subtitle for current time
    this.displaySubtitleForTime(masterTime, targetItem);
  }
  
  private displaySubtitleForTime(masterTime: number, item: TrackItem): void {
    const timeInSeconds = masterTime / 1000;
    
    // Find the active cue for this time
    const cue = this.currentCues.find(c => 
      timeInSeconds >= c.startTime && timeInSeconds < c.endTime
    );
    
    if (cue !== this.activeCue) {
      this.activeCue = cue || null;
      
      if (cue) {
        this.showSubtitle(cue.text);
      } else {
        this.hideSubtitle();
      }
    }
  }
  
  private showSubtitle(text: string): void {
    if (!this.subtitleDisplay) return;
    
    // Process text (handle basic VTT formatting)
    const processedText = this.processVTTText(text);
    
    // Check if text contains line breaks
    const hasMultipleLines = processedText.includes('<br>') || processedText.includes('\n');
    
    // Adjust styling based on content
    if (hasMultipleLines) {
      this.subtitleDisplay.style.whiteSpace = 'pre-line';
      this.subtitleDisplay.style.textAlign = 'center';
    } else {
      this.subtitleDisplay.style.whiteSpace = 'nowrap';
      this.subtitleDisplay.style.textAlign = 'center';
    }
    
    this.subtitleDisplay.innerHTML = processedText;
    this.subtitleDisplay.style.display = 'inline-block';
    
    // Ensure the subtitle container fits the text content
    this.adjustSubtitleSize();
  }
  
  private hideSubtitle(): void {
    if (!this.subtitleDisplay) return;
    
    this.subtitleDisplay.style.display = 'none';
    this.subtitleDisplay.innerHTML = '';
  }
  
  private processVTTText(text: string): string {
    // Convert basic VTT markup to HTML
    let processed = text;
    
    // Convert <b> tags
    processed = processed.replace(/<b>/g, '<strong>');
    processed = processed.replace(/<\/b>/g, '</strong>');
    
    // Convert <i> tags
    processed = processed.replace(/<i>/g, '<em>');
    processed = processed.replace(/<\/i>/g, '</em>');
    
    // Convert <u> tags
    processed = processed.replace(/<u>/g, '<span style="text-decoration: underline">');
    processed = processed.replace(/<\/u>/g, '</span>');
    
    // Convert line breaks
    processed = processed.replace(/\n/g, '<br>');
    
    // Remove any other tags for security
    processed = processed.replace(/<(?!strong|\/strong|em|\/em|span|\/span|br)[^>]+>/g, '');
    
    return processed;
  }
  
  private adjustSubtitleSize(): void {
    if (!this.subtitleDisplay) return;
    
    // Reset dimensions to measure natural content size
    this.subtitleDisplay.style.width = 'auto';
    this.subtitleDisplay.style.height = 'auto';
    this.subtitleDisplay.style.minWidth = '0';
    this.subtitleDisplay.style.maxWidth = '80%';
    this.subtitleDisplay.style.maxHeight = '12vh';
    
    // After the content is rendered, check if it fits
    setTimeout(() => {
      if (!this.subtitleDisplay || this.subtitleDisplay.style.display === 'none') return;
      
      const rect = this.subtitleDisplay.getBoundingClientRect();
      const containerWidth = this.containerElement?.getBoundingClientRect().width || window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // If subtitle is too wide, enable text wrapping
      if (rect.width > containerWidth * 0.8) {
        this.subtitleDisplay.style.whiteSpace = 'pre-line';
        this.subtitleDisplay.style.maxWidth = '80%';
      }
      
      // If subtitle is too tall, limit height and enable scrolling if necessary
      const maxHeight = viewportHeight * 0.12; // 12% of viewport height
      if (rect.height > maxHeight) {
        this.subtitleDisplay.style.maxHeight = `${maxHeight}px`;
        this.subtitleDisplay.style.overflowY = 'hidden'; // Hide overflow instead of scroll
        // Reduce font size slightly for better fit
        this.subtitleDisplay.style.fontSize = '20px';
        this.subtitleDisplay.style.lineHeight = '1.3';
      }
      
      // Add some breathing room with padding adjustment based on text length
      const textLength = this.subtitleDisplay.textContent?.length || 0;
      if (textLength < 20) {
        this.subtitleDisplay.style.padding = '6px 12px';
      } else if (textLength < 50) {
        this.subtitleDisplay.style.padding = '8px 16px';
      } else {
        this.subtitleDisplay.style.padding = '8px 20px'; // Reduced vertical padding for long text
      }
    }, 0);
  }
  
  // Removed: Using unified findItemAtTime from timeUtils instead
  
  play(): void {
    // Subtitles don't have play/pause state
  }
  
  pause(): void {
    // Subtitles don't have play/pause state
  }
  
  async seek(timeMs: number): Promise<void> {
    // console.log('[SubtitleManager] Coordinated seek to:', timeMs, 'ms');
    
    const targetItem = findItemAtTime(this.items, timeMs);
    
    if (process.env.NODE_ENV === 'development') {
      debugTimeCalculation('SubtitleManager', this.items, timeMs, targetItem);
    }
    
    if (!targetItem) {
      // console.log('[SubtitleManager] No subtitle item for time:', timeMs);
      this.hideSubtitle();
      return;
    }
    
    const targetIndex = this.items.indexOf(targetItem);
    
    try {
      // Load different subtitle file if needed
      if (targetIndex !== this.currentItemIndex) {
        // console.log('[SubtitleManager] Loading subtitle at index:', targetIndex);
        await this.loadSubtitleAtIndex(targetIndex);
      }
      
      // Display subtitle for the seek time
      this.displaySubtitleForTime(timeMs, targetItem);
      
      // console.log('[SubtitleManager] Seek completed successfully');
      
    } catch (error) {
      console.error('[SubtitleManager] Seek failed:', error);
      throw error; // Re-throw for MasterClock coordination
    }
  }
  
  setPlaybackRate(rate: number): void {
    this.currentPlaybackRate = rate;
    // Subtitles timing is handled by master clock
  }
  
  setStyle(styles: Partial<CSSStyleDeclaration>): void {
    if (!this.subtitleDisplay) return;
    
    Object.assign(this.subtitleDisplay.style, styles);
  }
  
  getCurrentItem(): TrackItem | null {
    if (this.currentItemIndex >= 0 && this.currentItemIndex < this.items.length) {
      return this.items[this.currentItemIndex];
    }
    return null;
  }
  
  getElement(): HTMLElement | null {
    return this.containerElement;
  }
  
  destroy(): void {
    // console.log('[SubtitleManager] Destroying subtitle manager');
    
    // Unregister from MasterClock
    masterClock.unregisterManager(this);
    
    this.hideSubtitle();
    
    if (this.containerElement) {
      this.containerElement.remove();
      this.containerElement = null;
    }
    
    this.subtitleDisplay = null;
    this.items = [];
    this.currentItemIndex = -1;
    this.currentCues = [];
    this.activeCue = null;
  }
}