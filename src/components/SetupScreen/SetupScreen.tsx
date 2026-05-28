import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Button } from '../ui/Button';
import FighterSelector from './FighterSelector';
import StatsPanel from './StatsPanel';

const COLOR_A = '#E47D79';
const COLOR_B = '#4A90E2';

export default function SetupScreen() {
  const startNewSimulation = useGameStore((s) => s.startNewSimulation);

  function handleStart() {
    startNewSimulation();
  }

  return (
    /* ── Full-screen bg ── */
    <div
      className="h-screen w-full flex flex-col items-center justify-center overflow-hidden p-0 lg:p-4"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* ── Centered game panel ── */}
      <div
        className="w-full lg:max-w-4xl h-full lg:h-[94vh] flex flex-col overflow-hidden lg:rounded-2xl"
        style={{
          background: 'var(--color-bg)',
          border: '1.5px solid rgba(1,0,107,0.10)',
          boxShadow: '0 8px 48px rgba(1,0,107,0.07), 0 2px 12px rgba(1,0,107,0.04)',
        }}
      >
        {/* ════ HEADER ════ */}
        <header className="flex-shrink-0 text-center py-2.5 border-b border-game-primary/12">
          <h1 className="font-retro text-[13px] text-game-primary">⚔️ BALL BATTLE</h1>
          <p className="font-retro text-[6px] text-game-primary/35 mt-0.5 tracking-widest">
            1V1 PHYSICS DUEL SIMULATOR
          </p>
        </header>

        {/* ════ COLUMNS ════ */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">

          <TeamColumn team="A" color={COLOR_A} showMatchup={false} />
          <VsDivider />
          <TeamColumn team="B" color={COLOR_B} showMatchup />

        </div>

        {/* ════ START BUTTON ════ */}
        <div
          className="flex-shrink-0 px-4 py-3 border-t border-game-primary/10 flex justify-center"
        >
          <Button variant="success" size="xl" onClick={handleStart} className="w-full max-w-xs">
            ⚔️ START BATTLE!
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Team column
───────────────────────────────────────── */
function TeamColumn({
  team,
  color,
  showMatchup,
}: {
  team: 'A' | 'B';
  color: string;
  showMatchup: boolean;
}) {
  const label = team === 'A' ? 'PLAYER 1' : 'PLAYER 2';

  return (
    <div
      className="flex-1 flex flex-col min-w-0 min-h-0 border-b lg:border-b-0 lg:border-r border-game-primary/10 last:border-r-0"
    >
      {/* Colored header strip */}
      <div
        className="flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5"
        style={{ background: `${color}18`, borderBottom: `1px solid ${color}30` }}
      >
        <div
          className="w-3 h-3 rounded-full ring-2 ring-white/70 shadow-sm flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-retro text-[8px]" style={{ color }}>
          {label}
        </span>
      </div>

      {/* Scrollable: cards + stats */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pt-2 pb-3 flex flex-col gap-2">
        <FighterSelector team={team} />
        <StatsPanel team={team} showMatchup={showMatchup} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   VS divider
───────────────────────────────────────── */
function VsDivider() {
  return (
    <>
      {/* Desktop vertical */}
      <div className="hidden lg:flex w-10 flex-col items-center flex-shrink-0 py-6">
        <div
          className="w-px flex-1"
          style={{ background: 'linear-gradient(to bottom, transparent, #E47D7944, #4A90E244, transparent)' }}
        />
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center my-3 flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #E47D7922, #4A90E222)',
            border: '1.5px solid #01006B1a',
          }}
        >
          <span className="font-retro text-[7px]" style={{ color: '#01006B55' }}>VS</span>
        </div>
        <div
          className="w-px flex-1"
          style={{ background: 'linear-gradient(to bottom, transparent, #4A90E244, #E47D7944, transparent)' }}
        />
      </div>

      {/* Mobile horizontal */}
      <div className="lg:hidden flex-shrink-0 flex items-center px-4 py-1">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, #E47D7940, transparent)' }} />
        <span className="font-retro text-[8px] px-3" style={{ color: '#01006B40' }}>VS</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, #4A90E240, transparent)' }} />
      </div>
    </>
  );
}
