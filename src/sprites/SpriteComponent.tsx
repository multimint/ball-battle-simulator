import React, { useRef, useEffect } from 'react';
import type { SpriteKey } from './SpriteKey';
import { SPRITE_PAINTERS } from './spriteDefinitions';

interface SpriteProps {
  id: SpriteKey;
  size: number;
  style?: React.CSSProperties;
}

export function Sprite({ id, size, style }: SpriteProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.scale(size / 24, size / 24);
    SPRITE_PAINTERS[id](ctx);
    ctx.restore();
  }, [id, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    />
  );
}
