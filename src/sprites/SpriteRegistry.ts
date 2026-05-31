import type { SpriteKey } from './SpriteKey';
import { SPRITE_PAINTERS } from './spriteDefinitions';

type SpriteImages = Partial<Record<SpriteKey, ImageBitmap>>;

const registry: SpriteImages = {};
let loaded = false;

const SPRITE_SIZE = 256;

export function loadAllSprites(): void {
  if (loaded) return;
  loaded = true;
  const keys = Object.keys(SPRITE_PAINTERS) as SpriteKey[];
  for (const key of keys) {
    const canvas = new OffscreenCanvas(SPRITE_SIZE, SPRITE_SIZE);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(SPRITE_SIZE / 24, SPRITE_SIZE / 24);
    SPRITE_PAINTERS[key](ctx);
    registry[key] = canvas.transferToImageBitmap();
  }
}

export function spriteRegistry(): SpriteImages {
  return registry;
}
