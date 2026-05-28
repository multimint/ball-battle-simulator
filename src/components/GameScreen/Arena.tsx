import React, { useRef } from 'react';
import { useCanvasScale } from '../../hooks/useCanvasScale';
import { ARENA_SIZE } from '../../constants/gameConstants';

interface ArenaProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  nativeWidth?: number;
  nativeHeight?: number;
}

export default function Arena({
  canvasRef,
  nativeWidth = ARENA_SIZE,
  nativeHeight = ARENA_SIZE,
}: ArenaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useCanvasScale(canvasRef, containerRef, nativeWidth, nativeHeight);

  return (
    <div
      className="flex items-start justify-center w-full flex-1 overflow-hidden"
      style={{ minHeight: 0 }}
    >
      <div
        ref={containerRef}
        style={{ position: 'relative', flexShrink: 0 }}
      >
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          width={nativeWidth}
          height={nativeHeight}
          style={{
            display: 'block',
            imageRendering: 'crisp-edges',
          }}
        />
      </div>
    </div>
  );
}
