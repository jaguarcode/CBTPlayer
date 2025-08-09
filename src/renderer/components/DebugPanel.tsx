import React from 'react';
import './DebugPanel.css';

interface DebugInfo {
  currentTime: number;
  duration: number;
  playbackRate: number;
  isPlaying: boolean;
  tracksLoaded: {
    video: boolean;
    audio: boolean;
    subtitle: boolean;
    html: boolean;
  };
  errors: string[];
}

interface DebugPanelProps {
  debugInfo: DebugInfo;
  onClose?: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ debugInfo, onClose }) => {
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor(ms % 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };
  
  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h3>Debug Information</h3>
        {onClose && (
          <button className="debug-close" onClick={onClose}>×</button>
        )}
      </div>
      
      <div className="debug-content">
        <div className="debug-section">
          <h4>Playback Status</h4>
          <div className="debug-item">
            <span className="debug-label">Current Time:</span>
            <span className="debug-value">{formatTime(debugInfo.currentTime)}</span>
          </div>
          <div className="debug-item">
            <span className="debug-label">Duration:</span>
            <span className="debug-value">{formatTime(debugInfo.duration)}</span>
          </div>
          <div className="debug-item">
            <span className="debug-label">Playback Rate:</span>
            <span className="debug-value">{debugInfo.playbackRate}x</span>
          </div>
          <div className="debug-item">
            <span className="debug-label">Is Playing:</span>
            <span className={`debug-value ${debugInfo.isPlaying ? 'playing' : 'paused'}`}>
              {debugInfo.isPlaying ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
        
        <div className="debug-section">
          <h4>Tracks Loaded</h4>
          <div className="debug-item">
            <span className="debug-label">Video:</span>
            <span className={`debug-value ${debugInfo.tracksLoaded.video ? 'loaded' : 'not-loaded'}`}>
              {debugInfo.tracksLoaded.video ? '✓' : '✗'}
            </span>
          </div>
          <div className="debug-item">
            <span className="debug-label">Audio:</span>
            <span className={`debug-value ${debugInfo.tracksLoaded.audio ? 'loaded' : 'not-loaded'}`}>
              {debugInfo.tracksLoaded.audio ? '✓' : '✗'}
            </span>
          </div>
          <div className="debug-item">
            <span className="debug-label">Subtitle:</span>
            <span className={`debug-value ${debugInfo.tracksLoaded.subtitle ? 'loaded' : 'not-loaded'}`}>
              {debugInfo.tracksLoaded.subtitle ? '✓' : '✗'}
            </span>
          </div>
          <div className="debug-item">
            <span className="debug-label">HTML:</span>
            <span className={`debug-value ${debugInfo.tracksLoaded.html ? 'loaded' : 'not-loaded'}`}>
              {debugInfo.tracksLoaded.html ? '✓' : '✗'}
            </span>
          </div>
        </div>
        
        {debugInfo.errors.length > 0 && (
          <div className="debug-section">
            <h4>Errors</h4>
            <div className="debug-errors">
              {debugInfo.errors.map((error, index) => (
                <div key={index} className="debug-error">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;