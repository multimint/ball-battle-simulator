// @ts-nocheck — file retained for reference; no longer mounted by App.tsx
import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { usePhysicsSetup } from '../../hooks/usePhysicsSetup';
import { useGameLoop } from '../../hooks/useGameLoop';
import { useParticles } from '../../hooks/useParticles';
import { useWeaponSystem } from '../../hooks/useWeaponSystem';
import { useAudio } from '../../hooks/useAudio';
import { useVideoExport } from '../../hooks/useVideoExport';
import { ARENA_SIZE, CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT } from '../../constants/gameConstants';
import TopBar from './TopBar';
import Arena from './Arena';
import BottomHUD from './BottomHUD';
import ResultOverlay from './ResultOverlay';

export default function GameScreen() {
  const teamA = useGameStore((s) => s.teamA);
  const teamB = useGameStore((s) => s.teamB);
  const phase = useGameStore((s) => s.phase);

  // Hidden 480×480 physics canvas (rendered by game loop, not displayed)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Displayed 720×1280 composite capture canvas (shown to user + encoded to MP4)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Physics bodies
  const { engineRef, bodyA, bodyB } = usePhysicsSetup(teamA.ball, teamB.ball);

  // Systems
  const particles = useParticles();
  const weapons = useWeaponSystem();
  const audio = useAudio();
  const videoExport = useVideoExport();

  // Stable ref so the game loop closure always calls the latest captureFrame
  const captureFrameRef = useRef<typeof videoExport.captureFrame | null>(null);
  captureFrameRef.current = videoExport.captureFrame;

  // Auto-start recording on mount (match just began, VideoEncoder+Muxer created)
  useEffect(() => {
    if (videoExport.isSupported) {
      videoExport.startAutoRecord(CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT, 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-stop when match ends (flushes encoder, finalizes MP4)
  useEffect(() => {
    if (phase === 'result') {
      videoExport.stopAutoRecord();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Main game loop — wires everything together
  useGameLoop({
    canvasRef,
    captureCanvasRef,
    captureFrameRef,
    engineRef,
    bodyA,
    bodyB,
    ballA: teamA.ball,
    ballB: teamB.ball,
    weaponA: teamA.weapon,
    weaponB: teamB.weapon,
    particles,
    weapons,
    onAudioCollision: audio.playCollision,
    onAudioKO: audio.playKO,
    onAudioVictory: audio.playVictory,
    onAudioWeaponFire: audio.playWeaponFire,
  });

  return (
    <div
      className="flex flex-col w-full"
      style={{
        height: '100svh',
        background: 'var(--color-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Hidden physics canvas — game loop renders here, not displayed */}
      <canvas
        ref={canvasRef as React.RefObject<HTMLCanvasElement>}
        width={ARENA_SIZE}
        height={ARENA_SIZE}
        style={{ display: 'none' }}
      />

      {/* Top bar (HTML overlay for browser UX) */}
      <div className="flex-shrink-0">
        <TopBar />
      </div>

      {/* Composite capture canvas — 9:16 TikTok frame shown here */}
      <div className="flex-1 relative min-h-0 flex items-center justify-center">
        <Arena
          canvasRef={captureCanvasRef}
          nativeWidth={CAPTURE_CANVAS_WIDTH}
          nativeHeight={CAPTURE_CANVAS_HEIGHT}
        />
        <ResultOverlay videoExport={videoExport} />
      </div>

      {/* Bottom HUD (HTML overlay for browser UX) */}
      <div className="flex-shrink-0">
        <BottomHUD />
      </div>
    </div>
  );
}
