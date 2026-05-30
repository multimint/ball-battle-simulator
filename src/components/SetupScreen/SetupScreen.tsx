import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import FighterSelector from './FighterSelector';
import StatsPanel from './StatsPanel';
import { FIGHTER_PRESETS } from '../../constants/fighterPresets';
import {
  CAPTURE_CANVAS_WIDTH,
  CAPTURE_CANVAS_HEIGHT,
} from '../../constants/gameConstants';

const COLOR_A = '#E47D79';
const COLOR_B = '#4A90E2';
const PANEL_W = 220;
const RATIO   = CAPTURE_CANVAS_WIDTH / CAPTURE_CANVAS_HEIGHT;
const RETRO   = '"Press Start 2P", monospace';

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function SetupScreen() {
  const startNewSimulation = useGameStore((s) => s.startNewSimulation);
  const teamA = useGameStore((s) => s.teamA);
  const teamB = useGameStore((s) => s.teamB);
  const isMobile = useIsMobile();

  const fighterA = FIGHTER_PRESETS.find((f) => f.weapon.name === teamA.weapon.name);
  const fighterB = FIGHTER_PRESETS.find((f) => f.weapon.name === teamB.weapon.name);

  const bottomBar = (compact: boolean) => (
    <div
      style={{
        flexShrink: 0,
        borderTop: '1.5px solid rgba(1,0,107,0.10)',
        padding: compact ? '10px 14px' : '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 10 : 20,
        background: 'rgba(1,0,107,0.02)',
      }}
    >
      {compact ? (
        /* Mobile bottom bar: 2-row layout */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Row 1: fighter previews */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: teamA.ball.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
              }}>
                {fighterA?.icon ?? '⚽'}
              </div>
              <p style={{ fontFamily: RETRO, fontSize: 7, color: COLOR_A, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {fighterA?.name ?? teamA.name}
              </p>
            </div>
            <span style={{ fontFamily: RETRO, fontSize: 7, color: 'rgba(1,0,107,0.30)', flexShrink: 0 }}>VS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
              <p style={{ fontFamily: RETRO, fontSize: 7, color: COLOR_B, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, textAlign: 'right' }}>
                {fighterB?.name ?? teamB.name}
              </p>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: teamB.ball.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
              }}>
                {fighterB?.icon ?? '⚽'}
              </div>
            </div>
          </div>
          {/* Row 2: full-width START button */}
          <button
            onClick={startNewSimulation}
            style={{
              fontFamily: RETRO,
              fontSize: 10,
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: '#01006B',
              color: '#FFFADE',
              cursor: 'pointer',
              width: '100%',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          >
            ⚔ START
          </button>
        </div>
      ) : (
        /* Desktop bottom bar: full fighter preview */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%', background: teamA.ball.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, flexShrink: 0,
            }}>
              {fighterA?.icon ?? '⚽'}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: RETRO, fontSize: 10, color: COLOR_A, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {teamA.name}
              </p>
              <p style={{ fontFamily: RETRO, fontSize: 8, color: 'rgba(1,0,107,0.35)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {teamA.weapon.name}
              </p>
            </div>
          </div>

          <span style={{ fontFamily: RETRO, fontSize: 13, color: 'rgba(1,0,107,0.30)', flexShrink: 0 }}>VS</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 0, textAlign: 'right' }}>
              <p style={{ fontFamily: RETRO, fontSize: 10, color: COLOR_B, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {teamB.name}
              </p>
              <p style={{ fontFamily: RETRO, fontSize: 8, color: 'rgba(1,0,107,0.35)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {teamB.weapon.name}
              </p>
            </div>
            <div style={{
              width: 46, height: 46, borderRadius: '50%', background: teamB.ball.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, flexShrink: 0,
            }}>
              {fighterB?.icon ?? '⚽'}
            </div>
          </div>
        </>
      )}

      {!compact && (
        <button
          onClick={startNewSimulation}
          style={{
            fontFamily: RETRO,
            fontSize: 11,
            padding: '14px 24px',
            borderRadius: 10,
            border: 'none',
            background: '#01006B',
            color: '#FFFADE',
            cursor: 'pointer',
            flexShrink: 0,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        >
          ⚔ START
        </button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div
        style={{
          width: '100%',
          height: '100svh',
          background: 'var(--color-bg, #FFFADE)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Scrollable content area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 0' }}>
          {/* Player 1 card */}
          <div
            style={{
              borderRadius: 12,
              border: `1.5px solid ${COLOR_A}30`,
              overflow: 'hidden',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                background: `${COLOR_A}14`,
                borderBottom: `1px solid ${COLOR_A}28`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: COLOR_A, flexShrink: 0 }} />
              <span style={{ fontFamily: RETRO, fontSize: 10, color: COLOR_A }}>PLAYER 1</span>
            </div>
            <div style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FighterSelector team="A" />
              <StatsPanel team="A" showMatchup={false} />
            </div>
          </div>

          {/* VS divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 8px',
              marginBottom: 12,
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'rgba(1,0,107,0.10)' }} />
            <span style={{ fontFamily: RETRO, fontSize: 9, color: 'rgba(1,0,107,0.22)', letterSpacing: '0.35em' }}>VS</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(1,0,107,0.10)' }} />
          </div>

          {/* Player 2 card */}
          <div
            style={{
              borderRadius: 12,
              border: `1.5px solid ${COLOR_B}30`,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                background: `${COLOR_B}14`,
                borderBottom: `1px solid ${COLOR_B}28`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: COLOR_B, flexShrink: 0 }} />
              <span style={{ fontFamily: RETRO, fontSize: 10, color: COLOR_B }}>PLAYER 2</span>
            </div>
            <div style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FighterSelector team="B" />
              <StatsPanel team="B" showMatchup={false} />
            </div>
          </div>
        </div>

        {bottomBar(true)}
      </div>
    );
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: `calc((100svh - 64px) * ${RATIO.toFixed(6)} + ${PANEL_W}px)`,
          maxWidth: '100%',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 4px 40px rgba(1,0,107,0.13)',
          border: '1.5px solid rgba(1,0,107,0.10)',
          background: 'var(--color-bg, #FFFADE)',
        }}
      >
        {/* ── TOP: Player 1 | VS | Player 2 ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
          <TeamColumn team="A" color={COLOR_A} />

          {/* VS divider */}
          <div
            style={{
              width: 20,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(1,0,107,0.02)',
              borderLeft: '1px solid rgba(1,0,107,0.07)',
              borderRight: '1px solid rgba(1,0,107,0.07)',
            }}
          >
            <span
              style={{
                fontFamily: RETRO,
                fontSize: 9,
                color: 'rgba(1,0,107,0.22)',
                writingMode: 'vertical-lr',
                letterSpacing: '0.35em',
              }}
            >
              VS
            </span>
          </div>

          <TeamColumn team="B" color={COLOR_B} />
        </div>

        {bottomBar(false)}
      </div>
    </div>
  );
}

function TeamColumn({ team, color }: { team: 'A' | 'B'; color: string }) {
  const label = team === 'A' ? 'PLAYER 1' : 'PLAYER 2';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Header strip */}
      <div
        style={{
          flexShrink: 0,
          padding: '14px 18px',
          background: `${color}14`,
          borderBottom: `1px solid ${color}28`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: RETRO, fontSize: 11, color }}>{label}</span>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <FighterSelector team={team} />
        <StatsPanel team={team} showMatchup={false} />
      </div>
    </div>
  );
}
