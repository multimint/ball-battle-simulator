// Canvas 2D drawing helpers

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fillColor: string,
  strokeColor?: string,
  strokeWidth = 2
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

export function drawArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: string,
  lineWidth: number
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 2
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  fontSize = 12,
  font = '"Press Start 2P", monospace'
): void {
  ctx.font = `${fontSize}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillColor: string
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fillColor;
  ctx.fill();
}
