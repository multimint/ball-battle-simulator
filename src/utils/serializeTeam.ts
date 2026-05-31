import type { TeamConfig } from '../models/types';

/**
 * Strip non-serializable fields (functions) from a TeamConfig before postMessage.
 * The receiving worker rehydrates them from BALL_DEFINITIONS by fighterId.
 */
export function serializeTeam(team: TeamConfig): TeamConfig {
  if (!team.ball.ability) return team;
  const { getHudRows: _fn, ...abilityWithoutFn } = team.ball.ability;
  return { ...team, ball: { ...team.ball, ability: abilityWithoutFn } };
}
