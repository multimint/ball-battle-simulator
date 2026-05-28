import { ARENA_SIZE } from '../constants/gameConstants';

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  // Arena floor
  ctx.fillStyle = '#FEFEFE';
  ctx.fillRect(0, 0, ARENA_SIZE, ARENA_SIZE);

  // Subtle grid
  ctx.strokeStyle = 'rgba(1, 0, 107, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x <= ARENA_SIZE; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= ARENA_SIZE; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_SIZE, y);
    ctx.stroke();
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(ARENA_SIZE / 2, ARENA_SIZE / 2, 60, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(1, 0, 107, 0.06)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(ARENA_SIZE / 2, ARENA_SIZE / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(1, 0, 107, 0.08)';
  ctx.fill();
}

export function drawArenaWalls(ctx: CanvasRenderingContext2D, colorA: string, colorB: string): void {
  // Gradient border
  const grad = ctx.createLinearGradient(0, 0, ARENA_SIZE, ARENA_SIZE);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);

  ctx.strokeStyle = grad;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeRect(2, 2, ARENA_SIZE - 4, ARENA_SIZE - 4);

  // Corner accents
  const cornerSize = 16;
  ctx.fillStyle = colorA;
  ctx.fillRect(0, 0, cornerSize, 4);
  ctx.fillRect(0, 0, 4, cornerSize);
  ctx.fillRect(0, ARENA_SIZE - cornerSize, 4, cornerSize);
  ctx.fillRect(0, ARENA_SIZE - 4, cornerSize, 4);

  ctx.fillStyle = colorB;
  ctx.fillRect(ARENA_SIZE - cornerSize, 0, cornerSize, 4);
  ctx.fillRect(ARENA_SIZE - 4, 0, 4, cornerSize);
  ctx.fillRect(ARENA_SIZE - 4, ARENA_SIZE - cornerSize, 4, cornerSize);
  ctx.fillRect(ARENA_SIZE - cornerSize, ARENA_SIZE - 4, cornerSize, 4);
}
