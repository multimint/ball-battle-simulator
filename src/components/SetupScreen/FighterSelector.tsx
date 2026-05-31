import React from 'react';
import { FIGHTER_PRESETS } from '../../balls';
import { useGameStore } from '../../store/useGameStore';
import type { TeamId } from '../../models/types';
import { Sprite } from '../../sprites';

interface FighterSelectorProps {
  team: TeamId;
}

export default function FighterSelector({ team }: FighterSelectorProps) {
  const teamConfig       = useGameStore((s) => (team === 'A' ? s.teamA : s.teamB));
  const setFighterConfig = useGameStore((s) => s.setFighterConfig);
  const teamColor        = team === 'A' ? '#E47D79' : '#4A90E2';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {FIGHTER_PRESETS.map((fighter) => {
        const isSelected = teamConfig.weapon.name === fighter.weapon.name;

        return (
          <button
            key={fighter.id}
            onClick={() => setFighterConfig(team, fighter)}
            style={{
              padding: '14px 8px',
              borderRadius: 10,
              border: `2px solid ${isSelected ? teamColor : 'rgba(0,0,0,0.08)'}`,
              background: isSelected ? `${teamColor}14` : 'rgba(255,255,255,0.75)',
              boxShadow: isSelected ? `0 0 0 2px ${teamColor}44` : '0 1px 4px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.12s',
            }}
          >
            {/* Ball icon circle */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: fighter.ball.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sprite id={fighter.icon} size={26} />
            </div>

            {/* Fighter name */}
            <span
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: 8,
                color: isSelected ? teamColor : '#01006B99',
                textAlign: 'center',
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {fighter.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
