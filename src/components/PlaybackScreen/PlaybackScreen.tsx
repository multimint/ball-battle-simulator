import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import ControlPanel from './ControlPanel';
import { CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT } from '../../constants/gameConstants';

export default function PlaybackScreen() {
  const preSimBlob = useGameStore((s) => s.preSimBlob);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    if (!preSimBlob) return;
    const url = URL.createObjectURL(preSimBlob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preSimBlob]);

  useEffect(() => {
    if (!objectUrl || !videoRef.current) return;
    videoRef.current.src = objectUrl;
    videoRef.current.load();
    videoRef.current.play().catch(() => {/* autoplay may be blocked */});
  }, [objectUrl]);

  function handleReplay() {
    setIsEnded(false);
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100svh',
        background: 'var(--color-bg, #FFFADE)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Centered group: video + panel side by side */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          height: '100%',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 4px 40px rgba(1,0,107,0.13)',
        }}
      >
        {/* Fight video */}
        <video
          ref={videoRef}
          playsInline
          style={{
            height: '100%',
            width: 'auto',
            aspectRatio: `${CAPTURE_CANVAS_WIDTH} / ${CAPTURE_CANVAS_HEIGHT}`,
            objectFit: 'contain',
            display: 'block',
            imageRendering: 'crisp-edges',
          }}
          onEnded={() => setIsEnded(true)}
        />

        {/* Control panel directly next to video */}
        <ControlPanel
          videoRef={videoRef}
          isEnded={isEnded}
          onReplay={handleReplay}
        />
      </div>
    </div>
  );
}
