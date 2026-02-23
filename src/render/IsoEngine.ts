/**
 * Isometric coordinate engine.
 * Standard 2:1 isometric projection.
 *
 *   screenX = (gridX - gridY) * HALF_W + originX
 *   screenY = (gridX + gridY) * HALF_H + originY
 */

export const ISO_TILE_W = 80;
export const ISO_TILE_H = 40;
export const HALF_W = ISO_TILE_W / 2; // 40
export const HALF_H = ISO_TILE_H / 2; // 20

/** Convert cartesian grid coords to isometric screen coords (top of diamond). */
export function cartToIso(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (gx - gy) * HALF_W,
    y: (gx + gy) * HALF_H,
  };
}

/** Convert isometric screen coords back to fractional cartesian grid coords. */
export function isoToCart(sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx / HALF_W + sy / HALF_H) / 2,
    y: (sy / HALF_H - sx / HALF_W) / 2,
  };
}

/** Convert screen pixel (relative to canvas) to grid tile coords, accounting for camera. */
export function screenToGrid(
  screenX: number, screenY: number,
  canvasEl: HTMLCanvasElement,
  camera: { x: number; y: number; zoom?: number },
): { x: number; y: number } {
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;
  const zoom = camera.zoom || 1;

  // World coords
  const wx = (screenX - rect.left) * scaleX / zoom + camera.x;
  const wy = (screenY - rect.top) * scaleY / zoom + camera.y;

  // cartToIso returns top-left of bounding box; diamond center is offset by (HALF_W, HALF_H)
  // Math.round correctly maps diamond-shaped tile hit regions (floor would shift diagonally)
  const cart = isoToCart(wx - HALF_W, wy - HALF_H);
  return {
    x: Math.round(cart.x),
    y: Math.round(cart.y),
  };
}

/** Convert screen pixel to world coords (before iso→cart). */
export function screenToWorld(
  screenX: number, screenY: number,
  canvasEl: HTMLCanvasElement,
  camera: { x: number; y: number; zoom?: number },
): { x: number; y: number } {
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;
  const zoom = camera.zoom || 1;
  return {
    x: (screenX - rect.left) * scaleX / zoom + camera.x,
    y: (screenY - rect.top) * scaleY / zoom + camera.y,
  };
}

/**
 * Depth key for sorting: objects further from camera (top-left in iso)
 * are drawn first. Sort by (gx + gy) ascending, then gy ascending.
 */
export function depthKey(gx: number, gy: number): number {
  return (gx + gy) * 1000 + gy;
}

/**
 * Draw an isometric diamond outline for a single tile at grid (gx, gy).
 */
export function drawIsoDiamond(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number,
): void {
  const { x, y } = cartToIso(gx, gy);
  ctx.beginPath();
  ctx.moveTo(x,          y + HALF_H);  // left
  ctx.lineTo(x + HALF_W, y);           // top
  ctx.lineTo(x + ISO_TILE_W, y + HALF_H); // right
  ctx.lineTo(x + HALF_W, y + ISO_TILE_H); // bottom
  ctx.closePath();
}

/**
 * Draw a filled isometric diamond for a tile.
 */
export function fillIsoDiamond(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number,
  color: string,
): void {
  ctx.fillStyle = color;
  drawIsoDiamond(ctx, gx, gy);
  ctx.fill();
}

/**
 * Draw an isometric box (3 visible faces) for buildings.
 * @param height pixel height of the vertical walls
 */
export function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number,
  tileW: number, tileH: number,
  wallHeight: number,
  topColor: string,
  leftColor: string,
  rightColor: string,
): void {
  const topLeft = cartToIso(gx, gy);           // screen: TOP vertex
  const topRight = cartToIso(gx + tileW, gy);  // screen: RIGHT vertex
  const botLeft = cartToIso(gx, gy + tileH);   // screen: LEFT vertex
  const botRight = cartToIso(gx + tileW, gy + tileH); // screen: BOTTOM vertex

  // Left wall: LEFT vertex → BOTTOM vertex (faces viewer's left)
  ctx.fillStyle = leftColor;
  ctx.beginPath();
  ctx.moveTo(botLeft.x + HALF_W, botLeft.y - wallHeight);
  ctx.lineTo(botRight.x + HALF_W, botRight.y - wallHeight);
  ctx.lineTo(botRight.x + HALF_W, botRight.y);
  ctx.lineTo(botLeft.x + HALF_W, botLeft.y);
  ctx.closePath();
  ctx.fill();

  // Right wall: RIGHT vertex → BOTTOM vertex (faces viewer's right)
  ctx.fillStyle = rightColor;
  ctx.beginPath();
  ctx.moveTo(topRight.x + HALF_W, topRight.y - wallHeight);
  ctx.lineTo(botRight.x + HALF_W, botRight.y - wallHeight);
  ctx.lineTo(botRight.x + HALF_W, botRight.y);
  ctx.lineTo(topRight.x + HALF_W, topRight.y);
  ctx.closePath();
  ctx.fill();

  // Top face (diamond) — drawn last so it's on top
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(topLeft.x + HALF_W, topLeft.y - wallHeight);
  ctx.lineTo(topRight.x + HALF_W, topRight.y - wallHeight);
  ctx.lineTo(botRight.x + HALF_W, botRight.y - wallHeight);
  ctx.lineTo(botLeft.x + HALF_W, botLeft.y - wallHeight);
  ctx.closePath();
  ctx.fill();
}

/**
 * Lighten a hex color by a factor (0-1).
 */
export function lightenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r + (255 - r) * factor));
  const ng = Math.min(255, Math.round(g + (255 - g) * factor));
  const nb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `rgb(${nr},${ng},${nb})`;
}

/**
 * Darken a hex color by a factor (0-1).
 */
export function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r * (1 - factor));
  const ng = Math.round(g * (1 - factor));
  const nb = Math.round(b * (1 - factor));
  return `rgb(${nr},${ng},${nb})`;
}

/**
 * Calculate the world-space bounding box for the entire grid.
 */
export function getWorldBounds(gridW: number, gridH: number): { minX: number; minY: number; maxX: number; maxY: number } {
  // Four corners of the grid in iso space
  const tl = cartToIso(0, 0);
  const tr = cartToIso(gridW, 0);
  const bl = cartToIso(0, gridH);
  const br = cartToIso(gridW, gridH);

  return {
    minX: Math.min(tl.x, bl.x),
    minY: Math.min(tl.y, tr.y),
    maxX: Math.max(tr.x, br.x) + ISO_TILE_W,
    maxY: Math.max(bl.y, br.y) + ISO_TILE_H,
  };
}
