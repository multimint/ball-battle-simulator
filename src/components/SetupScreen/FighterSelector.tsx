import React from 'react';
import { FIGHTER_PRESETS } from '../../constants/fighterPresets';
import { useGameStore } from '../../store/useGameStore';
import type { TeamId } from '../../models/types';

const CATEGORY_COLORS: Record<string, string> = {
  melee:      '#CC4444',
  projectile: '#4444CC',
  aoe:        '#CC44CC',
  shield:     '#4488CC',
  utility:    '#44AA44',
};

const CATEGORY_SHORT: Record<string, string> = {
  melee:      'MEL',
  projectile: 'PRJ',
  aoe:        'AOE',
  shield:     'SHD',
  utility:    'UTL',
};

interface FighterSelectorProps {
  team: TeamId;
}

export default function FighterSelector({ team }: FighterSelectorProps) {
  const teamConfig    = useGameStore((s) => (team === 'A' ? s.teamA : s.teamB));
  const setFighterConfig = useGameStore((s) => s.setFighterConfig);

  const teamColor = team === 'A' ? '#E47D79' : '#4A90E2';

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {FIGHTER_PRESETS.map((fighter) => {
        const isSelected = teamConfig.weapon.name === fighter.weapon.name;
        const catColor   = CATEGORY_COLORS[fighter.weapon.category] ?? '#888';
        const catShort   = CATEGORY_SHORT[fighter.weapon.category] ?? '???';

        return (
          <button
            key={fighter.id}
            onClick={() => setFighterConfig(team, fighter)}
            className="relative text-left rounded-lg overflow-hidden transition-all duration-150 active:scale-[0.97] w-full"
            style={{
              background: isSelected ? `${teamColor}14` : 'rgba(255,255,255,0.75)',
              border: `1.5px solid ${isSelected ? teamColor : 'rgba(0,0,0,0.09)'}`,
              boxShadow: isSelected
                ? `0 0 0 1.5px ${teamColor}55, 0 2px 8px ${teamColor}20`
                : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {/* ── Ball-color left accent strip ── */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-150"
              style={{
                backgroundColor: isSelected ? teamColor : fighter.ball.color,
                opacity: isSelected ? 1 : 0.75,
              }}
            />

            {/* ── Card body (offset for the accent strip) ── */}
            <div className="pl-3 pr-2 py-2">

              {/* Row 1: icon · name · category badge */}
              <div className="flex items-center gap-1.5 mb-1">
                {/* Ball colour circle + emoji */}
                <div
                  className="w-5 h-5 rounded-full border border-white/60 shadow-sm flex-shrink-0
                             flex items-center justify-center text-[10px] leading-none"
                  style={{ backgroundColor: fighter.ball.color }}
                >
                  {fighter.icon}
                </div>

                {/* Fighter name */}
                <span
                  className="font-retro text-[6.5px] leading-tight flex-1 min-w-0 truncate"
                  style={{ color: isSelected ? teamColor : '#01006B' }}
                >
                  {fighter.name}
                </span>

                {/* Category badge */}
                <span
                  className="font-retro text-[4.5px] px-1.5 py-px rounded-full text-white flex-shrink-0 leading-tight"
                  style={{ backgroundColor: catColor }}
                >
                  {catShort}
                </span>
              </div>

              {/* Row 2: weapon name · stats */}
              <div className="flex items-center gap-1">
                <span className="font-retro text-[5px] flex-1 min-w-0 truncate leading-tight"
                      style={{ color: isSelected ? `${teamColor}BB` : '#888' }}>
                  {fighter.weapon.name}
                </span>
                <span className="font-retro text-[4px] flex-shrink-0 whitespace-nowrap leading-tight"
                      style={{ color: isSelected ? `${teamColor}99` : '#AAA' }}>
                  HP{fighter.ball.durability}·ATK{fighter.ball.attackPower}
                </span>
              </div>

            </div>
          </button>
        );
      })}
    </div>
  );
}
