import { useRef, useState } from 'react';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface VideoExportHook {
  isSupported: boolean;
  hasVideo: boolean;
  startAutoRecord: (width: number, height: number, fps: number) => void;
  captureFrame: (canvas: HTMLCanvasElement, timestampMs: number) => void;
  stopAutoRecord: () => void;
  exportVideo: () => void;
}

export function useVideoExport(): VideoExportHook {
  const isSupported =
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined';

  const encoderRef = useRef<VideoEncoder | null>(null);
  const muxerRef = useRef<Muxer<ArrayBufferTarget> | null>(null);
  const targetRef = useRef<ArrayBufferTarget | null>(null);
  const videoBlobRef = useRef<Blob | null>(null);

  const isRecordingRef = useRef(false);
  const fpsRef = useRef(60);
  const frameCountRef = useRef(0);

  const [hasVideo, setHasVideo] = useState(false);

  function startAutoRecord(width: number, height: number, fps: number): void {
    if (!isSupported) return;
    try {
      fpsRef.current = fps;
      frameCountRef.current = 0;
      videoBlobRef.current = null;
      setHasVideo(false);

      const target = new ArrayBufferTarget();
      targetRef.current = target;

      const muxer = new Muxer({
        target,
        video: { codec: 'avc', width, height, frameRate: fps },
        // 'in-memory' writes the moov box to the front so the file is
        // immediately seekable and has correct duration metadata.
        fastStart: 'in-memory',
      });
      muxerRef.current = muxer;

      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('VideoEncoder error:', e),
      });

      encoder.configure({
        codec: 'avc1.4D0029',  // H.264 Main Profile Level 4.1 — broad compatibility
        width,
        height,
        bitrate: 10_000_000,   // 10 Mbps for 60fps
        framerate: fps,
      });

      encoderRef.current = encoder;
      isRecordingRef.current = true;
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }

  // Called from the game loop on every RAF tick.
  // Uses a monotonic counter for perfectly even frame timestamps — no RAF jitter.
  function captureFrame(canvas: HTMLCanvasElement, _timestampMs: number): void {
    if (!isRecordingRef.current) return;
    const encoder = encoderRef.current;
    if (!encoder || encoder.state === 'closed') return;
    // Only back-pressure if encoder is severely behind (large buffer = OOM risk)
    if (encoder.encodeQueueSize > 60) return;

    const fps = fpsRef.current;
    const count = frameCountRef.current;
    // Perfect monotonic timestamps — evenly spaced regardless of RAF jitter
    const durationUs = Math.round(1_000_000 / fps);
    const timestampUs = count * durationUs;

    try {
      const frame = new VideoFrame(canvas, { timestamp: timestampUs, duration: durationUs });
      // I-frame every 2 s for seekability
      const keyFrame = count % (fps * 2) === 0;
      encoder.encode(frame, { keyFrame });
      frame.close();
      frameCountRef.current++;
    } catch (err) {
      console.warn('captureFrame skipped:', err);
    }
  }

  function stopAutoRecord(): void {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    const encoder = encoderRef.current;
    const muxer = muxerRef.current;
    const target = targetRef.current;

    encoderRef.current = null;
    muxerRef.current = null;
    targetRef.current = null;

    if (!encoder || !muxer || !target) return;

    encoder.flush()
      .then(() => {
        muxer.finalize();
        encoder.close();
        videoBlobRef.current = new Blob([target.buffer], { type: 'video/mp4' });
        setHasVideo(true);
      })
      .catch((err) => console.error('Failed to stop recording:', err));
  }

  function exportVideo(): void {
    const blob = videoBlobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ball-battle-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { isSupported, hasVideo, startAutoRecord, captureFrame, stopAutoRecord, exportVideo };
}
