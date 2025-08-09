import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import './MediaViewer.css';

export interface MediaViewerHandle {
  videoContainer: HTMLDivElement | null;
  htmlContainer: HTMLDivElement | null;
}

const MediaViewer = forwardRef<MediaViewerHandle>((props, ref) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const htmlContainerRef = useRef<HTMLDivElement>(null);
  
  useImperativeHandle(ref, () => ({
    videoContainer: videoContainerRef.current,
    htmlContainer: htmlContainerRef.current,
  }));
  
  return (
    <div className="media-viewer">
      <div className="video-section" ref={videoContainerRef}>
        {/* Video and subtitle managers will inject their elements here */}
      </div>
      <div className="html-section" ref={htmlContainerRef}>
        {/* HTML manager will inject its iframe here */}
      </div>
    </div>
  );
});

MediaViewer.displayName = 'MediaViewer';

export default MediaViewer;