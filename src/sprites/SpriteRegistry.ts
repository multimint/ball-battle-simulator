import type { SpriteKey } from './SpriteKey';
import { SPRITE_PAINTERS } from './spriteDefinitions';

type SpriteImages = Partial<Record<SpriteKey, ImageBitmap>>;

const registry: SpriteImages = {};
let loaded = false;

export function loadAllSprites(): void {
  if (loaded) return;
  loaded = true;
  const keys = Object.keys(SPRITE_PAINTERS) as SpriteKey[];
  for (const key of keys) {
    const canvas = new OffscreenCanvas(32, 32);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(32 / 24, 32 / 24);
    SPRITE_PAINTERS[key](ctx);
    registry[key] = canvas.transferToImageBitmap();
  }
}

export function spriteRegistry(): SpriteImages {
  return registry;
}
