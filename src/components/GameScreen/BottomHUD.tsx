import React from 'react';
import { useMatchStore } from '../../store/useMatchStore';

export default function BottomHUD() {
  const turnsElapsed = useMatchStore((s) => s.turnsElapsed);
  const damageDealt = useMatchStore((s) => s.damageDealt);
  const hp = useMatchStore((s) => s.hp);
  const maxHp = useMatchStore((s) => s.maxHp);

  const totalDamage = damageDealt.A + damageDealt.B;

  return (
    <div className="w-full flex gap-2 px-2 py-2" style={{ background: 'var(--color-bg)' }}>
      {/* HP Team A */}
      <div
        className="flex-1 rounded-lg px-2 py-1.5 flex flex-col"
        style={{ background: 'var(--color-teamA)' }}
      >
        <span className="font-retro text-[5px] text-white opacity-80">Team A HP</span>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, (hp.A / maxHp.A) * 100)}%` }}
            />
          </div>
          <span className="font-retro text-[6px] text-white">{Math.max(0, hp.A)}</span>
        </div>
      </div>

      {/* Center: Turns + Damage */}
      <div className="flex gap-2">
        <div
          className="rounded-lg px-3 py-1.5 flex flex-col items-center justify-center"
          style={{ background: 'var(--color-hud-left)' }}
        >
          <span className="font-retro text-[5px] text-white opacity-80">TURNS</span>
          <span className="font-retro text-[9px] text-white">{turnsElapsed}</span>
        </div>
        <div
          className="rounded-lg px-3 py-1.5 flex flex-col items-center justify-center"
          style={{ background: 'var(--color-hud-right)' }}
        >
          <span className="font-retro text-[5px] text-white opacity-80">DMG</span>
          <span className="font-retro text-[9px] text-white">{totalDamage}</span>
        </div>
      </div>

      {/* HP Team B */}
      <div
        className="flex-1 rounded-lg px-2 py-1.5 flex flex-col items-end"
        style={{ background: 'var(--color-teamB)' }}
      >
        <span className="font-retro text-[5px] text-white opacity-80">Team B HP</span>
        <div className="flex items-center gap-1 mt-0.5 w-full">
          <span className="font-retro text-[6px] text-white">{Math.max(0, hp.B)}</span>
          <div className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300 ml-auto"
              style={{ width: `${Math.max(0, (hp.B / maxHp.B) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
