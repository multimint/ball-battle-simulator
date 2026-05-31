import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useMatchStore } from '../../store/useMatchStore';
import { Sprite } from '../../sprites';

export default function TopBar() {
  const teamA = useGameStore((s) => s.teamA);
  const teamB = useGameStore((s) => s.teamB);
  const hpA   = useMatchStore((s) => s.hp.A);
  const hpB   = useMatchStore((s) => s.hp.B);
  const maxA  = useMatchStore((s) => s.maxHp.A);
  const maxB  = useMatchStore((s) => s.maxHp.B);

  return (
    <div
      className="w-full flex items-center gap-2 px-3 py-2"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* ── Team A ── */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="flex-shrink-0"><Sprite id={teamA.ball.icon ?? 'ball'} size={20} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-retro text-[6px] truncate" style={{ color: 'var(--color-teamA)' }}>
            {teamA.weapon.name}
          </p>
          <HpBar value={hpA} max={maxA} color="var(--color-teamA)" />
        </div>
      </div>

      {/* ── VS ── */}
      <div className="flex-shrink-0">
        <span className="font-retro text-[9px]" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}>
          VS
        </span>
      </div>

      {/* ── Team B ── */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
        <div className="flex-1 min-w-0 text-right">
          <p className="font-retro text-[6px] truncate" style={{ color: 'var(--color-teamB)' }}>
            {teamB.weapon.name}
          </p>
          <HpBar value={hpB} max={maxB} color="var(--color-teamB)" reverse />
        </div>
        <span className="flex-shrink-0"><Sprite id={teamB.ball.icon ?? 'ball'} size={20} /></span>
      </div>
    </div>
  );
}

/* Thin HP bar — fills left→right for A, right→left for B */
function HpBar({
  value,
  max,
  color,
  reverse = false,
}: {
  value: number;
  max: number;
  color: string;
  reverse?: boolean;
}) {
  const pct     = Math.max(0, Math.min(100, (value / max) * 100));
  const barColor =
    pct > 50 ? color :
    pct > 25 ? '#FFCC00' :
               '#FF4444';

  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden mt-0.5" style={{ background: 'rgba(0,0,0,0.12)' }}>
      <div
        className="h-full rounded-full transition-all duration-200"
        style={{
          width: `${pct}%`,
          background: barColor,
          marginLeft: reverse ? 'auto' : undefined,
          // for reverse bars, grow from right
          ...(reverse ? { float: 'right' } : {}),
        }}
      />
    </div>
  );
}
