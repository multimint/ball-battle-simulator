import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { FIGHTER_PRESETS } from '../../balls';
import type { TeamId } from '../../models/types';
import { Sprite } from '../../sprites';

interface StatsPanelProps {
  team: TeamId;
  showMatchup?: boolean;
}

function StatRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 8, width: 30, flexShrink: 0, color: `${color}CC` }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', background: `${color}18` }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 8, width: 32, textAlign: 'right', flexShrink: 0, color }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

export default function StatsPanel({ team }: StatsPanelProps) {
  const config    = useGameStore((s) => (team === 'A' ? s.teamA : s.teamB));
  const { ball, weapon } = config;
  const fighter   = FIGHTER_PRESETS.find((f) => f.weapon.name === weapon.name);
  const teamColor = team === 'A' ? '#E47D79' : '#4A90E2';

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1.5px solid ${teamColor}30`,
        overflow: 'hidden',
      }}
    >
      {/* Weapon header */}
      <div
        style={{
          padding: '8px 12px',
          background: `linear-gradient(135deg, ${teamColor}18, ${teamColor}08)`,
          borderBottom: `1px solid ${teamColor}20`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: ball.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Sprite id={fighter?.icon ?? 'ball'} size={19} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 10, color: teamColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fighter?.name ?? ball.name}
          </p>
          <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 8, color: `${teamColor}BB`, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {weapon.name}
          </p>
        </div>
      </div>

      {/* Stat bars */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <StatRow label="HP"  value={ball.durability}    max={80}  color={teamColor} />
        <StatRow label="ATK" value={weapon.attacks.reduce((s, a) => s + a.damage, 0) / weapon.attacks.length} max={20}  color={teamColor} />
        <StatRow label="SPD" value={ball.maxSpeed * 10}  max={100} color={teamColor} />
      </div>

      {/* Ability & weapon descriptions */}
      <div style={{ borderTop: `1px solid ${teamColor}18`, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ball.ability && (
          <div>
            <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 7, color: `${teamColor}FF`, marginBottom: 4, letterSpacing: 1 }}>
              ABILITY · {ball.ability.name}
            </p>
            <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 7, color: `${teamColor}BB`, lineHeight: 1.7 }}>
              {ball.ability.description}
            </p>
          </div>
        )}
        {fighter?.weapon.description && (
          <div style={ball.ability ? { borderTop: `1px solid ${teamColor}10`, paddingTop: 8 } : undefined}>
            <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 7, color: `${teamColor}FF`, marginBottom: 4, letterSpacing: 1 }}>
              WEAPON · {weapon.name}
            </p>
            <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 7, color: `${teamColor}BB`, lineHeight: 1.7 }}>
              {fighter.weapon.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
