// Lifesteal is consumed in HitProcessor's damage() closure — no tick or multiplier here.
import type { StatusEffectHandler } from './types';

export const lifestealHandler: StatusEffectHandler = {};
