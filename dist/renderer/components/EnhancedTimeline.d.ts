import React from 'react';
import '../styles/EnhancedTimeline.css';
interface EnhancedTimelineProps {
    currentTime: number;
    duration: number;
    bufferedPercent?: number;
    markers?: Array<{
        time: number;
        label: string;
        color?: string;
    }>;
    onSeek: (time: number) => void;
    onSeekStart?: () => void;
    onSeekEnd?: () => void;
}
declare const EnhancedTimeline: React.FC<EnhancedTimelineProps>;
export default EnhancedTimeline;
//# sourceMappingURL=EnhancedTimeline.d.ts.map