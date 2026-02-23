import { GameState, WeatherType, Guest, GuestSegment } from '../state/types';
import { getBuildingDef, GUEST_SEGMENT_DEFS } from '../state/buildingDefs';
import { getBuildingSize, canAffordBuilding } from '../state/selectors';
import { isValidPlacement } from '../world/Placement';
import { GuestVisualSystem } from './GuestVisuals';
import { StaffVisualSystem, StaffVisual } from './StaffVisuals';
import { Grid } from '../world/Grid';
import { SpriteManager } from './SpriteManager';
import { ParticleSystem } from './ParticleSystem';
import { BuildingAnimationSystem } from './BuildingAnimations';
import {
  cartToIso, screenToGrid as isoScreenToGrid,
  screenToWorld as isoScreenToWorld,
  HALF_W, HALF_H, drawIsoDiamond,
} from './IsoEngine';
import { drawIsoTerrain, drawIsoGrid, drawIsoLandParcels, drawIsoEntrance, drawFence, drawParkedCars } from './IsoTerrain';
import { drawIsoBuildings, drawNightLighting } from './IsoBuildings';

const WEATHER_OVERLAYS: Record<WeatherType, string> = {
  sunny: 'rgba(0,0,0,0)',
  cloudy: 'rgba(100,100,120,0.08)',
  rain: 'rgba(60,80,120,0.15)',
  storm: 'rgba(30,30,60,0.25)',
};

const VALID_PREVIEW = 'rgba(0, 184, 148, 0.45)';
const INVALID_PREVIEW = 'rgba(214, 48, 49, 0.45)';
const HOVER_COLOR = 'rgba(255, 255, 255, 0.25)';

const LITTER_ICONS: Record<string, { char: string; size: number }> = {
  wrapper: { char: '🍬', size: 8 },
  cup:     { char: '🥤', size: 9 },
  bottle:  { char: '🍾', size: 9 },
  napkin:  { char: '📄', size: 7 },
  plate:   { char: '🍽', size: 9 },
};

export class IsoRenderer {
  private ctx: CanvasRenderingContext2D;
  private guestVisuals = new GuestVisualSystem();
  private staffVisuals = new StaffVisualSystem();
  private sprites = new SpriteManager();
  private particles = new ParticleSystem();
  private buildingAnims = new BuildingAnimationSystem();


  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
  }

  render(state: GameState): void {
    const cam = state.camera;
    const zoom = cam.zoom || 1;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background fill: ocean blue (extends infinitely beyond map edges)
    this.ctx.fillStyle = '#0984e3';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.scale(zoom, zoom);
    this.ctx.translate(-cam.x, -cam.y);

    // 0. Extended ocean: draw water beyond grid edges
    this.drawExtendedOcean(state);

    // 1. Terrain (tiles) — pass sprites for road/terrain textures
    drawIsoTerrain(this.ctx, state, this.sprites);

    // 2. Grid lines (subtle)
    drawIsoGrid(this.ctx, state);

    // 3. Land parcel boundaries
    drawIsoLandParcels(this.ctx, state);

    // 4. Fence around owned territory
    drawFence(this.ctx, state);

    // 5. Entrance gate
    drawIsoEntrance(this.ctx, state);

    // 5.5. Parked cars in parking area
    drawParkedCars(this.ctx, state);

    // 6. Adjacency glow
    this.drawAdjacencyGlow(state);

    // 6. Buildings (depth-sorted)
    const hasAnyPaths = state.grid.tiles.some(row => row.some(t => t.type === 'path'));
    const reachable = hasAnyPaths ? Grid.computePathReachable(state.grid, state.entrance) : undefined;
    drawIsoBuildings(this.ctx, state, this.sprites, reachable);

    // 7. Night lighting effects (window glow, neon, halos)
    const now = performance.now();
    drawNightLighting(this.ctx, state, now);

    // 8. Building animations (particle emitters, glow effects)
    this.buildingAnims.update(this.ctx, state, this.particles, now);

    // 9. Update and draw particles
    this.particles.update(now);
    this.particles.draw(this.ctx);

    // 10. Trash bins
    this.drawTrashBins(state);

    // 11. Litter
    this.drawLitter(state);

    // 12. Staff
    this.staffVisuals.update(state, this.ctx, now);

    // 13. Guests
    this.guestVisuals.update(state, this.ctx, now);

    // 11. Selected staff highlight
    if (state.selectedStaff !== null && state.selectedStaff !== undefined) {
      const staffVis = this.staffVisuals.getVisual(state.selectedStaff);
      if (staffVis) {
        this.staffVisuals.drawSelectedHighlight(this.ctx, staffVis, performance.now());
      }
    }

    this.ctx.restore();

    // UI overlays in world space
    this.ctx.save();
    this.ctx.scale(zoom, zoom);
    this.ctx.translate(-cam.x, -cam.y);
    this.drawGuestOverlay(state);
    this.drawHoverPreview(state);
    this.drawSelectedHighlight(state);
    this.ctx.restore();

    // Screen-space overlays
    this.drawEventBanner(state);
    this.drawWeatherOverlay(state);
    this.drawDayNightOverlay(state);
  }

  // ── Extended Ocean ───────────────────────────────────────────────

  private drawExtendedOcean(state: GameState): void {
    const { width, height } = state.grid;
    const time = performance.now() / 1000;

    // Draw extra water rows beyond the grid to fill visible area
    const EXTRA = 15;
    for (let gy = height; gy < height + EXTRA; gy++) {
      for (let gx = -EXTRA; gx < width + EXTRA; gx++) {
        this.ctx.fillStyle = '#0984e3';
        drawIsoDiamond(this.ctx, gx, gy);
        this.ctx.fill();

        // Wave sparkle
        const wave = Math.sin(time * 2 + gx * 0.7 + gy * 0.5) * 0.5 + 0.5;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${wave * 0.1})`;
        drawIsoDiamond(this.ctx, gx, gy);
        this.ctx.fill();
      }
    }

    // Also fill sides with water color for a seamless look
    for (let gy = 0; gy < height + EXTRA; gy++) {
      for (let gx = -EXTRA; gx < 0; gx++) {
        this.ctx.fillStyle = '#74b9ff';
        drawIsoDiamond(this.ctx, gx, gy);
        this.ctx.fill();
      }
      for (let gx = width; gx < width + EXTRA; gx++) {
        this.ctx.fillStyle = '#74b9ff';
        drawIsoDiamond(this.ctx, gx, gy);
        this.ctx.fill();
      }
    }
    // Top rows beyond grid
    for (let gy = -EXTRA; gy < 0; gy++) {
      for (let gx = -EXTRA; gx < width + EXTRA; gx++) {
        this.ctx.fillStyle = '#a8d8ea';
        drawIsoDiamond(this.ctx, gx, gy);
        this.ctx.fill();
      }
    }
  }

  // ── Adjacency Glow ──────────────────────────────────────────────

  private drawAdjacencyGlow(state: GameState): void {
    for (const b of state.buildings) {
      if (b.isConstructing || b.adjacencyBonus === 0) continue;

      const alpha = b.adjacencyBonus > 0
        ? Math.min(0.15, b.adjacencyBonus * 0.3)
        : Math.min(0.12, Math.abs(b.adjacencyBonus) * 0.3);
      const color = b.adjacencyBonus > 0
        ? `rgba(85, 239, 196, ${alpha})`
        : `rgba(255, 71, 87, ${alpha})`;

      this.ctx.fillStyle = color;
      for (let dy = 0; dy < b.height; dy++) {
        for (let dx = 0; dx < b.width; dx++) {
          drawIsoDiamond(this.ctx, b.x + dx, b.y + dy);
          this.ctx.fill();
        }
      }
    }
  }

  // ── Litter ──────────────────────────────────────────────────────

  private drawLitter(state: GameState): void {
    if (!state.litter || state.litter.items.length === 0) return;
    for (const item of state.litter.items) {
      const worldX = item.x + item.offsetX;
      const worldY = item.y + item.offsetY;
      const iso = cartToIso(worldX, worldY);
      const info = LITTER_ICONS[item.type] || LITTER_ICONS.wrapper;

      this.ctx.save();
      this.ctx.font = `${info.size}px serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.globalAlpha = 0.85;
      this.ctx.fillText(info.char, iso.x + HALF_W, iso.y + HALF_H);
      this.ctx.restore();
    }
  }

  // ── Trash Bins ──────────────────────────────────────────────────

  private drawTrashBins(state: GameState): void {
    if (!state.trashBins || state.trashBins.length === 0) return;
    for (const bin of state.trashBins) {
      const iso = cartToIso(bin.x, bin.y);
      const cx = iso.x + HALF_W + 15;
      const cy = iso.y + HALF_H - 5;

      // Shadow
      this.ctx.fillStyle = 'rgba(0,0,0,0.12)';
      this.ctx.fillRect(cx - 4, cy + 1, 10, 12);

      // Body
      this.ctx.fillStyle = '#636e72';
      this.ctx.beginPath();
      this.ctx.moveTo(cx - 3, cy + 3);
      this.ctx.lineTo(cx + 7, cy + 3);
      this.ctx.lineTo(cx + 6, cy + 12);
      this.ctx.lineTo(cx - 2, cy + 12);
      this.ctx.closePath();
      this.ctx.fill();

      // Lid
      this.ctx.fillStyle = '#2d3436';
      this.ctx.fillRect(cx - 5, cy, 12, 3);
    }
  }

  // ── Guest Overlay ───────────────────────────────────────────────

  private drawGuestOverlay(state: GameState): void {
    if (state.guests.length === 0) return;
    const cam = state.camera;
    const padding = 8;
    const boxW = 150;
    const lineH = 12;

    const segCounts: Partial<Record<GuestSegment, number>> = {};
    for (const g of state.guests) {
      segCounts[g.segment] = (segCounts[g.segment] ?? 0) + 1;
    }
    const segLines = (Object.entries(segCounts) as [GuestSegment, number][]).filter(([, c]) => c > 0);
    const boxH = 42 + segLines.length * lineH;

    const bx = cam.x + padding;
    const by = cam.y + this.canvas.height / (cam.zoom || 1) - boxH - padding;

    this.ctx.fillStyle = 'rgba(15, 15, 40, 0.8)';
    this.ctx.beginPath();
    this.roundedRect(bx, by, boxW, boxH, 6);
    this.ctx.fill();

    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`Guests: ${state.guests.length}`, bx + 8, by + 5);

    const avgHappy = state.guests.reduce((s, g) => s + g.happiness, 0) / state.guests.length;
    const barX = bx + 8;
    const barY = by + 20;
    const barW = boxW - 16;
    const barH = 6;

    this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this.ctx.fillRect(barX, barY, barW, barH);
    const hue = (avgHappy / 100) * 120;
    this.ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    this.ctx.fillRect(barX, barY, barW * (avgHappy / 100), barH);

    this.ctx.fillStyle = '#aaa';
    this.ctx.font = '9px sans-serif';
    this.ctx.fillText(`Mood: ${Math.round(avgHappy)}%`, barX, barY + 9);

    let yOff = barY + 22;
    for (const [seg, count] of segLines) {
      const def = GUEST_SEGMENT_DEFS[seg];
      this.ctx.fillStyle = def.color;
      this.ctx.beginPath();
      this.ctx.arc(barX + 4, yOff + 4, 3, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#ccc';
      this.ctx.font = '9px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`${def.label}: ${count}`, barX + 12, yOff);
      yOff += lineH;
    }
  }

  // ── Hover Preview ───────────────────────────────────────────────

  private drawHoverPreview(state: GameState): void {
    if (!state.hoveredTile) return;
    const { x, y } = state.hoveredTile;

    // Highlight hovered tile
    this.ctx.fillStyle = HOVER_COLOR;
    drawIsoDiamond(this.ctx, x, y);
    this.ctx.fill();

    if (state.buildMode === 'path') {
      const tile = state.grid.tiles[y]?.[x];
      const canPlace = tile && (tile.type === 'sand' || tile.type === 'beach_sand') && state.money >= 1;
      this.ctx.fillStyle = canPlace ? 'rgba(200, 200, 180, 0.6)' : INVALID_PREVIEW;
      drawIsoDiamond(this.ctx, x, y);
      this.ctx.fill();
      this.ctx.strokeStyle = canPlace ? '#bfbfaa' : '#d63031';
      this.ctx.lineWidth = 2;
      drawIsoDiamond(this.ctx, x, y);
      this.ctx.stroke();
    } else if (state.buildMode === 'bin') {
      const tile = state.grid.tiles[y]?.[x];
      const hasBin = state.trashBins?.some(b => b.x === x && b.y === y);
      const canPlace = tile && (tile.type === 'path' || tile.type === 'beach_sand') && !hasBin && state.money >= 15;
      this.ctx.fillStyle = canPlace ? 'rgba(99, 110, 114, 0.4)' : INVALID_PREVIEW;
      drawIsoDiamond(this.ctx, x, y);
      this.ctx.fill();
      this.ctx.strokeStyle = canPlace ? '#636e72' : '#d63031';
      this.ctx.lineWidth = 2;
      drawIsoDiamond(this.ctx, x, y);
      this.ctx.stroke();
    } else if (state.buildMode) {
      const bm = state.buildMode as import('../state/types').BuildingType;
      const def = getBuildingDef(bm);
      const size = getBuildingSize(bm);
      const hasMoney = canAffordBuilding(state, bm);
      const valid = hasMoney && isValidPlacement(state.grid, x, y, size.width, size.height, hasMoney, def);

      // Fill all tiles in the building footprint
      for (let dy = 0; dy < size.height; dy++) {
        for (let dx = 0; dx < size.width; dx++) {
          this.ctx.fillStyle = valid ? VALID_PREVIEW : INVALID_PREVIEW;
          drawIsoDiamond(this.ctx, x + dx, y + dy);
          this.ctx.fill();
        }
      }

      // Outline the whole footprint
      const tl = cartToIso(x, y);
      const tr = cartToIso(x + size.width, y);
      const br = cartToIso(x + size.width, y + size.height);
      const bl = cartToIso(x, y + size.height);

      this.ctx.strokeStyle = valid ? '#00b894' : '#d63031';
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.moveTo(tl.x + HALF_W, tl.y);
      this.ctx.lineTo(tr.x + HALF_W, tr.y);
      this.ctx.lineTo(br.x + HALF_W, br.y);
      this.ctx.lineTo(bl.x + HALF_W, bl.y);
      this.ctx.closePath();
      this.ctx.stroke();

      // Terrain hint
      const terrainLabel = def.terrain === 'beach' ? '🏖️ Beach only' : def.terrain === 'land' ? '🏗️ Land only' : '';
      if (terrainLabel && !valid) {
        const center = cartToIso(x + size.width / 2, y + size.height / 2);
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.font = 'bold 10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(terrainLabel, center.x + HALF_W, center.y - 10);
      }
    }
  }

  // ── Selected Building Highlight ─────────────────────────────────

  private drawSelectedHighlight(state: GameState): void {
    if (state.selectedBuilding === null) return;
    const b = state.buildings.find(bl => bl.id === state.selectedBuilding);
    if (!b) return;

    const tl = cartToIso(b.x, b.y);
    const tr = cartToIso(b.x + b.width, b.y);
    const br = cartToIso(b.x + b.width, b.y + b.height);
    const bl = cartToIso(b.x, b.y + b.height);

    this.ctx.strokeStyle = '#55efc4';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([6, 3]);
    this.ctx.beginPath();
    this.ctx.moveTo(tl.x + HALF_W, tl.y);
    this.ctx.lineTo(tr.x + HALF_W, tr.y);
    this.ctx.lineTo(br.x + HALF_W, br.y);
    this.ctx.lineTo(bl.x + HALF_W, bl.y);
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  // ── Event Banner ────────────────────────────────────────────────

  private drawEventBanner(state: GameState): void {
    const active = state.events.filter(e => e.daysRemaining >= 0);
    if (active.length === 0) return;

    const banner = active[0];
    const bw = 280;
    const bh = 28;
    const bx = (this.canvas.width - bw) / 2;
    const by = 4;

    this.ctx.fillStyle = 'rgba(233, 69, 96, 0.9)';
    this.ctx.beginPath();
    this.roundedRect(bx, by, bw, bh, 6);
    this.ctx.fill();

    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const text = banner.daysRemaining > 0
      ? `${banner.title} (${banner.daysRemaining}d left)`
      : banner.title;
    this.ctx.fillText(text, bx + bw / 2, by + bh / 2);
  }

  // ── Weather Overlay ─────────────────────────────────────────────

  private drawWeatherOverlay(state: GameState): void {
    const overlay = WEATHER_OVERLAYS[state.weather.current];
    if (overlay === 'rgba(0,0,0,0)') return;
    this.ctx.fillStyle = overlay;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (state.weather.current === 'rain' || state.weather.current === 'storm') {
      this.ctx.strokeStyle = 'rgba(100,150,255,0.2)';
      this.ctx.lineWidth = 1;
      const time = performance.now() / 100;
      const count = state.weather.current === 'storm' ? 60 : 25;
      for (let i = 0; i < count; i++) {
        const rx = ((i * 47 + time * 2) % this.canvas.width);
        const ry = ((i * 31 + time * 5) % this.canvas.height);
        this.ctx.beginPath();
        this.ctx.moveTo(rx, ry);
        this.ctx.lineTo(rx - 3, ry + 10);
        this.ctx.stroke();
      }
    }
  }

  // ── Day/Night Overlay ───────────────────────────────────────────

  private drawDayNightOverlay(state: GameState): void {
    if (state.dayProgress > 0.7) {
      const nightAmount = (state.dayProgress - 0.7) / 0.3;
      this.ctx.fillStyle = `rgba(10, 10, 40, ${nightAmount * 0.15})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // ── Utilities ───────────────────────────────────────────────────

  private roundedRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.arcTo(x + w, y, x + w, y + r, r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.arcTo(x, y + h, x, y + h - r, r);
    this.ctx.lineTo(x, y + r);
    this.ctx.arcTo(x, y, x + r, y, r);
    this.ctx.closePath();
  }

  // ── Public API for input handling ───────────────────────────────

  screenToGrid(screenX: number, screenY: number, camera: { x: number; y: number; zoom?: number }): { x: number; y: number } {
    return isoScreenToGrid(screenX, screenY, this.canvas, camera);
  }

  screenToWorld(screenX: number, screenY: number, camera: { x: number; y: number; zoom?: number }): { x: number; y: number } {
    return isoScreenToWorld(screenX, screenY, this.canvas, camera);
  }

  getGuestAtScreen(screenX: number, screenY: number, camera: { x: number; y: number; zoom?: number }, guests: Guest[]): number | null {
    const world = this.screenToWorld(screenX, screenY, camera);
    return this.guestVisuals.getGuestAtPosition(world.x, world.y, guests);
  }

  getGuestVisualPosition(guestId: number): { x: number; y: number } | null {
    return this.guestVisuals.getVisual(guestId);
  }

  getStaffAtScreen(screenX: number, screenY: number, camera: { x: number; y: number; zoom?: number }): StaffVisual | null {
    const world = this.screenToWorld(screenX, screenY, camera);
    return this.staffVisuals.getStaffAtPosition(world.x, world.y);
  }

  getStaffVisual(staffId: number): StaffVisual | null {
    return this.staffVisuals.getVisual(staffId);
  }
}
