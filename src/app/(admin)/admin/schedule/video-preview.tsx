'use client';

import { useState, useRef } from 'react';

interface VideoPreviewProps {
  thumbnailUrl: string | null;
  videoUrl: string | null;
  alt?: string;
  className?: string;
}

export function VideoPreview({ thumbnailUrl, videoUrl, alt, className = '' }: VideoPreviewProps) {
  const [imgError, setImgError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const showImg = !!thumbnailUrl && !imgError;
  const showVideo = !showImg && !!videoUrl && !videoError;

  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      {showImg ? (
        <img
          src={thumbnailUrl!}
          alt={alt ?? 'Thumbnail'}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : showVideo ? (
        <video
          ref={videoRef}
          src={videoUrl!}
          className="h-full w-full object-cover"
          muted
          playsInline
          loop
          preload="metadata"
          onMouseEnter={() => videoRef.current?.play()}
          onMouseLeave={() => {
            videoRef.current?.pause();
            if (videoRef.current) videoRef.current.currentTime = 0;
          }}
          onError={() => setVideoError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xl opacity-20">
          🎾
        </div>
      )}
    </div>
  );
}
