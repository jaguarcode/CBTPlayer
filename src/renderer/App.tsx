import React, { useEffect, useState, useRef } from 'react';
import { masterClock } from './services/MasterClock';
import { VideoJsManager } from './managers/VideoJsManager';
import { AudioManager } from './managers/AudioManager';
import { SubtitleManager } from './managers/SubtitleManager';
import { HtmlManager } from './managers/HtmlManager';
import PlayerControls from './components/PlayerControls';
import EnhancedTimeline from './components/EnhancedTimeline';
import MediaViewer, { MediaViewerHandle } from './components/MediaViewer';
import DebugPanel from './components/DebugPanel';
import { Manifest } from '../types/index';
import './styles/App.css';
import './styles/MediaLayout.css';

function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(true);
  const [tracksLoaded, setTracksLoaded] = useState({
    video: false,
    audio: false,
    subtitle: false,
    html: false,
  });
  const [errors, setErrors] = useState<string[]>([]);
  
  const videoManagerRef = useRef<VideoJsManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const subtitleManagerRef = useRef<SubtitleManager | null>(null);
  const htmlManagerRef = useRef<HtmlManager | null>(null);
  const mediaViewerRef = useRef<MediaViewerHandle>(null);
  
  // Initialize managers when manifest is loaded (moved to separate effect)
  useEffect(() => {
    if (manifest && mediaViewerRef.current) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        try {
          // console.log('[App] Initializing all media managers');
          
          const { videoContainer, htmlContainer } = mediaViewerRef.current!;
          // console.log('[App] Media viewer containers:', { 
          //   videoContainer: !!videoContainer, 
          //   htmlContainer: !!htmlContainer,
          //   videoContainerDims: videoContainer ? { 
          //     width: videoContainer.offsetWidth, 
          //     height: videoContainer.offsetHeight 
          //   } : null
          // });
          
          // Always clean up existing managers first
          try {
            if (videoManagerRef.current) {
              videoManagerRef.current.destroy();
              videoManagerRef.current = null;
            }
          } catch (err) {
            console.error('[App] Error destroying video manager:', err);
          }
          
          try {
            if (subtitleManagerRef.current) {
              subtitleManagerRef.current.destroy();
              subtitleManagerRef.current = null;
            }
          } catch (err) {
            console.error('[App] Error destroying subtitle manager:', err);
          }
          
          try {
            if (htmlManagerRef.current) {
              htmlManagerRef.current.destroy();
              htmlManagerRef.current = null;
            }
          } catch (err) {
            console.error('[App] Error destroying HTML manager:', err);
          }
          
          try {
            if (audioManagerRef.current) {
              audioManagerRef.current.destroy();
              audioManagerRef.current = null;
            }
          } catch (err) {
            console.error('[App] Error destroying audio manager:', err);
          }
          
          // Create Video.js manager
          if (videoContainer) {
            try {
              // console.log('[App] Creating Video.js manager');
              videoManagerRef.current = new VideoJsManager(videoContainer);
              // console.log('[App] Video.js manager initialized');
              
              // Re-enable subtitle manager
              // console.log('[App] Re-enabling subtitle manager');
              subtitleManagerRef.current = new SubtitleManager(videoContainer);
            } catch (err) {
              console.error('[App] Error creating video manager:', err);
              setErrors(prev => [...prev, `Video initialization error: ${err}`]);
            }
          }
          
          // Re-enable HTML manager
          // console.log('[App] Re-enabling HTML manager');
          if (htmlContainer) {
            try {
              htmlManagerRef.current = new HtmlManager(htmlContainer);
              // console.log('[App] HTML manager initialized');
            } catch (err) {
              console.error('[App] Error creating HTML manager:', err);
              setErrors(prev => [...prev, `HTML initialization error: ${err}`]);
            }
          }
          
          // Re-enable audio manager (WebAudio API still disabled)
          // console.log('[App] Re-enabling audio manager (WebAudio API disabled)');
          try {
            audioManagerRef.current = new AudioManager();
            // console.log('[App] Audio manager initialized');
          } catch (err) {
            console.error('[App] Error creating audio manager:', err);
            setErrors(prev => [...prev, `Audio initialization error: ${err}`]);
          }
        } catch (error) {
          console.error('[App] Critical error during manager initialization:', error);
          setError(`Failed to initialize media managers: ${error}`);
        }
      }, 100); // Increase delay to ensure DOM is ready
    }
  }, [manifest]);
  
  useEffect(() => {
    // Subscribe to master clock events
    const unsubscribe = masterClock.subscribe((event) => {
      switch (event.type) {
        case 'play':
          // console.log('[App] Play event received');
          setIsPlaying(true);
          // Call play on all existing managers
          if (videoManagerRef.current) {
            // console.log('[App] Calling video manager play');
            videoManagerRef.current.play();
          }
          if (audioManagerRef.current) {
            // console.log('[App] Calling audio manager play');
            audioManagerRef.current.play();
          }
          break;
        case 'pause':
          // console.log('[App] Pause event received');
          setIsPlaying(false);
          // Call pause on all existing managers
          videoManagerRef.current?.pause();
          audioManagerRef.current?.pause();
          break;
        case 'seek':
          // console.log('[App] Seek event to:', event.time, 'isPlaying:', event.isPlaying);
          setCurrentTime(event.time);
          // Update playing state based on MasterClock
          setIsPlaying(event.isPlaying);
          // Call seek on all existing managers
          videoManagerRef.current?.seek(event.time);
          audioManagerRef.current?.seek(event.time);
          subtitleManagerRef.current?.seek(event.time);
          htmlManagerRef.current?.seek(event.time);
          break;
        case 'ratechange':
          setPlaybackRate(event.playbackRate);
          // Call setPlaybackRate on all existing managers
          videoManagerRef.current?.setPlaybackRate(event.playbackRate);
          audioManagerRef.current?.setPlaybackRate(event.playbackRate);
          subtitleManagerRef.current?.setPlaybackRate(event.playbackRate);
          break;
        case 'timeupdate':
          // Update UI state
          setCurrentTime(event.time);
          setIsPlaying(event.isPlaying);
          break;
        case 'sync':
          // Sync all managers including video (to handle transitions between videos)
          videoManagerRef.current?.sync(event.time, event.playbackRate);
          audioManagerRef.current?.sync(event.time, event.playbackRate);
          subtitleManagerRef.current?.sync(event.time, event.playbackRate);
          htmlManagerRef.current?.sync(event.time, event.playbackRate);
          
          // Ensure video remains visible during playback
          if (videoManagerRef.current) {
            const videoElement = videoManagerRef.current.getElement();
            if (videoElement && videoElement.style.display === 'none') {
              // console.log('[App] Video was hidden, making it visible again');
              videoElement.style.display = 'block';
            }
          }
          break;
        case 'ended':
          // console.log('[App] Ended event received');
          setIsPlaying(false);
          break;
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      videoManagerRef.current?.destroy();
      audioManagerRef.current?.destroy();
      subtitleManagerRef.current?.destroy();
      htmlManagerRef.current?.destroy();
      masterClock.destroy();
    };
  }, []);
  
  const handleOpenContent = async () => {
    setIsLoading(true);
    setError(null);
    // console.log('[App] Opening content package...');
    
    try {
      const result = await window.electronAPI.openContentPackage();
      // console.log('[App] Open content result:', result);
      
      if (result.success && result.manifest) {
        // console.log('[App] Manifest received, loading tracks...');
        await loadManifest(result.manifest, result.basePath || '');
      } else {
        console.error('[App] Failed to open content:', result.error);
        setError(result.error || 'Failed to open content package');
      }
    } catch (err) {
      console.error('[App] Error opening content:', err);
      setError((err as Error).message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLoadSample = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load sample manifest from content folder with absolute path
      const samplePath = 'X:/Workspace/CBTPoc/content/sample-package/manifest.json';
      const result = await window.electronAPI.loadLocalManifest(samplePath);
      
      if (result.success && result.manifest) {
        await loadManifest(result.manifest, result.basePath || '');
      } else {
        setError(result.error || 'Failed to load sample content');
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadManifest = async (manifest: Manifest, basePath: string) => {
    // console.log('[App] Loading manifest with basePath:', basePath);
    // console.log('[App] Manifest tracks:', manifest.tracks.map(t => t.type));
    
    try {
      // Stop any existing playback first
      masterClock.stop();
      
      setManifest(manifest);
      // console.log('[App] Setting duration from manifest:', manifest.duration_ms, 'ms');
      setDuration(manifest.duration_ms);
      
      // Reset error states
      setErrors([]);
      setError(null);
      
      // Don't initialize master clock yet - wait for managers to be ready
      
      // Wait for managers to be initialized after manifest is set
      await new Promise(resolve => setTimeout(resolve, 500)); // Increase wait time
      
      // Check if managers were actually created
      // console.log('[App] Manager status after wait:', {
      //   video: !!videoManagerRef.current,
      //   audio: !!audioManagerRef.current,
      //   subtitle: !!subtitleManagerRef.current,
      //   html: !!htmlManagerRef.current
      // });
    
    // Load all tracks
    // console.log('[App] Loading all media tracks');
    const videoTrack = manifest.tracks.find(t => t.type === 'video');
    const audioTrack = manifest.tracks.find(t => t.type === 'audio');
    const subtitleTrack = manifest.tracks.find(t => t.type === 'subtitle');
    const htmlTrack = manifest.tracks.find(t => t.type === 'html');
    
    const newTracksLoaded = { ...tracksLoaded };
    const newErrors: string[] = [];
    
    if (videoTrack) {
      // console.log('[App] Loading video track, items:', videoTrack.items.length);
      // console.log('[App] First video item file:', videoTrack.items[0]?.file);
      // console.log('[App] VideoManager ref:', videoManagerRef.current);
      
      if (videoManagerRef.current) {
        try {
          await videoManagerRef.current.load(videoTrack.items, basePath);
          newTracksLoaded.video = true;
          // console.log('[App] Video track loaded successfully');
        } catch (err) {
          newErrors.push(`Video load error: ${(err as Error).message}`);
          console.error('[App] Failed to load video track:', err);
        }
      } else {
        const errorMsg = 'VideoManager not initialized';
        newErrors.push(errorMsg);
        console.error('[App]', errorMsg);
      }
    } else {
      // console.log('[App] No video track in manifest');
    }
    
    // Re-enable audio track loading
    if (audioTrack && audioManagerRef.current) {
      // console.log('[App] Loading audio track, items:', audioTrack.items.length);
      // console.log('[App] Audio track first item:', audioTrack.items[0]);
      
      try {
        await audioManagerRef.current.load(audioTrack.items, basePath);
        newTracksLoaded.audio = true;
        // console.log('[App] Audio track loaded successfully');
      } catch (err) {
        const errorMsg = `Audio load error: ${(err as Error).message}`;
        newErrors.push(errorMsg);
        console.error('[App] Failed to load audio track:', err);
        // Continue loading other tracks even if audio fails
        // console.log('[App] Continuing without audio...');
      }
    } else {
      // console.log('[App] No audio track in manifest or audio manager not ready');
    }
    
    // Re-enable HTML track loading
    if (htmlTrack && htmlManagerRef.current) {
      // console.log('[App] Loading HTML track, items:', htmlTrack.items.length);
      
      try {
        await htmlManagerRef.current.load(htmlTrack.items, basePath);
        newTracksLoaded.html = true;
        // console.log('[App] HTML track loaded successfully');
      } catch (err) {
        newErrors.push(`HTML load error: ${(err as Error).message}`);
        console.error('[App] Failed to load HTML track:', err);
      }
    }
    
    // Re-enable subtitle track loading
    if (subtitleTrack && subtitleManagerRef.current) {
      // console.log('[App] Loading subtitle track, items:', subtitleTrack.items.length);
      
      try {
        await subtitleManagerRef.current.load(subtitleTrack.items, basePath);
        newTracksLoaded.subtitle = true;
        // console.log('[App] Subtitle track loaded successfully');
      } catch (err) {
        newErrors.push(`Subtitle load error: ${(err as Error).message}`);
        console.error('[App] Failed to load subtitle track:', err);
      }
    }
    
    setTracksLoaded(newTracksLoaded);
    setErrors(newErrors);
    
    // console.log('[App] Manifest loading complete. Tracks loaded:', newTracksLoaded);
    if (newErrors.length > 0) {
      console.error('[App] Errors during loading:', newErrors);
    }
    
    // Now initialize master clock after everything is loaded
    // console.log('[App] Initializing master clock with duration:', manifest.duration_ms);
    masterClock.initialize(manifest.duration_ms);
    
    // Wait longer before triggering initial sync to ensure everything is ready
    // console.log('[App] Waiting 1 second before initial sync...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Trigger initial sync to display content at time 0
    // console.log('[App] Syncing all media managers');
    // console.log('[App] Current managers state:', {
    //   video: !!videoManagerRef.current,
    //   audio: !!audioManagerRef.current,
    //   subtitle: !!subtitleManagerRef.current,
    //   html: !!htmlManagerRef.current
    // });
    
    // Sync video manager
    if (videoManagerRef.current) {
      // console.log('[App] Syncing video manager');
      try {
        videoManagerRef.current.sync(0, 1.0);
        // Force a visibility check
        const videoElement = videoManagerRef.current.getElement();
        if (videoElement) {
          const videoEl = (videoElement as HTMLDivElement).querySelector('video');
          if (videoEl) {
            // console.log('[App] Video element check:', {
            //   exists: true,
            //   src: videoEl.src,
            //   display: videoEl.style.display,
            //   visibility: videoEl.style.visibility,
            //   dimensions: { width: videoEl.offsetWidth, height: videoEl.offsetHeight }
            // });
          }
        }
      } catch (err) {
        console.error('[App] Error syncing video manager:', err);
      }
    }
    
    // Sync audio manager
    if (audioManagerRef.current) {
      // console.log('[App] Syncing audio manager');
      try {
        audioManagerRef.current.sync(0, 1.0);
      } catch (err) {
        console.error('[App] Error syncing audio manager:', err);
      }
    }
    
    // Sync subtitle manager
    if (subtitleManagerRef.current) {
      // console.log('[App] Syncing subtitle manager');
      try {
        subtitleManagerRef.current.sync(0, 1.0);
      } catch (err) {
        console.error('[App] Error syncing subtitle manager:', err);
      }
    }
    
    // Sync HTML manager
    if (htmlManagerRef.current) {
      // console.log('[App] Syncing HTML manager');
      try {
        htmlManagerRef.current.sync(0, 1.0);
      } catch (err) {
        console.error('[App] Error syncing HTML manager:', err);
      }
    }
    
    // console.log('[App] All managers synced successfully')
    } catch (error) {
      console.error('[App] Critical error in loadManifest:', error);
      setError(`Failed to load manifest: ${error}`);
      setIsLoading(false);
    }
  };
  
  const handlePlay = () => {
    if (isPlaying) {
      masterClock.pause();
    } else {
      masterClock.play();
    }
  };
  
  const handleSeek = (time: number) => {
    // console.log('[App] handleSeek called with time:', time, 'ms (', (time/1000).toFixed(1), 's)');
    // console.log('[App] Current duration:', duration, 'ms');
    masterClock.seek(time);
  };
  
  const handlePlaybackRateChange = (rate: number) => {
    masterClock.setPlaybackRate(rate);
  };
  
  const handleStop = () => {
    masterClock.stop();
  };
  
  return (
    <div className="app">
      {!manifest ? (
        <div className="welcome-screen">
          <h1>CBT Multimedia Sync</h1>
          <p>Synchronized playback of videos, audio, subtitles, and HTML content</p>
          <div className="welcome-actions">
            <button onClick={handleOpenContent} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Open Content Package'}
            </button>
            <button onClick={handleLoadSample} disabled={isLoading}>
              Load Sample Content
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
      ) : (
        <>
          <div className="header">
            <h2>{manifest.metadata?.title || 'Untitled Content'}</h2>
            <button onClick={handleOpenContent} className="load-button">
              Load Different Content
            </button>
            <button onClick={() => setShowDebug(!showDebug)} className="debug-toggle">
              {showDebug ? 'Hide' : 'Show'} Debug
            </button>
          </div>
          
          <MediaViewer ref={mediaViewerRef} />
          
          {showDebug && (
            <DebugPanel
              debugInfo={{
                currentTime,
                duration,
                playbackRate,
                isPlaying,
                tracksLoaded,
                errors,
              }}
              onClose={() => setShowDebug(false)}
            />
          )}
          
          <div className="controls-container">
            <EnhancedTimeline
              currentTime={currentTime}
              duration={duration}
              bufferedPercent={videoManagerRef.current?.getBufferedPercent?.() || 0}
              onSeek={handleSeek}
              onSeekStart={() => {/* console.log('[App] Seek started') */}}
              onSeekEnd={() => {/* console.log('[App] Seek ended') */}}
            />
            
            <PlayerControls
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              onPlay={handlePlay}
              onStop={handleStop}
              onPlaybackRateChange={handlePlaybackRateChange}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default App;