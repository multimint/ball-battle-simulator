import React from 'react';
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

export default function SetupScreen() {
  const startNewSimulation = useGameStore((s) => s.startNewSimulation);
  const teamA = useGameStore((s) => s.teamA);
  const teamB = useGameStore((s) => s.teamB);

  const fighterA = FIGHTER_PRESETS.find((f) => f.weapon.name === teamA.weapon.name);
  const fighterB = FIGHTER_PRESETS.find((f) => f.weapon.name === teamB.weapon.name);

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
              width: 14,
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
                fontSize: 6,
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

        {/* ── BOTTOM: battle bar ── */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1.5px solid rgba(1,0,107,0.10)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: 'rgba(1,0,107,0.02)',
          }}
        >
          {/* Fighter A preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: teamA.ball.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                flexShrink: 0,
              }}
            >
              {fighterA?.icon ?? '⚽'}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: RETRO, fontSize: 6, color: COLOR_A, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {teamA.name}
              </p>
              <p style={{ fontFamily: RETRO, fontSize: 5, color: 'rgba(1,0,107,0.35)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {teamA.weapon.name}
              </p>
            </div>
          </div>

          {/* VS badge */}
          <span style={{ fontFamily: RETRO, fontSize: 8, color: 'rgba(1,0,107,0.30)', flexShrink: 0 }}>
            VS
          </span>

          {/* Fighter B preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 0, textAlign: 'right' }}>
              <p style={{ fontFamily: RETRO, fontSize: 6, color: COLOR_B, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {teamB.name}
              </p>
              <p style={{ fontFamily: RETRO, fontSize: 5, color: 'rgba(1,0,107,0.35)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {teamB.weapon.name}
              </p>
            </div>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: teamB.ball.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                flexShrink: 0,
              }}
            >
              {fighterB?.icon ?? '⚽'}
            </div>
          </div>

          {/* START button */}
          <button
            onClick={startNewSimulation}
            style={{
              fontFamily: RETRO,
              fontSize: 7,
              padding: '11px 18px',
              borderRadius: 8,
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
        </div>
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
          padding: '10px 14px',
          background: `${color}14`,
          borderBottom: `1px solid ${color}28`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: RETRO, fontSize: 7, color }}>{label}</span>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <FighterSelector team={team} />
        <StatsPanel team={team} showMatchup={false} />
      </div>
    </div>
  );
}
