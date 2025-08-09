import React from 'react';
import './Timeline.css';
interface TimelineProps {
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
}
declare const Timeline: React.FC<TimelineProps>;
export default Timeline;
//# sourceMappingURL=Timeline.d.ts.map