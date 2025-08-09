import React, { useRef, useState, useEffect, useCallback } from 'react';
import '../styles/EnhancedTimeline.css';
import { masterClock } from '../services/MasterClock';

interface EnhancedTimelineProps {
  currentTime: number;
  duration: number;
  bufferedPercent?: number;
  markers?: Array<{ time: number; label: string; color?: string }>;
  onSeek: (time: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
}

const EnhancedTimeline: React.FC<EnhancedTimelineProps> = ({
  currentTime,
  duration,
  bufferedPercent = 0,
  markers = [],
  onSeek,
  onSeekStart,
  onSeekEnd,
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekError, setSeekError] = useState<string | null>(null);
  const lastSeekTimeRef = useRef<number>(0);
  const currentSeekPromiseRef = useRef<Promise<void> | null>(null);
  
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const calculatePosition = (clientX: number): number => {
    if (!progressBarRef.current) return 0;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage;
  };
  
  // Debounced seek function to prevent spam - uses MasterClock coordination
  const debouncedSeek = useCallback((time: number) => {
    // Prevent duplicate seeks to same time
    if (Math.abs(time - lastSeekTimeRef.current) < 10) { // Within 10ms
      return;
    }
    lastSeekTimeRef.current = time;
    
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set preview time for immediate UI feedback
    setPreviewTime(time);
    
    // Use MasterClock for coordinated seek instead of individual manager calls
    debounceTimeoutRef.current = setTimeout(() => {
      // If there's a pending seek, wait for it
      if (currentSeekPromiseRef.current) {
        return;
      }
      
      setIsSeeking(true);
      setSeekError(null);
      
      const seekPromise = masterClock.seek(time);
      currentSeekPromiseRef.current = seekPromise;
      
      seekPromise.then(() => {
        console.log('[EnhancedTimeline] MasterClock coordinated seek completed');
        setPreviewTime(null);
        setIsSeeking(false);
        currentSeekPromiseRef.current = null;
      }).catch((error) => {
        console.error('[EnhancedTimeline] MasterClock coordinated seek failed:', error);
        setPreviewTime(null);
        setIsSeeking(false);
        currentSeekPromiseRef.current = null;
        
        // Don't retry on interruption errors
        if (!error?.message?.includes('interrupted')) {
          setSeekError('Seek failed');
          // Only retry for real failures, not interruptions
          setTimeout(() => {
            onSeek(time);
            setSeekError(null);
          }, 500);
        }
      });
    }, 150); // Slightly increased debounce for stability
  }, [onSeek]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    onSeekStart?.();
    
    const percentage = calculatePosition(e.clientX);
    const newTime = percentage * duration;
    
    // Use debounced seek for initial click too
    debouncedSeek(newTime);
  }, [duration, debouncedSeek, onSeekStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!progressBarRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const isOverBar = e.clientY >= rect.top && e.clientY <= rect.bottom &&
                      e.clientX >= rect.left && e.clientX <= rect.right;
    
    if (isOverBar || isDragging) {
      const percentage = calculatePosition(e.clientX);
      const time = percentage * duration;
      setHoverTime(time);
      setHoverPosition(percentage * 100);
      
      if (isDragging) {
        // Use debounced seek instead of immediate seek
        debouncedSeek(time);
      }
    } else {
      setHoverTime(null);
    }
  }, [isDragging, duration, debouncedSeek]);
  
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // Clear any pending debounced seek and execute final seek immediately
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      // Execute final seek if there's a preview time using MasterClock coordination
      if (previewTime !== null && !currentSeekPromiseRef.current) {
        setIsSeeking(true);
        setSeekError(null);
        
        const seekPromise = masterClock.seek(previewTime);
        currentSeekPromiseRef.current = seekPromise;
        
        seekPromise.then(() => {
          console.log('[EnhancedTimeline] Final MasterClock seek completed');
          setIsSeeking(false);
          currentSeekPromiseRef.current = null;
        }).catch((error) => {
          console.error('[EnhancedTimeline] Final MasterClock seek failed:', error);
          setIsSeeking(false);
          currentSeekPromiseRef.current = null;
          
          // Don't retry on interruption errors
          if (!error?.message?.includes('interrupted')) {
            setSeekError('Seek failed');
            setTimeout(() => {
              onSeek(previewTime);
              setSeekError(null);
            }, 500);
          }
        });
        setPreviewTime(null);
      }
      
      setIsDragging(false);
      onSeekEnd?.();
    }
  }, [isDragging, onSeekEnd, previewTime, onSeek]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  // Calculate chapter segments based on video transitions
  const chapters = markers.length > 0 ? markers : [
    { time: 0, label: 'Intro', color: '#4CAF50' },
    { time: 30000, label: 'Main Content', color: '#2196F3' },
    { time: 60000, label: 'Outro', color: '#FF9800' },
  ];
  
  return (
    <div className="enhanced-timeline">
      <div className="timeline-info">
        <span className="time-current">{formatTime(currentTime)}</span>
        <span className="time-duration">{formatTime(duration)}</span>
      </div>
      
      <div 
        ref={progressBarRef}
        className={`timeline-bar ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setHoverTime(0)}
        onMouseLeave={() => !isDragging && setHoverTime(null)}
      >
        {/* Chapter segments */}
        <div className="chapters-container">
          {chapters.map((chapter, index) => {
            const nextChapter = chapters[index + 1];
            const startPercent = (chapter.time / duration) * 100;
            const endPercent = nextChapter 
              ? (nextChapter.time / duration) * 100 
              : 100;
            const width = endPercent - startPercent;
            
            return (
              <div
                key={index}
                className="chapter-segment"
                style={{
                  left: `${startPercent}%`,
                  width: `${width}%`,
                  backgroundColor: chapter.color,
                  opacity: 0.2,
                }}
                title={chapter.label}
              />
            );
          })}
        </div>
        
        {/* Buffered progress */}
        <div 
          className="timeline-buffered"
          style={{ width: `${bufferedPercent}%` }}
        />
        
        {/* Progress */}
        <div 
          className="timeline-progress"
          style={{ width: `${progressPercentage}%` }}
        >
          <div className="timeline-handle" />
        </div>
        
        {/* Markers */}
        {markers.map((marker, index) => (
          <div
            key={index}
            className="timeline-marker"
            style={{
              left: `${(marker.time / duration) * 100}%`,
              backgroundColor: marker.color || '#FFF',
            }}
            title={marker.label}
          />
        ))}
        
        {/* Hover indicator */}
        {hoverTime !== null && (
          <>
            <div 
              className="timeline-hover-line"
              style={{ left: `${hoverPosition}%` }}
            />
            <div 
              className="timeline-hover-time"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          </>
        )}
      </div>
      
      {/* Chapter labels */}
      <div className="chapters-labels">
        {chapters.map((chapter, index) => (
          <div
            key={index}
            className="chapter-label"
            style={{
              left: `${(chapter.time / duration) * 100}%`,
            }}
            onClick={() => {
              setIsSeeking(true);
              setSeekError(null);
              
              masterClock.seek(chapter.time).then(() => {
                console.log('[EnhancedTimeline] Chapter seek completed:', chapter.label);
                setIsSeeking(false);
              }).catch((error) => {
                console.error('[EnhancedTimeline] Chapter seek failed:', error);
                setSeekError('Seek failed - retrying...');
                setIsSeeking(false);
                
                // Retry with fallback
                setTimeout(() => {
                  onSeek(chapter.time);
                  setSeekError(null);
                }, 500);
              });
            }}
          >
            {chapter.label}
          </div>
        ))}
      </div>
      
      {/* Seek status indicator */}
      {(isSeeking || seekError) && (
        <div className="seek-status">
          {isSeeking && (
            <div className="seek-loading">
              <span className="seek-spinner"></span>
              <span>Seeking...</span>
            </div>
          )}
          {seekError && (
            <div className="seek-error">
              {seekError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedTimeline;