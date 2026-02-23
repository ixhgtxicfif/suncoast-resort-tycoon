import { GameState, Tile } from '../state/types';
import { GRID_HEIGHT, WATER_ROWS, BEACH_ROWS } from '../state/initialState';
import {
  cartToIso, HALF_W, HALF_H, ISO_TILE_W, ISO_TILE_H, drawIsoDiamond,
} from './IsoEngine';
import { SpriteManager } from './SpriteManager';

const GRASS_COLOR = '#7ec850';
const GRASS_COLOR_ALT = '#72b848';
const BEACH_SAND_COLOR = '#ffe4b5';
const BEACH_SAND_COLOR_ALT = '#ffd9a0';
const UNOWNED_OVERLAY = 'rgba(50, 50, 50, 0.35)';

const WATER_SHALLOW = '#a8d8ea';
const WATER_MID = '#74b9ff';
const WATER_DEEP = '#0984e3';

const GRID_LINE_COLOR = 'rgba(0, 80, 0, 0.12)';

export function drawIsoTerrain(ctx: CanvasRenderingContext2D, state: GameState, _sprites?: SpriteManager): void {
  const { width, height, tiles } = state.grid;
  const waterStartY = height - WATER_ROWS;
  const beachStartY = waterStartY - BEACH_ROWS;
  const time = performance.now() / 1000;

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const tile = tiles[gy]?.[gx];
      if (!tile) continue;

      if (tile.type === 'water') {
        drawWaterTile(ctx, gx, gy, gy - waterStartY, time);
      } else if (tile.type === 'path') {
        const isBeach = gy >= beachStartY && gy < waterStartY;
        drawGroundBase(ctx, gx, gy, isBeach);
        drawPathTile(ctx, gx, gy, tiles, width, height);
      } else if (tile.type === 'beach_sand') {
        drawGroundBase(ctx, gx, gy, true);
        drawBeachDecor(ctx, gx, gy);
      } else if (tile.type === 'parking') {
        drawParkingTile(ctx, gx, gy);
      } else if (tile.type === 'unowned') {
        const inBeachZone = gy >= beachStartY && gy < waterStartY;
        drawGroundBase(ctx, gx, gy, inBeachZone);
        if (inBeachZone) {
          drawBeachDecor(ctx, gx, gy);
        }
        drawIsoDiamond(ctx, gx, gy);
        ctx.fillStyle = inBeachZone ? 'rgba(50, 50, 50, 0.15)' : UNOWNED_OVERLAY;
        ctx.fill();
      } else if (tile.type === 'occupied') {
        drawGroundBase(ctx, gx, gy, gy >= beachStartY && gy < waterStartY);
      } else {
        drawGroundBase(ctx, gx, gy, false);
      }

      // Foam on tiles just above water
      if (tile.type !== 'water' && gy === waterStartY - 1) {
        const foam = Math.sin(time * 1.2 + gx * 0.6) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(168, 216, 234, ${foam * 0.25})`;
        drawIsoDiamond(ctx, gx, gy);
        ctx.fill();
      }
    }
  }
}

function drawGroundBase(ctx: CanvasRenderingContext2D, gx: number, gy: number, isBeach: boolean): void {
  const alt = (gx + gy) % 2 === 0;
  if (isBeach) {
    ctx.fillStyle = alt ? BEACH_SAND_COLOR : BEACH_SAND_COLOR_ALT;
  } else {
    ctx.fillStyle = alt ? GRASS_COLOR : GRASS_COLOR_ALT;
  }
  drawIsoDiamond(ctx, gx, gy);
  ctx.fill();

  // Subtle grass texture noise for non-beach
  if (!isBeach) {
    const seed = (gx * 73 + gy * 37) & 0xff;
    if (seed % 3 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      drawIsoDiamond(ctx, gx, gy);
      ctx.fill();
    } else if (seed % 5 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      drawIsoDiamond(ctx, gx, gy);
      ctx.fill();
    }
  }
}

function drawWaterTile(ctx: CanvasRenderingContext2D, gx: number, gy: number, rowFromWater: number, time: number): void {
  let color: string;
  if (rowFromWater === 0) color = WATER_SHALLOW;
  else if (rowFromWater === 1) color = WATER_MID;
  else color = WATER_DEEP;

  ctx.fillStyle = color;
  drawIsoDiamond(ctx, gx, gy);
  ctx.fill();

  // Wave sparkle
  const wave = Math.sin(time * 2 + gx * 0.7 + gy * 0.5) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(255, 255, 255, ${wave * 0.15})`;
  drawIsoDiamond(ctx, gx, gy);
  ctx.fill();

  // Beach foam on first water row
  if (rowFromWater === 0) {
    const foam = Math.sin(time * 1.5 + gx * 0.8) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${foam * 0.3})`;
    drawIsoDiamond(ctx, gx, gy);
    ctx.fill();
  }
}

function drawBeachDecor(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  const seed = gx * 31 + gy * 17;
  if (seed % 7 !== 0 && seed % 11 !== 0) return;

  const iso = cartToIso(gx, gy);
  const cx = iso.x + HALF_W;
  const cy = iso.y + HALF_H;

  if (seed % 7 === 0) {
    // Towel
    const towelColors = ['#ff6b6b', '#74b9ff', '#55efc4', '#fd79a8'];
    ctx.fillStyle = towelColors[seed % towelColors.length];
    ctx.globalAlpha = 0.35;
    ctx.fillRect(cx - 10, cy - 3, 20, 8);
    ctx.globalAlpha = 1.0;
  } else if (seed % 11 === 0) {
    // Umbrella
    ctx.fillStyle = 'rgba(255,100,100,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPathTile(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number,
  tiles: Tile[][], gw: number, gh: number,
): void {
  // Solid procedural path
  ctx.fillStyle = '#c4bfb0';
  drawIsoDiamond(ctx, gx, gy);
  ctx.fill();

  // Subtle noise variation per tile
  const seed = (gx * 73 + gy * 37) & 0xff;
  if (seed & 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    drawIsoDiamond(ctx, gx, gy);
    ctx.fill();
  }

  // Thin border on edges that face non-path tiles
  const iso = cartToIso(gx, gy);
  const Wx = iso.x;               const Wy = iso.y + HALF_H;
  const Nx = iso.x + HALF_W;      const Ny = iso.y;
  const Ex = iso.x + ISO_TILE_W;  const Ey = iso.y + HALF_H;
  const Sx = iso.x + HALF_W;      const Sy = iso.y + ISO_TILE_H;

  const hasLeft  = gx > 0    && tiles[gy]?.[gx - 1]?.type === 'path';
  const hasTop   = gy > 0    && tiles[gy - 1]?.[gx]?.type === 'path';
  const hasRight = gx < gw-1 && tiles[gy]?.[gx + 1]?.type === 'path';
  const hasBot   = gy < gh-1 && tiles[gy + 1]?.[gx]?.type === 'path';

  // Round off corners where two exposed edges meet at a vertex.
  // Draws a sand-colored arc to soften the sharp diamond points.
  const isBeach = gy >= (gh - WATER_ROWS - BEACH_ROWS) && gy < (gh - WATER_ROWS);
  const groundBg = isBeach ? BEACH_SAND_COLOR : GRASS_COLOR;
  const r = 5;

  // W vertex: left edge (W→N) + bottom edge (S→W)
  if (!hasLeft && !hasBot) {
    ctx.fillStyle = groundBg;
    ctx.beginPath(); ctx.arc(Wx, Wy, r, 0, Math.PI * 2); ctx.fill();
  }
  // N vertex: left edge (W→N) + top edge (N→E)
  if (!hasLeft && !hasTop) {
    ctx.fillStyle = groundBg;
    ctx.beginPath(); ctx.arc(Nx, Ny, r, 0, Math.PI * 2); ctx.fill();
  }
  // E vertex: top edge (N→E) + right edge (E→S)
  if (!hasTop && !hasRight) {
    ctx.fillStyle = groundBg;
    ctx.beginPath(); ctx.arc(Ex, Ey, r, 0, Math.PI * 2); ctx.fill();
  }
  // S vertex: right edge (E→S) + bottom edge (S→W)
  if (!hasRight && !hasBot) {
    ctx.fillStyle = groundBg;
    ctx.beginPath(); ctx.arc(Sx, Sy, r, 0, Math.PI * 2); ctx.fill();
  }

  // Border lines on exposed edges
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';

  if (!hasLeft) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(Wx, Wy); ctx.lineTo(Nx, Ny); ctx.stroke();
  }
  if (!hasTop) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.moveTo(Nx, Ny); ctx.lineTo(Ex, Ey); ctx.stroke();
  }
  if (!hasRight) {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.moveTo(Ex, Ey); ctx.lineTo(Sx, Sy); ctx.stroke();
  }
  if (!hasBot) {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.moveTo(Sx, Sy); ctx.lineTo(Wx, Wy); ctx.stroke();
  }
}

export function drawIsoGrid(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.grid;
  const waterStartY = height - WATER_ROWS;

  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 0.5;

  for (let gy = 0; gy <= waterStartY; gy++) {
    for (let gx = 0; gx <= width; gx++) {
      // Draw diamond outlines for grid
      if (gx < width && gy < waterStartY) {
        drawIsoDiamond(ctx, gx, gy);
        ctx.stroke();
      }
    }
  }
}

export function drawIsoLandParcels(ctx: CanvasRenderingContext2D, state: GameState): void {
  const waterStartY = GRID_HEIGHT - WATER_ROWS;
  const PARCEL = 4;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (let py = 0; py < waterStartY; py += PARCEL) {
    for (let px = 0; px < state.grid.width; px += PARCEL) {
      let hasUnowned = false;
      for (let dy = 0; dy < PARCEL && !hasUnowned; dy++) {
        for (let dx = 0; dx < PARCEL && !hasUnowned; dx++) {
          const tile = state.grid.tiles[py + dy]?.[px + dx];
          if (tile && tile.type === 'unowned') hasUnowned = true;
        }
      }
      if (hasUnowned) {
        const tl = cartToIso(px, py);
        const tr = cartToIso(px + PARCEL, py);
        const br = cartToIso(px + PARCEL, py + PARCEL);
        const bl = cartToIso(px, py + PARCEL);

        ctx.beginPath();
        ctx.moveTo(tl.x + HALF_W, tl.y);
        ctx.lineTo(tr.x + HALF_W, tr.y);
        ctx.lineTo(br.x + HALF_W, br.y);
        ctx.lineTo(bl.x + HALF_W, bl.y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);
}

// ── Fence ────────────────────────────────────────────────────────────

const FENCE_COLOR = '#5a4a3a';
const FENCE_POST_COLOR = '#6b5b4b';
const FENCE_HEIGHT = 8;

function isOwned(tiles: Tile[][], gw: number, gh: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gw || y >= gh) return false;
  const t = tiles[y]?.[x]?.type;
  return t === 'sand' || t === 'beach_sand' || t === 'path' || t === 'occupied';
}

export function drawFence(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height, tiles } = state.grid;
  const waterStartY = height - WATER_ROWS;
  const ent = state.entrance;

  for (let gy = 0; gy < waterStartY; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (!isOwned(tiles, width, height, gx, gy)) continue;

      const iso = cartToIso(gx, gy);
      const Wx = iso.x;               const Wy = iso.y + HALF_H;
      const Nx = iso.x + HALF_W;      const Ny = iso.y;
      const Ex = iso.x + ISO_TILE_W;  const Ey = iso.y + HALF_H;
      const Sx = iso.x + HALF_W;      const Sy = iso.y + ISO_TILE_H;

      // Skip fence on entrance tile edges (gate goes there)
      const isEntrance = ent && gx === ent.x && gy === ent.y;

      // Check each edge: draw fence if neighbor is not owned
      // Left edge (W→N): neighbor at (gx-1, gy)
      if (!isOwned(tiles, width, height, gx - 1, gy) && !isEntrance) {
        drawFenceSegment(ctx, Wx, Wy, Nx, Ny);
      }
      // Top edge (N→E): neighbor at (gx, gy-1)
      if (!isOwned(tiles, width, height, gx, gy - 1)) {
        drawFenceSegment(ctx, Nx, Ny, Ex, Ey);
      }
      // Right edge (E→S): neighbor at (gx+1, gy)
      if (!isOwned(tiles, width, height, gx + 1, gy)) {
        drawFenceSegment(ctx, Ex, Ey, Sx, Sy);
      }
      // Bottom edge (S→W): neighbor at (gx, gy+1) — skip at water boundary
      if (gy + 1 < waterStartY && !isOwned(tiles, width, height, gx, gy + 1)) {
        drawFenceSegment(ctx, Sx, Sy, Wx, Wy);
      }
    }
  }
}

function drawFenceSegment(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
): void {
  const h = FENCE_HEIGHT;
  const posts = 3;

  // Horizontal rail (top)
  ctx.strokeStyle = FENCE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1 - h);
  ctx.lineTo(x2, y2 - h);
  ctx.stroke();

  // Horizontal rail (middle)
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1 - h * 0.5);
  ctx.lineTo(x2, y2 - h * 0.5);
  ctx.stroke();

  // Posts
  ctx.strokeStyle = FENCE_POST_COLOR;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - h);
    ctx.stroke();
    // Post cap
    ctx.fillStyle = FENCE_POST_COLOR;
    ctx.fillRect(px - 1.5, py - h - 1.5, 3, 3);
  }
}

// ── Entrance Gate ────────────────────────────────────────────────────

export function drawIsoEntrance(ctx: CanvasRenderingContext2D, state: GameState): void {
  const ent = state.entrance;
  if (!ent) return;

  const iso = cartToIso(ent.x, ent.y);
  const Wx = iso.x;               const Wy = iso.y + HALF_H;
  const Nx = iso.x + HALF_W;      const Ny = iso.y;

  // Gate path highlight
  ctx.fillStyle = 'rgba(85, 239, 196, 0.15)';
  drawIsoDiamond(ctx, ent.x, ent.y);
  ctx.fill();

  // Gate posts (on the left edge W→N of the entrance tile)
  const postH = 16;
  const postW = 3;

  // Left post (at W vertex)
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(Wx - postW / 2, Wy - postH, postW, postH);
  ctx.fillStyle = '#6b5b4b';
  ctx.fillRect(Wx - postW / 2 - 1, Wy - postH - 3, postW + 2, 3);

  // Right post (at N vertex)
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(Nx - postW / 2, Ny - postH, postW, postH);
  ctx.fillStyle = '#6b5b4b';
  ctx.fillRect(Nx - postW / 2 - 1, Ny - postH - 3, postW + 2, 3);

  // Arch between posts
  const archMidX = (Wx + Nx) / 2;
  const archMidY = (Wy + Ny) / 2;
  ctx.strokeStyle = '#4a3a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Wx, Wy - postH);
  ctx.quadraticCurveTo(archMidX, archMidY - postH - 8, Nx, Ny - postH);
  ctx.stroke();

  // "ENTRANCE" text on arch
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  const textX = archMidX;
  const textY = archMidY - postH - 3;
  ctx.strokeText('ENTRANCE', textX, textY);
  ctx.fillText('ENTRANCE', textX, textY);

  // Arrow indicator (pulsing)
  const pulse = Math.sin(performance.now() / 400) * 2;
  ctx.fillStyle = '#55efc4';
  ctx.beginPath();
  const arrowX = archMidX;
  const arrowY = archMidY - 2 + pulse;
  ctx.moveTo(arrowX, arrowY + 4);
  ctx.lineTo(arrowX - 4, arrowY);
  ctx.lineTo(arrowX + 4, arrowY);
  ctx.closePath();
  ctx.fill();
}

// ── Parking Area ─────────────────────────────────────────────────────

const PARKING_COLOR = '#888888';
const PARKING_COLOR_ALT = '#7e7e7e';
const PARKING_LINE = 'rgba(255,255,255,0.5)';

function drawParkingTile(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  const alt = (gx + gy) % 2 === 0;
  ctx.fillStyle = alt ? PARKING_COLOR : PARKING_COLOR_ALT;
  drawIsoDiamond(ctx, gx, gy);
  ctx.fill();

  // Parking line markings
  const iso = cartToIso(gx, gy);
  const cx = iso.x + HALF_W;
  const cy = iso.y + HALF_H;

  ctx.strokeStyle = PARKING_LINE;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 2);
  ctx.lineTo(cx + 8, cy + 2);
  ctx.stroke();
}

export function drawParkedCars(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { tiles, width, height } = state.grid;
  const guestCount = state.guests.length;
  const carCount = Math.floor(guestCount * 0.5);
  if (carCount === 0) return;

  // Collect parking tiles
  const parkingTiles: { x: number; y: number }[] = [];
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (tiles[gy]?.[gx]?.type === 'parking') {
        parkingTiles.push({ x: gx, y: gy });
      }
    }
  }
  if (parkingTiles.length === 0) return;

  // Deterministic placement based on guest count
  const carsToShow = Math.min(carCount, parkingTiles.length);
  for (let i = 0; i < carsToShow; i++) {
    const pt = parkingTiles[i % parkingTiles.length];
    drawCar(ctx, pt.x, pt.y, i);
  }
}

function drawCar(ctx: CanvasRenderingContext2D, gx: number, gy: number, seed: number): void {
  const iso = cartToIso(gx, gy);
  const cx = iso.x + HALF_W;
  const cy = iso.y + HALF_H;

  const carColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1'];
  const color = carColors[seed % carColors.length];

  ctx.save();

  // Car body (isometric rectangle)
  const bw = 16;
  const bh = 8;
  const bodyX = cx - bw / 2;
  const bodyY = cy - bh / 2 - 2;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, bw / 2 + 1, bh / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bodyX, bodyY + bh * 0.3);
  ctx.lineTo(bodyX + bw * 0.2, bodyY);
  ctx.lineTo(bodyX + bw * 0.8, bodyY);
  ctx.lineTo(bodyX + bw, bodyY + bh * 0.3);
  ctx.lineTo(bodyX + bw, bodyY + bh);
  ctx.lineTo(bodyX, bodyY + bh);
  ctx.closePath();
  ctx.fill();

  // Roof (darker)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(bodyX + bw * 0.15, bodyY + 1, bw * 0.7, bh * 0.4);

  // Windshield
  ctx.fillStyle = 'rgba(150,200,255,0.6)';
  ctx.fillRect(bodyX + bw * 0.2, bodyY + 1, bw * 0.25, bh * 0.35);

  // Wheels
  ctx.fillStyle = '#222';
  ctx.fillRect(bodyX + 1, bodyY + bh - 1, 3, 2);
  ctx.fillRect(bodyX + bw - 4, bodyY + bh - 1, 3, 2);

  ctx.restore();
}
