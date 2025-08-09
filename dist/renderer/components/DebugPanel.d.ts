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
declare const DebugPanel: React.FC<DebugPanelProps>;
export default DebugPanel;
//# sourceMappingURL=DebugPanel.d.ts.map