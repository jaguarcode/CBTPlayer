import React from 'react';
import './PlayerControls.css';

interface PlayerControlsProps {
  isPlaying: boolean;
  playbackRate: number;
  onPlay: () => void;
  onStop: () => void;
  onPlaybackRateChange: (rate: number) => void;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  playbackRate,
  onPlay,
  onStop,
  onPlaybackRateChange,
}) => {
  const playbackRates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  
  return (
    <div className="player-controls">
      <div className="controls-left">
        <button className="control-button play-button" onClick={onPlay}>
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        
        <button className="control-button stop-button" onClick={onStop}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        </button>
      </div>
      
      <div className="controls-center">
        <span className="playback-rate-label">Speed:</span>
        <div className="playback-rate-buttons">
          {playbackRates.map(rate => (
            <button
              key={rate}
              className={`rate-button ${playbackRate === rate ? 'active' : ''}`}
              onClick={() => onPlaybackRateChange(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
      
      <div className="controls-right">
        <div className="sync-indicator">
          <span className="sync-dot"></span>
          <span className="sync-label">Synced</span>
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;