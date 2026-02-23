import { Building, BuildingType, GameState } from '../state/types';
import { getBuildingDef, getEffectiveCapacity } from '../state/buildingDefs';
import { Grid } from '../world/Grid';
import {
  cartToIso, drawIsoBox, HALF_W,
  lightenColor, darkenColor, drawIsoDiamond,
} from './IsoEngine';
import { SpriteManager } from './SpriteManager';

/** Wall heights by building tier (scaled for 80x40 tiles) */
function getWallHeight(w: number, h: number): number {
  const area = w * h;
  if (area >= 12) return 38;   // 4x3 hotel
  if (area >= 9) return 30;    // 3x3 grand attractions
  if (area >= 6) return 24;    // 3x2 large facilities
  if (area >= 4) return 18;    // 2x2 medium buildings
  if (w >= 2 || h >= 2) return 14; // 2x1 compact
  return 10;                   // 1x1 infrastructure
}

export function drawIsoBuildings(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  sprites: SpriteManager,
  reachable?: Map<string, number>,
): void {
  // Sort buildings by depth (back to front)
  const sorted = [...state.buildings].sort((a, b) => {
    const da = (a.x + a.y) * 1000 + a.y;
    const db = (b.x + b.y) * 1000 + b.y;
    return da - db;
  });

  for (const b of sorted) {
    drawIsoBuilding(ctx, b, state, sprites, reachable);
  }
}

function drawIsoBuilding(
  ctx: CanvasRenderingContext2D,
  b: Building,
  state: GameState,
  sprites: SpriteManager,
  reachable?: Map<string, number>,
): void {
  const def = getBuildingDef(b.type);

  if (b.isConstructing) {
    drawConstructionSite(ctx, b);
    return;
  }

  const operational = b.powered && !b.damaged;

  // Try to get a sprite
  const spriteKey = `${b.type}_lv${b.level}`;
  const sprite = sprites.get(spriteKey) || sprites.get(b.type);

  if (sprite) {
    drawBuildingSprite(ctx, b, sprite, operational);
  } else {
    drawBuildingProcedural(ctx, b, def.color, operational);
  }

  // Overlays
  drawBuildingOverlays(ctx, b, state, operational, reachable);
}

function drawBuildingSprite(
  ctx: CanvasRenderingContext2D,
  b: Building,
  sprite: HTMLImageElement,
  operational: boolean,
): void {
  // Diamond vertices (same convention as drawIsoBox)
  const topRight = cartToIso(b.x + b.width, b.y);
  const botLeft  = cartToIso(b.x, b.y + b.height);
  const botRight = cartToIso(b.x + b.width, b.y + b.height);

  // Screen-space diamond metrics
  const northX = topRight.x + HALF_W;            // rightmost screen X
  const southX = botLeft.x  + HALF_W;            // leftmost screen X
  const diamondW = northX - southX;              // horizontal span of diamond
  const diamondCX = botRight.x + HALF_W;         // center X (= west X = east X)
  const eastY  = botRight.y;                      // bottommost screen Y (ground)

  // Scale sprite to fit diamond width, keeping aspect ratio
  const scale = diamondW / sprite.width;
  const drawW = diamondW;
  const drawH = sprite.height * scale;

  // Position: centered horizontally on diamond, bottom of sprite at diamond bottom
  const drawX = diamondCX - drawW / 2;
  const drawY = eastY - drawH;

  ctx.save();
  if (!operational) ctx.globalAlpha = 0.5;
  ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function drawBuildingProcedural(
  ctx: CanvasRenderingContext2D,
  b: Building,
  color: string,
  operational: boolean,
): void {
  ctx.save();
  if (!operational) ctx.globalAlpha = 0.5;

  const wallH = getWallHeight(b.width, b.height);
  const topColor = operational ? lightenColor(color, 0.2) : '#aaa';
  const leftColor = operational ? color : '#888';
  const rightColor = operational ? darkenColor(color, 0.25) : '#666';

  drawIsoBox(ctx, b.x, b.y, b.width, b.height, wallH, topColor, leftColor, rightColor);

  const tl = cartToIso(b.x, b.y);           // top
  const tr = cartToIso(b.x + b.width, b.y); // right
  const br = cartToIso(b.x + b.width, b.y + b.height); // bottom
  const bl = cartToIso(b.x, b.y + b.height); // left

  ctx.strokeStyle = operational ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;

  // Top face outline
  ctx.beginPath();
  ctx.moveTo(tl.x + HALF_W, tl.y - wallH);
  ctx.lineTo(tr.x + HALF_W, tr.y - wallH);
  ctx.lineTo(br.x + HALF_W, br.y - wallH);
  ctx.lineTo(bl.x + HALF_W, bl.y - wallH);
  ctx.closePath();
  ctx.stroke();

  // Visible vertical edges (left wall, right wall, bottom corner)
  ctx.beginPath();
  ctx.moveTo(bl.x + HALF_W, bl.y - wallH);
  ctx.lineTo(bl.x + HALF_W, bl.y);
  ctx.moveTo(br.x + HALF_W, br.y - wallH);
  ctx.lineTo(br.x + HALF_W, br.y);
  ctx.moveTo(tr.x + HALF_W, tr.y - wallH);
  ctx.lineTo(tr.x + HALF_W, tr.y);
  ctx.stroke();

  // Bottom edges of walls
  ctx.beginPath();
  ctx.moveTo(bl.x + HALF_W, bl.y);
  ctx.lineTo(br.x + HALF_W, br.y);
  ctx.lineTo(tr.x + HALF_W, tr.y);
  ctx.stroke();

  ctx.restore();
}

function drawBuildingOverlays(
  ctx: CanvasRenderingContext2D,
  b: Building,
  state: GameState,
  operational: boolean,
  reachable?: Map<string, number>,
): void {
  const def = getBuildingDef(b.type);
  const wallH = getWallHeight(b.width, b.height);

  // Center of building's iso footprint, lifted above walls
  const centerIso = cartToIso(b.x + b.width / 2, b.y + b.height / 2);
  const cx = centerIso.x + HALF_W;
  const cy = centerIso.y - wallH - 6;

  // Label -- size scales with building
  const area = b.width * b.height;
  const labelSize = area >= 9 ? 11 : area >= 4 ? 10 : area >= 2 ? 9 : 8;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${labelSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeText(def.label, cx, cy);
  ctx.fillText(def.label, cx, cy);

  // Level stars
  if (b.level > 1) {
    ctx.fillStyle = '#ffeaa7';
    ctx.font = `bold ${labelSize - 1}px sans-serif`;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    const stars = '★'.repeat(b.level);
    ctx.strokeText(stars, cx, cy - labelSize - 2);
    ctx.fillText(stars, cx, cy - labelSize - 2);
  }

  // Status overlays
  if (b.damaged) {
    ctx.fillStyle = 'rgba(255,71,87,0.3)';
    for (let dy = 0; dy < b.height; dy++) {
      for (let dx = 0; dx < b.width; dx++) {
        drawIsoDiamond(ctx, b.x + dx, b.y + dy);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#ff4757';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeText('DAMAGED', cx, cy + 12);
    ctx.fillText('DAMAGED', cx, cy + 12);
  } else if (!b.powered) {
    ctx.fillStyle = '#ffa502';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeText('NO POWER', cx, cy + 12);
    ctx.fillText('NO POWER', cx, cy + 12);
  } else {
    // Capacity badge
    const cap = getEffectiveCapacity(b.type, b.level, b);
    if (cap > 0) {
      const badgeText = `${b.currentGuests}/${cap}`;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = b.currentGuests >= cap ? '#ff4757' : 'rgba(255,255,255,0.9)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeText(badgeText, cx, cy + 12);
      ctx.fillText(badgeText, cx, cy + 12);
    }
  }

  // No path indicator
  if (reachable && !b.isConstructing && !Grid.isBuildingReachable(state.grid, b, reachable)) {
    ctx.fillStyle = '#ffa502';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeText('NO PATH', cx, cy + 20);
    ctx.fillText('NO PATH', cx, cy + 20);
  }

  // Package indicator for accommodation
  if (def.category === 'accommodation' && b.packages.length > 0 && operational) {
    const enabledCount = b.packages.filter(p => p.enabled && p.unlockLevel <= b.level).length;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = enabledCount > 0 ? '#55efc4' : '#ff6b6b';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    const pkgText = `📦${enabledCount}`;
    ctx.strokeText(pkgText, cx + 18, cy - labelSize - 2);
    ctx.fillText(pkgText, cx + 18, cy - labelSize - 2);
  }

  // Adjacency bonus
  if (b.adjacencyBonus !== 0 && operational) {
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    if (b.adjacencyBonus > 0) {
      ctx.fillStyle = '#55efc4';
      ctx.strokeText(`+${Math.round(b.adjacencyBonus * 100)}%`, cx, cy + 20);
      ctx.fillText(`+${Math.round(b.adjacencyBonus * 100)}%`, cx, cy + 20);
    } else {
      ctx.fillStyle = '#ff6b6b';
      ctx.strokeText(`${Math.round(b.adjacencyBonus * 100)}%`, cx, cy + 20);
      ctx.fillText(`${Math.round(b.adjacencyBonus * 100)}%`, cx, cy + 20);
    }
  }
}

function drawConstructionSite(ctx: CanvasRenderingContext2D, b: Building): void {
  const def = getBuildingDef(b.type);
  const wallH = getWallHeight(b.width, b.height);

  // Scaffold: semi-transparent box
  ctx.save();
  ctx.globalAlpha = 0.4;
  drawIsoBox(ctx, b.x, b.y, b.width, b.height, wallH * b.constructionProgress, '#b2bec3', '#9ba6ab', '#7d8a90');
  ctx.restore();

  // Progress bar
  const center = cartToIso(b.x + b.width / 2, b.y + b.height / 2);
  const cx = center.x + HALF_W;
  const cy = center.y - 8;

  ctx.fillStyle = 'rgba(253, 203, 110, 0.7)';
  const barW = 36;
  const barH = 5;
  ctx.fillRect(cx - barW / 2, cy, barW * b.constructionProgress, barH);
  ctx.strokeStyle = '#636e72';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - barW / 2, cy, barW, barH);

  // Label
  ctx.fillStyle = '#2d3436';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(def.label, cx, cy - 2);
  ctx.fillStyle = '#636e72';
  ctx.font = '8px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(`${Math.floor(b.constructionProgress * 100)}%`, cx, cy + barH + 2);
}

// ── Night Lighting Effects ──────────────────────────────────────────

const NEON_BUILDINGS: Partial<Record<BuildingType, string>> = {
  casino: '#ffd700',
  arcade: '#a29bfe',
  cocktail_bar: '#fd79a8',
  event_space: '#e84393',
  beach_bar: '#ff6b6b',
};

const WINDOW_BUILDINGS: BuildingType[] = [
  'hotel', 'restaurant', 'gym', 'coworking', 'spa',
  'kiosk', 'gift_shop', 'rep_office', 'concierge',
];

/**
 * Draw night lighting effects over buildings: window glow, neon outlines,
 * exterior halos. Call after main building rendering.
 */
export function drawNightLighting(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number,
): void {
  const nightAmount = state.dayProgress > 0.7
    ? (state.dayProgress - 0.7) / 0.3
    : 0;

  if (nightAmount <= 0.05) return;

  for (const b of state.buildings) {
    if (b.isConstructing || !b.powered || b.damaged) continue;

    const wallH = getWallHeight(b.width, b.height);

    // Window glow for applicable buildings
    if (WINDOW_BUILDINGS.includes(b.type)) {
      drawWindowGlow(ctx, b, wallH, nightAmount, time);
    }

    // Neon outlines for entertainment buildings
    const neonColor = NEON_BUILDINGS[b.type];
    if (neonColor) {
      drawNeonOutline(ctx, b, wallH, neonColor, nightAmount, time);
    }

    // Exterior light halo for all operational buildings at night
    if (nightAmount > 0.3) {
      drawExteriorHalo(ctx, b, wallH, nightAmount);
    }
  }
}

function drawWindowGlow(
  ctx: CanvasRenderingContext2D,
  b: Building,
  wallH: number,
  nightAmount: number,
  time: number,
): void {
  ctx.save();

  // Calculate iso positions of the left face
  const bl = cartToIso(b.x, b.y + b.height);
  const tl = cartToIso(b.x, b.y);

  const windowRows = Math.max(1, Math.floor(wallH / 10));
  const windowCols = Math.max(1, b.width);

  // Left face windows
  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      const t = (col + row * windowCols) * 0.7;
      const flicker = Math.sin(time / 1500 + t) * 0.15 + 0.85;
      const alpha = nightAmount * 0.5 * flicker;

      // Window position on left face (interpolate along the face)
      const fracX = (col + 0.5) / windowCols;
      const fracY = (row + 0.5) / windowRows;

      const wx = tl.x + HALF_W + (bl.x - tl.x) * fracX;
      const wy = tl.y - wallH + wallH * fracY * 0.8 + (bl.y - tl.y) * fracX;

      ctx.fillStyle = `rgba(255, 220, 100, ${alpha})`;
      ctx.fillRect(wx - 2, wy - 1.5, 4, 3);

      // Glow around window
      ctx.fillStyle = `rgba(255, 200, 80, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(wx, wy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawNeonOutline(
  ctx: CanvasRenderingContext2D,
  b: Building,
  wallH: number,
  color: string,
  nightAmount: number,
  time: number,
): void {
  const pulse = Math.sin(time / 400) * 0.2 + 0.8;
  const alpha = nightAmount * pulse * 0.7;

  const tl = cartToIso(b.x, b.y);
  const tr = cartToIso(b.x + b.width, b.y);
  const br = cartToIso(b.x + b.width, b.y + b.height);
  const bl = cartToIso(b.x, b.y + b.height);

  ctx.save();
  ctx.globalAlpha = alpha;

  // Neon glow (thicker outer line)
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 * nightAmount;

  // Top face outline with neon
  ctx.beginPath();
  ctx.moveTo(tl.x + HALF_W, tl.y - wallH);
  ctx.lineTo(tr.x + HALF_W, tr.y - wallH);
  ctx.lineTo(br.x + HALF_W, br.y - wallH);
  ctx.lineTo(bl.x + HALF_W, bl.y - wallH);
  ctx.closePath();
  ctx.stroke();

  // Vertical edges neon
  ctx.beginPath();
  ctx.moveTo(tl.x + HALF_W, tl.y - wallH);
  ctx.lineTo(tl.x + HALF_W, tl.y);
  ctx.moveTo(bl.x + HALF_W, bl.y - wallH);
  ctx.lineTo(bl.x + HALF_W, bl.y);
  ctx.moveTo(br.x + HALF_W, br.y - wallH);
  ctx.lineTo(br.x + HALF_W, br.y);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawExteriorHalo(
  ctx: CanvasRenderingContext2D,
  b: Building,
  wallH: number,
  nightAmount: number,
): void {
  const center = cartToIso(b.x + b.width / 2, b.y + b.height / 2);
  const cx = center.x + HALF_W;
  const cy = center.y - wallH / 2;

  const radius = Math.max(b.width, b.height) * HALF_W * 0.4;
  const alpha = nightAmount * 0.12;

  ctx.save();
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, `rgba(255, 220, 130, ${alpha})`);
  gradient.addColorStop(1, 'rgba(255, 220, 130, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
