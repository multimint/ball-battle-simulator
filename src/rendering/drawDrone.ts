import type { UnitState } from '../models/types';
import type { Ctx2D } from './ctx';

export interface DroneRenderData {
  x: number;
  y: number;
  radius: number;
  state: UnitState;
  color: string;
  chargedColor: string;
  hp: number;
  maxHp: number;
}

export function drawDrone(ctx: Ctx2D, drone: DroneRenderData): void {
  const isCharged = drone.state === 'charged';
  const accent = isCharged ? drone.chargedColor : drone.color;
  const r = drone.radius;

  ctx.save();
  ctx.translate(drone.x, drone.y);

  if (isCharged) {
    // Wide diffuse outer halo — uses chargedColor so any unit color works
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = drone.chargedColor;
    ctx.shadowColor = drone.chargedColor;
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Mid glow ring
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = drone.chargedColor;
    ctx.shadowColor = drone.chargedColor;
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.0, 0, Math.PI * 2);
    ctx.fill();

    // Dark body
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#042210';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Charged rim — tinted from chargedColor
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = drone.chargedColor;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = drone.chargedColor;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(0, 0, r - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // Bright core
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = drone.chargedColor;
    ctx.shadowColor = drone.chargedColor;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  } else {
    // Normal state: subtle style
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#100620';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.46, 0, Math.PI * 2);
    ctx.fill();
  }

  // Specular highlight (both states)
  ctx.globalAlpha = isCharged ? 1.0 : 0.6;
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = isCharged ? drone.chargedColor : 'transparent';
  ctx.shadowBlur = isCharged ? 8 : 0;
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.32, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // HP number
  const displayHp = Math.max(0, Math.ceil(drone.hp));
  const fontSize = Math.max(10, r * 0.95);
  ctx.globalAlpha = 1.0;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.font = `bold ${fontSize}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(String(displayHp), 0, 0);

  ctx.restore();
}
