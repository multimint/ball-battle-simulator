import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { FIGHTER_PRESETS } from '../../constants/fighterPresets';
import { calculatePowerScore, calculateChaos, matchupLabel } from '../../utils/powerScore';
import type { TeamId } from '../../models/types';

interface StatsPanelProps {
  team: TeamId;
  showMatchup?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  melee:      '#CC4444',
  projectile: '#4444CC',
  aoe:        '#CC44CC',
  shield:     '#4488CC',
  utility:    '#44AA44',
};

/* Inline stat bar row */
function StatRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="font-retro text-[5px] w-5 flex-shrink-0" style={{ color: `${color}99` }}>{label}</span>
      <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: `${color}18` }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-retro text-[5px] w-6 text-right flex-shrink-0" style={{ color }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

export default function StatsPanel({ team, showMatchup }: StatsPanelProps) {
  const teamA  = useGameStore((s) => s.teamA);
  const teamB  = useGameStore((s) => s.teamB);
  const config = team === 'A' ? teamA : teamB;
  const { ball, weapon } = config;

  const fighter   = FIGHTER_PRESETS.find((f) => f.weapon.name === weapon.name);
  const power     = calculatePowerScore(ball);
  const chaos     = calculateChaos(ball);
  const teamColor = team === 'A' ? '#E47D79' : '#4A90E2';
  const catColor  = CATEGORY_COLORS[weapon.category] ?? '#888';

  const matchup = showMatchup
    ? matchupLabel(
        calculatePowerScore(teamA.ball),
        calculatePowerScore(teamB.ball),
        teamA.name,
        teamB.name
      )
    : null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1.5px solid ${teamColor}40`,
        boxShadow: `0 2px 12px ${teamColor}18`,
      }}
    >
      {/* ── Header: fighter identity ── */}
      <div
        className="flex items-center gap-2.5 px-3 py-2"
        style={{ background: `linear-gradient(135deg, ${teamColor}22, ${teamColor}0a)` }}
      >
        {/* Ball avatar */}
        <div
          className="w-8 h-8 rounded-full border-2 border-white/60 shadow-md flex-shrink-0
                     flex items-center justify-center text-lg"
          style={{ backgroundColor: ball.color }}
        >
          {fighter?.icon ?? ball.icon ?? '⚽'}
        </div>

        {/* Name + lore */}
        <div className="flex-1 min-w-0">
          <p className="font-retro text-[7.5px] leading-tight truncate" style={{ color: teamColor }}>
            {fighter?.name ?? ball.name}
          </p>
          {fighter && (
            <p className="font-retro text-[4.5px] mt-px truncate" style={{ color: `${teamColor}80` }}>
              {fighter.lore}
            </p>
          )}
        </div>

        {/* Weapon badge */}
        <span
          className="font-retro text-[4.5px] px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
          style={{ backgroundColor: catColor }}
        >
          {weapon.name}
        </span>
      </div>

      {/* ── Stat bars ── */}
      <div className="px-3 pt-2 pb-2 flex flex-col gap-1.5">
        <StatRow label="HP"  value={ball.durability}     max={150} color={teamColor} />
        <StatRow label="ATK" value={ball.attackPower}     max={100} color={teamColor} />
        <StatRow label="KNK" value={ball.knockbackPower}  max={120} color={teamColor} />
        <StatRow label="SPD" value={ball.maxSpeed * 10}   max={80}  color={teamColor} />

        {/* Divider */}
        <div className="h-px my-0.5" style={{ background: `${teamColor}18` }} />

        {/* PWR + CHAOS side by side */}
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2">
            <span className="font-retro text-[5px] w-5 flex-shrink-0" style={{ color: `${teamColor}99` }}>PWR</span>
            <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: `${teamColor}18` }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (power / 120) * 100)}%`, backgroundColor: teamColor }} />
            </div>
            <span className="font-retro text-[5px] w-6 text-right flex-shrink-0" style={{ color: teamColor }}>{Math.round(power)}</span>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <span className="font-retro text-[5px] w-8 flex-shrink-0 text-yellow-600/70">CHAOS</span>
            <div className="flex-1 h-[5px] rounded-full bg-yellow-200/60 overflow-hidden">
              <div className="h-full rounded-full bg-yellow-400" style={{ width: `${chaos}%` }} />
            </div>
            <span className="font-retro text-[5px] w-6 text-right flex-shrink-0 text-yellow-600">{Math.round(chaos)}</span>
          </div>
        </div>
      </div>

      {/* ── Matchup indicator ── */}
      {matchup && (
        <div
          className="px-3 py-1.5 flex items-center justify-center gap-1.5"
          style={{ background: `${teamColor}0d`, borderTop: `1px solid ${teamColor}1a` }}
        >
          <span className="text-base leading-none">{matchup.emoji}</span>
          <span className="font-retro text-[5.5px]" style={{ color: '#01006B99' }}>
            {matchup.label}
          </span>
        </div>
      )}
    </div>
  );
}
