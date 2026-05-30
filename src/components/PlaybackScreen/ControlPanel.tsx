import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';

const SPEED_STEPS = [0.25, 0.5, 1, 1.5, 2, 4];
const RETRO = '"Press Start 2P", monospace';

interface ControlPanelProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isEnded: boolean;
  onReplay: () => void;
  isMobile?: boolean;
}

export default function ControlPanel({ videoRef, isEnded, onReplay, isMobile }: ControlPanelProps) {
  const teamA              = useGameStore((s) => s.teamA);
  const teamB              = useGameStore((s) => s.teamB);
  const preSimBlob         = useGameStore((s) => s.preSimBlob);
  const simulationResult   = useGameStore((s) => s.simulationResult);
  const initialVelocities  = useGameStore((s) => s.initialVelocities);
  const startNewSimulation = useGameStore((s) => s.startNewSimulation);
  const resetToSetup       = useGameStore((s) => s.resetToSetup);

  const [speed, setSpeed]           = useState(1);
  const [isExporting, setExporting] = useState(false);

  function handleSpeed(val: number) {
    setSpeed(val);
    if (videoRef.current) videoRef.current.playbackRate = val;
  }

  function handleReplay() {
    onReplay();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  }

  function handleExport() {
    if (!initialVelocities || isExporting) return;
    setExporting(true);

    const worker = new Worker(
      new URL('../../simulation/simulator.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'complete') {
        const blob = new Blob([e.data.buffer as ArrayBuffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ball-battle-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        worker.terminate();
        setExporting(false);
      } else if (e.data.type === 'error') {
        console.error('HD export error:', e.data.message);
        worker.terminate();
        setExporting(false);
      }
    };

    worker.onerror = () => { worker.terminate(); setExporting(false); };
    worker.postMessage({ teamA, teamB, initialVelocities, fps: 60, bitrate: 20_000_000 });
  }

  const winner     = simulationResult?.winner;
  const winnerName = winner === 'A' ? teamA.name : winner === 'B' ? teamB.name : null;
  const winnerColor = winner === 'A' ? '#E47D79' : winner === 'B' ? '#4A90E2' : '#888';
  const isDraw     = winner === 'draw';

  // ── Mobile: compact bottom bar ────────────────────────────────────────
  if (isMobile) {
    return (
      <div
        style={{
          width: '100%',
          background: '#FFFADE',
          borderTop: '1.5px solid rgba(1,0,107,0.10)',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* Actions — 4 buttons in one row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
          <button onClick={handleReplay} style={mobileBtn('#01006B')}>▶ REPLAY</button>
          <button
            onClick={handleExport}
            disabled={!initialVelocities || isExporting}
            style={{ ...mobileBtn('#1a7a1a'), opacity: (initialVelocities && !isExporting) ? 1 : 0.4, cursor: (initialVelocities && !isExporting) ? 'pointer' : 'not-allowed' }}
          >
            {isExporting ? '⏳ HD...' : '📤 SAVE'}
          </button>
          <button onClick={startNewSimulation} style={mobileBtn('#B91C1C')}>🎲 NEW</button>
          <button
            onClick={resetToSetup}
            style={{
              fontFamily: RETRO,
              fontSize: 9,
              padding: '10px 0',
              textAlign: 'center' as const,
              borderRadius: 6,
              border: '1.5px solid rgba(1,0,107,0.15)',
              background: 'transparent',
              color: 'rgba(1,0,107,0.50)',
              cursor: 'pointer',
            }}
          >
            ← BACK
          </button>
        </div>
      </div>
    );
  }

  // ── Desktop: vertical sidebar ─────────────────────────────────────────
  const sectionLabel: React.CSSProperties = {
    fontFamily: RETRO,
    fontSize: 9,
    color: 'rgba(1,0,107,0.40)',
    letterSpacing: '0.08em',
    marginBottom: 8,
  };

  const divider: React.CSSProperties = {
    height: 1,
    background: 'rgba(1,0,107,0.08)',
    margin: '14px 0',
  };

  return (
    <div
      style={{
        width: 220,
        minWidth: 220,
        height: '100%',
        background: '#FFFADE',
        borderLeft: '1.5px solid rgba(1,0,107,0.10)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 16px',
        overflowY: 'auto',
      }}
    >
      <p style={{ ...sectionLabel, marginBottom: 16, fontSize: 10, color: 'rgba(1,0,107,0.55)' }}>
        CONTROLS
      </p>

      {simulationResult && (
        <>
          <div
            style={{
              border: `1.5px solid ${winnerColor}55`,
              borderRadius: 10,
              padding: '12px 10px',
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 4 }}>{isDraw ? '🤝' : '🏆'}</div>
            {isDraw ? (
              <p style={{ fontFamily: RETRO, fontSize: 9, color: '#888', marginBottom: 2 }}>IT'S A DRAW</p>
            ) : (
              <>
                <p style={{ fontFamily: RETRO, fontSize: 9, color: 'rgba(1,0,107,0.4)', marginBottom: 4 }}>WINNER</p>
                <p style={{ fontFamily: RETRO, fontSize: 11, color: winnerColor, marginBottom: 2 }}>{winnerName}</p>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: RETRO, fontSize: 8, color: 'rgba(1,0,107,0.35)', marginBottom: 2 }}>{teamA.name}</p>
                <p style={{ fontFamily: RETRO, fontSize: 10, color: '#E47D79' }}>{simulationResult.damageDealt.A}</p>
                <p style={{ fontFamily: RETRO, fontSize: 8, color: 'rgba(1,0,107,0.3)' }}>DMG</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: RETRO, fontSize: 8, color: 'rgba(1,0,107,0.35)', marginBottom: 2 }}>{teamB.name}</p>
                <p style={{ fontFamily: RETRO, fontSize: 10, color: '#4A90E2' }}>{simulationResult.damageDealt.B}</p>
                <p style={{ fontFamily: RETRO, fontSize: 8, color: 'rgba(1,0,107,0.3)' }}>DMG</p>
              </div>
            </div>
          </div>
          <div style={divider} />
        </>
      )}

      <p style={sectionLabel}>SPEED</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {SPEED_STEPS.map((s) => (
          <button
            key={s}
            onClick={() => handleSpeed(s)}
            style={{
              fontFamily: RETRO,
              fontSize: 9,
              padding: '7px 0',
              textAlign: 'center' as const,
              borderRadius: 6,
              border: speed === s ? '1.5px solid #01006B' : '1.5px solid rgba(1,0,107,0.15)',
              background: speed === s ? '#01006B' : 'transparent',
              color: speed === s ? '#FFFADE' : 'rgba(1,0,107,0.55)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {s}×
          </button>
        ))}
      </div>

      <div style={divider} />

      <button
        onClick={handleReplay}
        style={{ ...filledBtn('#01006B'), marginBottom: 8 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        ▶ REPLAY
      </button>

      <button
        onClick={handleExport}
        disabled={!initialVelocities || isExporting}
        style={{ ...filledBtn('#1a7a1a'), marginBottom: 8, opacity: (initialVelocities && !isExporting) ? 1 : 0.4, cursor: (initialVelocities && !isExporting) ? 'pointer' : 'not-allowed' }}
        onMouseEnter={(e) => { if (initialVelocities && !isExporting) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = (initialVelocities && !isExporting) ? '1' : '0.4'; }}
      >
        {isExporting ? '⏳ EXPORTING HD...' : '📤 EXPORT MP4'}
      </button>

      <button
        onClick={startNewSimulation}
        style={filledBtn('#B91C1C')}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        🎲 SIMULATE AGAIN
      </button>

      <div style={divider} />

      <button
        onClick={resetToSetup}
        style={{
          fontFamily: RETRO,
          fontSize: 9,
          padding: '10px 12px',
          borderRadius: 8,
          border: '1.5px solid rgba(1,0,107,0.15)',
          background: 'transparent',
          color: 'rgba(1,0,107,0.45)',
          cursor: 'pointer',
          width: '100%',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(1,0,107,0.06)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        ← BACK TO SETUP
      </button>
    </div>
  );
}

function mobileBtn(bg: string): React.CSSProperties {
  return {
    fontFamily: RETRO,
    fontSize: 9,
    padding: '10px 0',
    textAlign: 'center' as const,
    borderRadius: 6,
    border: 'none',
    background: bg,
    color: '#FFFADE',
    cursor: 'pointer',
  };
}

function filledBtn(bg: string): React.CSSProperties {
  return {
    fontFamily: RETRO,
    fontSize: 9,
    padding: '10px 12px',
    borderRadius: 8,
    border: 'none',
    background: bg,
    color: '#FFFADE',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'opacity 0.15s',
  };
}
