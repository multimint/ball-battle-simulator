import { useEffect, useRef } from 'react';
import { ARENA_SIZE } from '../constants/gameConstants';

export function useCanvasScale(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  nativeWidth: number = ARENA_SIZE,
  nativeHeight: number = ARENA_SIZE,
): void {
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    function updateScale(): void {
      if (!canvas || !container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const scale = Math.min(cw / nativeWidth, ch / nativeHeight);
      canvas.style.transform = `scale(${scale})`;
      canvas.style.transformOrigin = 'top left';
      container.style.width = `${nativeWidth * scale}px`;
      container.style.height = `${nativeHeight * scale}px`;
    }

    observerRef.current = new ResizeObserver(updateScale);
    observerRef.current.observe(container.parentElement ?? container);
    updateScale();

    return () => {
      observerRef.current?.disconnect();
    };
  }, [canvasRef, containerRef, nativeWidth, nativeHeight]);
}
