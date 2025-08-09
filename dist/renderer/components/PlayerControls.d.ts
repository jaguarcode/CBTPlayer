import React from 'react';
import './PlayerControls.css';
interface PlayerControlsProps {
    isPlaying: boolean;
    playbackRate: number;
    onPlay: () => void;
    onStop: () => void;
    onPlaybackRateChange: (rate: number) => void;
}
declare const PlayerControls: React.FC<PlayerControlsProps>;
export default PlayerControls;
//# sourceMappingURL=PlayerControls.d.ts.map