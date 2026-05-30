export const FONTS = {
  RETRO: '"Press Start 2P", monospace',
} as const;

export const TEXT_STYLES = {
  teamNameLarge: `bold 48px ${FONTS.RETRO}`,
  vsLabel:       `bold 28px ${FONTS.RETRO}`,
  abilityLabel:  `34px ${FONTS.RETRO}`,
  abilityValue:  `bold 52px ${FONTS.RETRO}`,
  floater:       `26px ${FONTS.RETRO}`,
  // Battle card
  cardNameLarge: `bold 72px ${FONTS.RETRO}`,
  cardWeapon:    `32px ${FONTS.RETRO}`,
  cardWinner:    `bold 52px ${FONTS.RETRO}`,
  cardBadge:     `bold 24px ${FONTS.RETRO}`,
} as const;
