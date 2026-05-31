// @ts-nocheck — file retained for reference; no longer mounted by App.tsx
import React, { useEffect, useState } from 'react';
import { Sprite } from '../../sprites';
import { useGameStore } from '../../store/useGameStore';
import { useMatchStore } from '../../store/useMatchStore';
import { Button } from '../ui/Button';
import type { VideoExportHook } from '../../hooks/useVideoExport';

interface ResultOverlayProps {
  videoExport: VideoExportHook;
}

export default function ResultOverlay({ videoExport }: ResultOverlayProps) {
  const phase = useGameStore((s) => s.phase);
  const winner = useGameStore((s) => s.winner);
  const teamA = useGameStore((s) => s.teamA);
  const teamB = useGameStore((s) => s.teamB);
  const resetToSetup = useGameStore((s) => s.resetToSetup);
  const resetMatch = useMatchStore((s) => s.resetMatch);
  const damageDealt = useMatchStore((s) => s.damageDealt);

  const [visible, setVisible] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (phase === 'result') {
      setVisible(true);
      setTimeout(() => setAnimate(true), 50);
    } else {
      setAnimate(false);
      setTimeout(() => setVisible(false), 300);
    }
  }, [phase]);

  if (!visible) return null;

  const winnerName =
    winner === 'A' ? teamA.name
    : winner === 'B' ? teamB.name
    : null;

  const winnerColor =
    winner === 'A' ? 'var(--color-teamA)'
    : winner === 'B' ? 'var(--color-teamB)'
    : '#888';

  const isDraw = winner === 'draw';

  function handlePlayAgain(): void {
    resetMatch();
    resetToSetup();
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{
        background: 'rgba(255, 250, 222, 0.85)',
        backdropFilter: 'blur(4px)',
        transition: 'opacity 0.3s',
        opacity: animate ? 1 : 0,
      }}
    >
      <div className="text-center px-6">
        {/* Trophy / icon */}
        <div className="mb-4"><Sprite id={isDraw ? 'scales' : 'trophy'} size={48} /></div>

        {/* Result text */}
        {isDraw ? (
          <>
            <p className="font-retro text-[10px] text-gray-500 mb-1">IT'S A</p>
            <p className="font-retro text-[18px] mb-4" style={{ color: '#888' }}>DRAW!</p>
          </>
        ) : (
          <>
            <p className="font-retro text-[8px] text-gray-500 mb-1">WINNER</p>
            <p
              className="font-retro text-[14px] mb-1"
              style={{ color: winnerColor }}
            >
              {winnerName}
            </p>
            <p className="font-retro text-[8px] mb-4" style={{ color: winnerColor, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <Sprite id={(winner === 'A' ? teamA.ball.icon : teamB.ball.icon) ?? 'ball'} size={16} />
              {winner === 'A' ? teamA.ball.name : teamB.ball.name}
            </p>
          </>
        )}

        {/* Stats */}
        <div className="flex justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="font-retro text-[6px] text-gray-400">{teamA.name} dealt</p>
            <p className="font-retro text-[10px]" style={{ color: 'var(--color-teamA)' }}>
              {damageDealt.A} DMG
            </p>
          </div>
          <div className="text-center">
            <p className="font-retro text-[6px] text-gray-400">{teamB.name} dealt</p>
            <p className="font-retro text-[10px]" style={{ color: 'var(--color-teamB)' }}>
              {damageDealt.B} DMG
            </p>
          </div>
        </div>

        {/* Export Video */}
        {videoExport.isSupported && videoExport.hasVideo && (
          <div className="mb-3">
            <Button variant="primary" size="lg" onClick={videoExport.exportVideo}>
              📤 EXPORT VIDEO
            </Button>
          </div>
        )}

        {/* Play Again */}
        <Button variant="success" size="lg" onClick={handlePlayAgain}>
          🔄 PLAY AGAIN
        </Button>
      </div>
    </div>
  );
}
