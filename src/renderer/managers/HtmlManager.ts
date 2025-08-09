import { TrackItem, TrackManager } from '../../types/index';
import { findItemAtTime, debugTimeCalculation } from '../utils/timeUtils';

export class HtmlManager implements TrackManager {
  private items: TrackItem[] = [];
  private currentItemIndex: number = -1;
  private containerElement: HTMLDivElement | null = null;
  private iframeElement: HTMLIFrameElement | null = null;
  private basePath: string = '';
  private currentItem: TrackItem | null = null;
  private switchTimeout: NodeJS.Timeout | null = null;
  private lastSwitchTime: number = 0;
  
  constructor(container?: HTMLElement) {
    if (container) {
      this.initializeContainer(container);
    }
  }
  
  private initializeContainer(container: HTMLElement): void {
    // console.log('[HtmlManager] Initializing container');
    
    this.containerElement = document.createElement('div');
    this.containerElement.className = 'html-manager-container';
    this.containerElement.style.cssText = `
      width: 100%;
      height: 100%;
      background: #2a2a2a;
      border-left: 1px solid rgba(255, 255, 255, 0.1);
      overflow: hidden;
      position: relative;
      display: block;
      visibility: visible;
    `;
    
    // Create iframe for HTML content
    this.iframeElement = document.createElement('iframe');
    this.iframeElement.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: white;
      display: block;
      visibility: visible;
    `;
    
    // Set sandbox attributes for security - more permissive for content:// protocol
    this.iframeElement.sandbox.add('allow-scripts');
    this.iframeElement.sandbox.add('allow-same-origin');
    this.iframeElement.sandbox.add('allow-forms');
    this.iframeElement.sandbox.add('allow-modals');
    this.iframeElement.name = 'html-content-frame';
    // console.log('[HtmlManager] Iframe created with sandbox:', Array.from(this.iframeElement.sandbox));
    
    this.containerElement.appendChild(this.iframeElement);
    container.appendChild(this.containerElement);
    
    // console.log('[HtmlManager] Container initialized, dimensions:', {
    //   width: this.containerElement.offsetWidth,
    //   height: this.containerElement.offsetHeight,
    //   parent: container.className
    // });
    
    // Add placeholder content
    this.showPlaceholder();
  }
  
  private showPlaceholder(): void {
    if (!this.iframeElement) return;
    
    // console.log('[HtmlManager] Showing placeholder');
    
    const placeholderHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #2a2a2a;
            color: rgba(255, 255, 255, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .placeholder {
            padding: 40px;
          }
          h3 {
            color: rgba(255, 255, 255, 0.8);
            font-weight: normal;
          }
        </style>
      </head>
      <body>
        <div class="placeholder">
          <h3>HTML Content Panel</h3>
          <p>Content will appear here when playing</p>
        </div>
      </body>
      </html>
    `;
    
    this.iframeElement.srcdoc = placeholderHtml;
  }
  
  async load(items: TrackItem[], basePath: string = ''): Promise<void> {
    // console.log('[HtmlManager] Loading items:', items.length, 'basePath:', basePath);
    if (items.length > 0) {
      // console.log('[HtmlManager] First item:', items[0]);
    }
    
    this.items = items;
    this.basePath = basePath;
    this.currentItemIndex = -1;
    this.currentItem = null;
    
    // RE-ENABLED: HTML content loading
    // console.log('[HtmlManager] HTML content loading re-enabled');
    
    // Load initial content for time 0
    const initialItem = findItemAtTime(this.items, 0);
    
    if (process.env.NODE_ENV === 'development') {
      debugTimeCalculation('HtmlManager', this.items, 0, initialItem);
    }
    if (initialItem) {
      // console.log('[HtmlManager] Loading initial HTML content');
      await this.loadHtmlContent(initialItem);
    } else {
      // Show placeholder if no content at time 0
      this.showPlaceholder();
    }
  }
  
  sync(masterTime: number, playbackRate: number): void {
    // Find which HTML content should be displayed at this time
    const targetItem = findItemAtTime(this.items, masterTime);
    
    if (process.env.NODE_ENV === 'development') {
      debugTimeCalculation('HtmlManager', this.items, masterTime, targetItem);
    }
    
    if (!targetItem) {
      // No HTML content should be showing
      if (this.currentItem) {
        // console.log('[HtmlManager] No content for time:', masterTime, 'showing placeholder');
        this.currentItem = null;
        this.showPlaceholder();
      }
      return;
    }
    
    // Check if we need to switch HTML content with debouncing
    if (targetItem !== this.currentItem) {
      const now = Date.now();
      
      // Clear any pending switch
      if (this.switchTimeout) {
        clearTimeout(this.switchTimeout);
        this.switchTimeout = null;
      }
      
      // Immediate switch for significant time jumps or initial load
      const timeDifference = Math.abs(now - this.lastSwitchTime);
      const isLargeTimeJump = this.currentItem && 
        (masterTime < this.currentItem.start_ms || 
         masterTime >= (this.currentItem.end_ms || this.currentItem.start_ms + (this.currentItem.duration_ms || 0)));
      
      if (timeDifference > 1000 || !this.currentItem || isLargeTimeJump) {
        // console.log('[HtmlManager] Immediate content switch at time:', masterTime, 'item:', targetItem.file);
        this.lastSwitchTime = now;
        this.loadHtmlContent(targetItem);
      } else {
        // Debounced switch for normal playback
        this.switchTimeout = setTimeout(() => {
          if (this.currentItem !== targetItem) {
            // console.log('[HtmlManager] Debounced content switch at time:', masterTime, 'item:', targetItem.file);
            this.lastSwitchTime = Date.now();
            this.loadHtmlContent(targetItem);
          }
          this.switchTimeout = null;
        }, 200);
      }
    }
  }
  
  private async loadHtmlContent(item: TrackItem): Promise<void> {
    // console.log('[HtmlManager] Loading HTML content:', item.file);
    // console.log('[HtmlManager] Full item:', JSON.stringify(item));
    
    this.currentItem = item;
    const index = this.items.indexOf(item);
    this.currentItemIndex = index;
    
    if (!this.iframeElement) {
      console.error('[HtmlManager] No iframe element available');
      return;
    }
    
    try {
      // Try to fetch and load HTML content directly
      if (window.electronAPI) {
        // Fetch the actual HTML content via IPC
        const htmlUrl = await this.getHtmlUrl(item.file);
        // console.log('[HtmlManager] Fetching HTML from URL:', htmlUrl);
        
        // Fetch the HTML content
        const response = await fetch(htmlUrl);
        if (response.ok) {
          const htmlContent = await response.text();
          // console.log('[HtmlManager] HTML content fetched, length:', htmlContent.length);
          
          // Use srcdoc to load content directly
          this.iframeElement.srcdoc = htmlContent;
          // console.log('[HtmlManager] HTML content set via srcdoc');
        } else {
          console.error('[HtmlManager] Failed to fetch HTML:', response.status, response.statusText);
          // Fallback to src method
          this.iframeElement.src = htmlUrl;
          // console.log('[HtmlManager] Fallback: iframe src set to:', this.iframeElement.src);
        }
      } else {
        // Fallback for non-Electron environment
        const htmlUrl = await this.getHtmlUrl(item.file);
        this.iframeElement.src = htmlUrl;
        // console.log('[HtmlManager] Non-Electron: iframe src set to:', this.iframeElement.src);
      }
      
      // Add load event listener to verify content loads
      const onLoad = () => {
        // console.log('[HtmlManager] Iframe loaded successfully');
        // console.log('[HtmlManager] Iframe contentWindow:', this.iframeElement?.contentWindow);
        this.iframeElement?.removeEventListener('load', onLoad);
        this.iframeElement?.removeEventListener('error', onError);
      };
      
      const onError = (e: Event) => {
        console.error('[HtmlManager] Iframe load error:', e);
        this.iframeElement?.removeEventListener('load', onLoad);
        this.iframeElement?.removeEventListener('error', onError);
      };
      
      this.iframeElement.addEventListener('load', onLoad);
      this.iframeElement.addEventListener('error', onError);
      
      // Add animation for smooth transition
      this.iframeElement.style.opacity = '0';
      setTimeout(() => {
        if (this.iframeElement) {
          this.iframeElement.style.transition = 'opacity 0.3s';
          this.iframeElement.style.opacity = '1';
        }
      }, 100);
      
    } catch (error) {
      console.error('Failed to load HTML content:', error);
      this.showError(item.file);
    }
  }
  
  private async getHtmlUrl(filePath: string): Promise<string> {
    // If it's already a URL, return as is
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('content://')) {
      return filePath;
    }
    
    // Convert local file path to content:// URL via Electron IPC
    if (window.electronAPI) {
      return await window.electronAPI.getFileUrl(filePath);
    }
    
    // Fallback to file:// protocol
    return `file:///${filePath.replace(/\\/g, '/')}`;
  }
  
  private showError(filePath: string): void {
    if (!this.iframeElement) return;
    
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #2a2a2a;
            color: #ff3b30;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        <div>
          <h3>Failed to Load Content</h3>
          <p>${filePath}</p>
        </div>
      </body>
      </html>
    `;
    
    this.iframeElement.srcdoc = errorHtml;
  }
  
  // Removed: Using unified findItemAtTime from timeUtils instead
  
  play(): void {
    // HTML content doesn't have play/pause state
  }
  
  pause(): void {
    // HTML content doesn't have play/pause state
  }
  
  async seek(timeMs: number): Promise<void> {
    // console.log('[HtmlManager] Seek to:', timeMs, 'ms');
    
    try {
      const targetItem = findItemAtTime(this.items, timeMs);
      
      if (process.env.NODE_ENV === 'development') {
        debugTimeCalculation('HtmlManager', this.items, timeMs, targetItem);
      }
      
      if (!targetItem) {
        if (this.currentItem) {
          this.currentItem = null;
          this.showPlaceholder();
        }
        return;
      }
      
      if (targetItem !== this.currentItem) {
        // Wrap loadHtmlContent in a Promise with timeout
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            console.warn('[HtmlManager] HTML content load timeout');
            resolve(); // Resolve to not block other operations
          }, 2000); // 2 second timeout
          
          this.loadHtmlContent(targetItem).then(() => {
            clearTimeout(timeoutId);
            resolve();
          }).catch(error => {
            clearTimeout(timeoutId);
            console.error('[HtmlManager] Failed to load HTML content:', error);
            resolve(); // Still resolve to not block
          });
        });
      }
      
      // console.log('[HtmlManager] Seek completed');
    } catch (error) {
      console.error('[HtmlManager] Seek failed:', error);
      // Don't throw - resolve gracefully
    }
  }
  
  setPlaybackRate(rate: number): void {
    // HTML content doesn't need playback rate adjustment
  }
  
  getCurrentItem(): TrackItem | null {
    return this.currentItem;
  }
  
  getElement(): HTMLElement | null {
    return this.containerElement;
  }
  
  destroy(): void {
    // Clean up any pending timeouts
    if (this.switchTimeout) {
      clearTimeout(this.switchTimeout);
      this.switchTimeout = null;
    }
    
    if (this.iframeElement) {
      this.iframeElement.src = 'about:blank';
      this.iframeElement.remove();
      this.iframeElement = null;
    }
    
    if (this.containerElement) {
      this.containerElement.remove();
      this.containerElement = null;
    }
    
    this.items = [];
    this.currentItemIndex = -1;
    this.currentItem = null;
    this.lastSwitchTime = 0;
  }
}