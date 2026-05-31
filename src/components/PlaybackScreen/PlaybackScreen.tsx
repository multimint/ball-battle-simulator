import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import ControlPanel from './ControlPanel';
import { useIsMobile } from '../../hooks/useIsMobile';
import { CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT } from '../../constants/gameConstants';

export default function PlaybackScreen() {
  const preSimBlob = useGameStore((s) => s.preSimBlob);
  const videoRef   = useRef<HTMLVideoElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isEnded,   setIsEnded]   = useState(false);
  const isMobile = useIsMobile();

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

  function handleReplay() { setIsEnded(false); }

  // ── Mobile: video fills top flex-1, panel pinned at bottom ───────────
  if (isMobile) {
    return (
      <div
        style={{
          width: '100%',
          height: '100svh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d0d1a',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            playsInline
            controls
            style={{
              height: '100%',
              width: 'auto',
              aspectRatio: `${CAPTURE_CANVAS_WIDTH} / ${CAPTURE_CANVAS_HEIGHT}`,
              display: 'block',
            }}
            onEnded={() => setIsEnded(true)}
          />
        </div>

        <ControlPanel
          videoRef={videoRef}
          isEnded={isEnded}
          onReplay={handleReplay}
          isMobile
        />
      </div>
    );
  }

  // ── Desktop: video + panel side by side ───────────────────────────────
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
        <video
          ref={videoRef}
          playsInline
          controls
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

        <ControlPanel
          videoRef={videoRef}
          isEnded={isEnded}
          onReplay={handleReplay}
        />
      </div>
    </div>
  );
}
