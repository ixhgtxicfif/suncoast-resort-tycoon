import { GameState, Building, WeatherType, GuestSegment, Guest } from '../state/types';
import { getBuildingDef, getEffectiveCapacity, GUEST_SEGMENT_DEFS } from '../state/buildingDefs';
import { getBuildingSize, canAffordBuilding } from '../state/selectors';
import { isValidPlacement } from '../world/Placement';
import { GuestVisualSystem } from './GuestVisuals';
import { StaffVisualSystem, StaffVisual } from './StaffVisuals';
import { GRID_WIDTH, GRID_HEIGHT, WATER_ROWS, LAND_PARCEL_SIZE } from '../state/initialState';
import { Grid } from '../world/Grid';

const TILE_SIZE = 42;
const SAND_COLOR = '#f6e58d';
const SAND_COLOR_ALT = '#f9e88f';
const BEACH_SAND_COLOR = '#ffe4b5';
const BEACH_SAND_COLOR_ALT = '#ffd9a0';
const GRID_LINE_COLOR = 'rgba(218, 165, 32, 0.35)';
const VALID_PREVIEW = 'rgba(0, 184, 148, 0.45)';
const INVALID_PREVIEW = 'rgba(214, 48, 49, 0.45)';
const HOVER_COLOR = 'rgba(255, 255, 255, 0.25)';

const WATER_COLOR_DEEP = '#0984e3';
const WATER_COLOR_MID = '#74b9ff';
const WATER_COLOR_SHALLOW = '#a8d8ea';
const UNOWNED_OVERLAY = 'rgba(50, 50, 50, 0.35)';
const PATH_COLOR = '#c8c8b4';
const PATH_BORDER = 'rgba(160, 150, 120, 0.4)';
const ENTRANCE_COLOR = '#55efc4';

const WEATHER_OVERLAYS: Record<WeatherType, string> = {
  sunny: 'rgba(0,0,0,0)',
  cloudy: 'rgba(100,100,120,0.08)',
  rain: 'rgba(60,80,120,0.15)',
  storm: 'rgba(30,30,60,0.25)',
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private guestVisuals = new GuestVisualSystem();
  private staffVisuals = new StaffVisualSystem();

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
  }

  render(state: GameState): void {
    const cam = state.camera;
    const zoom = cam.zoom || 1;

    // Clear the entire canvas (visible when zoomed out)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.scale(zoom, zoom);
    this.ctx.translate(-cam.x, -cam.y);

    this.clear(state);
    this.drawGrid(state);
    this.drawLandParcels(state);
    this.drawEntrance(state);
    this.drawAdjacencyGlow(state);
    this.drawBuildings(state);
    this.drawTrashBins(state);
    this.drawLitter(state);
    this.staffVisuals.update(state, this.ctx, performance.now());
    this.guestVisuals.update(state, this.ctx, performance.now());

    // Draw selected staff highlight
    if (state.selectedStaff !== null && state.selectedStaff !== undefined) {
      const staffVis = this.staffVisuals.getVisual(state.selectedStaff);
      if (staffVis) {
        this.staffVisuals.drawSelectedHighlight(this.ctx, staffVis, performance.now());
      }
    }

    this.ctx.restore();

    // UI overlays drawn in screen space (not affected by camera)
    this.ctx.save();
    this.ctx.scale(zoom, zoom);
    this.ctx.translate(-cam.x, -cam.y);
    this.drawGuestOverlay(state);
    this.drawHoverPreview(state);
    this.drawSelectedHighlight(state);
    this.ctx.restore();

    this.drawEventBanner(state);
    this.drawWeatherOverlay(state);
    this.drawDayNightOverlay(state);
  }

  private clear(state: GameState): void {
    const { width, height } = state.grid;
    const waterStartY = height - WATER_ROWS;
    const time = performance.now() / 1000;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = state.grid.tiles[y]?.[x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (!tile || tile.type === 'water') {
          // Water rendering with wave animation
          const rowFromWater = y - waterStartY;
          if (rowFromWater === 0) {
            this.ctx.fillStyle = WATER_COLOR_SHALLOW;
          } else if (rowFromWater === 1) {
            this.ctx.fillStyle = WATER_COLOR_MID;
          } else {
            this.ctx.fillStyle = WATER_COLOR_DEEP;
          }
          this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

          // Wave sparkle
          const wave = Math.sin(time * 2 + x * 0.7 + y * 0.5) * 0.5 + 0.5;
          this.ctx.fillStyle = `rgba(255, 255, 255, ${wave * 0.12})`;
          this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

          // Beach foam on first water row
          if (rowFromWater === 0) {
            const foam = Math.sin(time * 1.5 + x * 0.8) * 0.5 + 0.5;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${foam * 0.3})`;
            this.ctx.fillRect(px, py, TILE_SIZE, 4);
          }
        } else if (tile.type === 'path') {
          // Draw sand background first (path is ON sand)
          const isBeachRow = y >= (height - WATER_ROWS - 2) && y < waterStartY;
          if (isBeachRow) {
            this.ctx.fillStyle = (x + y) % 2 === 0 ? BEACH_SAND_COLOR : BEACH_SAND_COLOR_ALT;
          } else {
            this.ctx.fillStyle = (x + y) % 2 === 0 ? SAND_COLOR : SAND_COLOR_ALT;
          }
          this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

          // Auto-tile: detect neighbors
          const hasN = state.grid.tiles[y - 1]?.[x]?.type === 'path' || state.grid.tiles[y - 1]?.[x]?.type === 'occupied';
          const hasS = state.grid.tiles[y + 1]?.[x]?.type === 'path' || state.grid.tiles[y + 1]?.[x]?.type === 'occupied';
          const hasW = state.grid.tiles[y]?.[x - 1]?.type === 'path' || state.grid.tiles[y]?.[x - 1]?.type === 'occupied';
          const hasE = state.grid.tiles[y]?.[x + 1]?.type === 'path' || state.grid.tiles[y]?.[x + 1]?.type === 'occupied';

          // Entrance counts as neighbor
          const isEntrance = state.entrance && x === state.entrance.x && y === state.entrance.y;
          const adjEntX = state.entrance ? state.entrance.x : -1;
          const adjEntY = state.entrance ? state.entrance.y : -1;
          const nearEntN = adjEntX === x && adjEntY === y - 1;
          const nearEntS = adjEntX === x && adjEntY === y + 1;
          const nearEntW = adjEntX === x - 1 && adjEntY === y;
          const nearEntE = adjEntX === x + 1 && adjEntY === y;

          const n = hasN || nearEntN;
          const s = hasS || nearEntS;
          const w = hasW || nearEntW;
          const e = hasE || nearEntE;

          const PATH_W = 14; // path strip width
          const cx = px + TILE_SIZE / 2;
          const cy = py + TILE_SIZE / 2;
          const half = PATH_W / 2;

          this.ctx.fillStyle = PATH_COLOR;

          // Central square (always drawn)
          this.ctx.fillRect(cx - half, cy - half, PATH_W, PATH_W);

          // Extensions toward neighbors
          if (n) this.ctx.fillRect(cx - half, py, PATH_W, TILE_SIZE / 2 - half);
          if (s) this.ctx.fillRect(cx - half, cy + half, PATH_W, TILE_SIZE / 2 - half);
          if (w) this.ctx.fillRect(px, cy - half, TILE_SIZE / 2 - half, PATH_W);
          if (e) this.ctx.fillRect(cx + half, cy - half, TILE_SIZE / 2 - half, PATH_W);

          // If no connections, draw as a small pad
          if (!n && !s && !w && !e && !isEntrance) {
            this.ctx.fillRect(cx - half - 2, cy - half - 2, PATH_W + 4, PATH_W + 4);
          }

          // Subtle border on path surface
          this.ctx.strokeStyle = PATH_BORDER;
          this.ctx.lineWidth = 0.5;
          // Draw border segments
          if (n) this.ctx.strokeRect(cx - half, py, PATH_W, TILE_SIZE / 2 + half);
          if (s) this.ctx.strokeRect(cx - half, cy - half, PATH_W, TILE_SIZE / 2 + half);
          if (w) this.ctx.strokeRect(px, cy - half, TILE_SIZE / 2 + half, PATH_W);
          if (e) this.ctx.strokeRect(cx - half, cy - half, TILE_SIZE / 2 + half, PATH_W);
          if (!n && !s && !w && !e) {
            this.ctx.strokeRect(cx - half, cy - half, PATH_W, PATH_W);
          }
        } else if (tile.type === 'beach_sand') {
          // Beach zone: warmer sand near the water
          this.ctx.fillStyle = (x + y) % 2 === 0 ? BEACH_SAND_COLOR : BEACH_SAND_COLOR_ALT;
          this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          // Small beach items for visual interest
          const seed = x * 31 + y * 17;
          if (seed % 7 === 0) {
            // Towel
            const towelColors = ['#ff6b6b', '#74b9ff', '#55efc4', '#fd79a8'];
            this.ctx.fillStyle = towelColors[seed % towelColors.length];
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillRect(px + 8, py + 14, 24, 14);
            this.ctx.globalAlpha = 1.0;
          } else if (seed % 11 === 0) {
            // Umbrella
            this.ctx.fillStyle = 'rgba(255,100,100,0.25)';
            this.ctx.beginPath();
            this.ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 10, 0, Math.PI * 2);
            this.ctx.fill();
          }
        } else if (tile.type === 'unowned') {
          // Unowned: sand with dark overlay
          this.ctx.fillStyle = (x + y) % 2 === 0 ? SAND_COLOR : SAND_COLOR_ALT;
          this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          this.ctx.fillStyle = UNOWNED_OVERLAY;
          this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else {
          // Regular sand (owned)
          this.ctx.fillStyle = (x + y) % 2 === 0 ? SAND_COLOR : SAND_COLOR_ALT;
          this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }

        // Beach foam effect on sand tiles adjacent to water
        if (tile && tile.type !== 'water' && y === waterStartY - 1) {
          const foam = Math.sin(time * 1.2 + x * 0.6) * 0.5 + 0.5;
          this.ctx.fillStyle = `rgba(168, 216, 234, ${foam * 0.2})`;
          this.ctx.fillRect(px, py + TILE_SIZE - 6, TILE_SIZE, 6);
        }
      }
    }
  }

  private drawGrid(state: GameState): void {
    const { width, height } = state.grid;
    const waterStartY = height - WATER_ROWS;
    this.ctx.strokeStyle = GRID_LINE_COLOR;
    this.ctx.lineWidth = 1;

    // Only draw grid on land area
    for (let x = 0; x <= width; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * TILE_SIZE, 0);
      this.ctx.lineTo(x * TILE_SIZE, waterStartY * TILE_SIZE);
      this.ctx.stroke();
    }
    for (let y = 0; y <= waterStartY; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * TILE_SIZE);
      this.ctx.lineTo(width * TILE_SIZE, y * TILE_SIZE);
      this.ctx.stroke();
    }
  }

  // ── Land Parcel Boundaries ──────────────────────────────────────

  private drawLandParcels(state: GameState): void {
    if (!state.buildMode || state.buildMode !== null) {
      // Draw parcel boundaries on unowned land to show purchasable areas
      const waterStartY = GRID_HEIGHT - WATER_ROWS;
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([3, 3]);

      for (let py = 0; py < waterStartY; py += LAND_PARCEL_SIZE) {
        for (let px = 0; px < GRID_WIDTH; px += LAND_PARCEL_SIZE) {
          // Check if any tile in this parcel is unowned
          let hasUnowned = false;
          for (let dy = 0; dy < LAND_PARCEL_SIZE && !hasUnowned; dy++) {
            for (let dx = 0; dx < LAND_PARCEL_SIZE && !hasUnowned; dx++) {
              const tile = state.grid.tiles[py + dy]?.[px + dx];
              if (tile && tile.type === 'unowned') hasUnowned = true;
            }
          }
          if (hasUnowned) {
            this.ctx.strokeRect(
              px * TILE_SIZE, py * TILE_SIZE,
              LAND_PARCEL_SIZE * TILE_SIZE, LAND_PARCEL_SIZE * TILE_SIZE
            );
          }
        }
      }
      this.ctx.setLineDash([]);
    }
  }

  // ── Entrance Marker ────────────────────────────────────────────

  private drawEntrance(state: GameState): void {
    const ent = state.entrance;
    if (!ent) return;
    const px = ent.x * TILE_SIZE;
    const py = ent.y * TILE_SIZE;

    // Pulsing entrance gate
    const pulse = Math.sin(performance.now() / 500) * 0.15 + 0.85;
    this.ctx.fillStyle = `rgba(85, 239, 196, ${0.3 * pulse})`;
    this.ctx.fillRect(px - 2, py - 2, TILE_SIZE + 4, TILE_SIZE + 4);

    this.ctx.strokeStyle = ENTRANCE_COLOR;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

    this.ctx.fillStyle = ENTRANCE_COLOR;
    this.ctx.font = 'bold 9px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('GATE', px + TILE_SIZE / 2, py + TILE_SIZE / 2);
  }

  // ── Adjacency Glow ──────────────────────────────────────────────

  private drawAdjacencyGlow(state: GameState): void {
    for (const b of state.buildings) {
      if (b.isConstructing || b.adjacencyBonus === 0) continue;
      const px = b.x * TILE_SIZE;
      const py = b.y * TILE_SIZE;
      const pw = b.width * TILE_SIZE;
      const ph = b.height * TILE_SIZE;

      if (b.adjacencyBonus > 0) {
        this.ctx.fillStyle = `rgba(85, 239, 196, ${Math.min(0.15, b.adjacencyBonus * 0.3)})`;
      } else {
        this.ctx.fillStyle = `rgba(255, 71, 87, ${Math.min(0.12, Math.abs(b.adjacencyBonus) * 0.3)})`;
      }
      this.ctx.fillRect(px - 2, py - 2, pw + 4, ph + 4);
    }
  }

  // ── Buildings ────────────────────────────────────────────────────

  private drawBuildings(state: GameState): void {
    const hasAnyPaths = state.grid.tiles.some(row => row.some(t => t.type === 'path'));
    const reachable = hasAnyPaths ? Grid.computePathReachable(state.grid, state.entrance) : undefined;
    for (const b of state.buildings) this.drawBuilding(b, state, reachable);
  }

  private drawBuilding(b: Building, _state: GameState, reachable?: Map<string, number>): void {
    const def = getBuildingDef(b.type);
    const px = b.x * TILE_SIZE;
    const py = b.y * TILE_SIZE;
    const pw = b.width * TILE_SIZE;
    const ph = b.height * TILE_SIZE;
    const pad = 2;

    if (b.isConstructing) {
      this.drawConstructionSite(px, py, pw, ph, pad, b.constructionProgress, def.label);
      return;
    }

    const operational = b.powered && !b.damaged;
    this.ctx.fillStyle = operational ? def.color : '#888';
    this.ctx.globalAlpha = operational ? 1.0 : 0.5;
    this.ctx.fillRect(px + pad, py + pad, pw - pad * 2, ph - pad * 2);
    this.ctx.globalAlpha = 1.0;

    this.ctx.strokeStyle = b.damaged ? '#ff4757' : '#2d3436';
    this.ctx.lineWidth = b.damaged ? 2.5 : 1.5;
    this.ctx.strokeRect(px + pad, py + pad, pw - pad * 2, ph - pad * 2);

    // Label
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(def.label, px + pw / 2, py + ph / 2 - 6);

    // Level stars (top-left corner)
    if (b.level > 1) {
      this.ctx.fillStyle = '#ffeaa7';
      this.ctx.font = 'bold 9px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText('★'.repeat(b.level), px + 4, py + 10);
    }

    // Package indicator for accommodation (top-right corner)
    if (def.category === 'accommodation' && b.packages.length > 0 && operational) {
      const enabledCount = b.packages.filter(p => p.enabled && p.unlockLevel <= b.level).length;
      this.ctx.font = 'bold 8px sans-serif';
      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = enabledCount > 0 ? '#55efc4' : '#ff6b6b';
      this.ctx.fillText(`📦${enabledCount}`, px + pw - 3, py + 10);
    } else if (b.offerings && b.offerings.length > 1 && operational) {
      const activeOfferings = b.offerings.filter(o => o.enabled && o.unlockLevel <= b.level && o.unlockLevel > 1).length;
      if (activeOfferings > 0) {
        this.ctx.font = 'bold 8px sans-serif';
        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = '#55efc4';
        this.ctx.fillText(`+${activeOfferings}`, px + pw - 3, py + 10);
      }
    }

    // Status overlays
    if (b.damaged) {
      this.ctx.fillStyle = 'rgba(255,71,87,0.3)';
      this.ctx.fillRect(px + pad, py + pad, pw - pad * 2, ph - pad * 2);
      this.ctx.fillStyle = '#ff4757';
      this.ctx.font = 'bold 9px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('DAMAGED', px + pw / 2, py + ph / 2 + 7);
    } else if (!b.powered) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
      this.ctx.fillRect(px + pad, py + pad, pw - pad * 2, ph - pad * 2);
      this.ctx.fillStyle = '#ffa502';
      this.ctx.font = 'bold 8px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('NO POWER', px + pw / 2, py + ph / 2 + 7);
    } else {
      const cap = getEffectiveCapacity(b.type, b.level, b);
      if (cap > 0) {
        const badgeText = `${b.currentGuests}/${cap}`;
        this.ctx.font = '9px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = b.currentGuests >= cap ? 'rgba(214,48,49,0.9)' : 'rgba(0,0,0,0.55)';
        this.ctx.fillText(badgeText, px + pw / 2, py + ph / 2 + 7);
      }
    }

    // Disconnected from paths indicator
    if (reachable && !b.isConstructing && !Grid.isBuildingReachable(_state.grid, b, reachable)) {
      this.ctx.fillStyle = 'rgba(255,165,0,0.25)';
      this.ctx.fillRect(px + pad, py + pad, pw - pad * 2, ph - pad * 2);
      this.ctx.fillStyle = '#ffa502';
      this.ctx.font = 'bold 8px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('NO PATH', px + pw / 2, py + ph - 6);
    }

    // Price indicator (non-accommodation)
    if (def.category !== 'accommodation' && b.priceMultiplier !== 1.0 && operational) {
      const priceLabel = `${b.priceMultiplier.toFixed(1)}x`;
      this.ctx.font = 'bold 8px sans-serif';
      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = b.priceMultiplier > 1.3 ? '#ff4757' : b.priceMultiplier < 0.8 ? '#2ed573' : '#fff';
      this.ctx.fillText(priceLabel, px + pw - 4, py + 10);
    }

    // Adjacency bonus indicator
    if (b.adjacencyBonus !== 0 && operational) {
      this.ctx.font = 'bold 8px sans-serif';
      this.ctx.textAlign = 'left';
      if (b.adjacencyBonus > 0) {
        this.ctx.fillStyle = '#55efc4';
        this.ctx.fillText(`+${Math.round(b.adjacencyBonus * 100)}%`, px + 3, py + ph - 4);
      } else {
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.fillText(`${Math.round(b.adjacencyBonus * 100)}%`, px + 3, py + ph - 4);
      }
    }
  }

  private drawConstructionSite(px: number, py: number, pw: number, ph: number, pad: number, progress: number, label: string): void {
    this.ctx.fillStyle = '#b2bec3';
    this.ctx.globalAlpha = 0.4;
    this.ctx.fillRect(px + pad, py + pad, pw - pad * 2, ph - pad * 2);
    this.ctx.globalAlpha = 1.0;

    const fillH = (ph - pad * 2) * progress;
    this.ctx.fillStyle = 'rgba(253, 203, 110, 0.6)';
    this.ctx.fillRect(px + pad, py + ph - pad - fillH, pw - pad * 2, fillH);

    this.ctx.strokeStyle = '#636e72';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 3]);
    this.ctx.strokeRect(px + pad, py + pad, pw - pad * 2, ph - pad * 2);
    this.ctx.setLineDash([]);

    this.ctx.fillStyle = '#2d3436';
    this.ctx.font = 'bold 10px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, px + pw / 2, py + ph / 2 - 5);
    this.ctx.font = '9px sans-serif';
    this.ctx.fillText(`${Math.floor(progress * 100)}%`, px + pw / 2, py + ph / 2 + 7);
  }

  private drawSelectedHighlight(state: GameState): void {
    if (state.selectedBuilding === null) return;
    const b = state.buildings.find(bl => bl.id === state.selectedBuilding);
    if (!b) return;
    const px = b.x * TILE_SIZE;
    const py = b.y * TILE_SIZE;
    const pw = b.width * TILE_SIZE;
    const ph = b.height * TILE_SIZE;

    this.ctx.strokeStyle = '#55efc4';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([6, 3]);
    this.ctx.strokeRect(px, py, pw, ph);
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

  // ── Litter Rendering ─────────────────────────────────────────────

  private static readonly LITTER_ICONS: Record<string, { char: string; color: string; size: number }> = {
    wrapper: { char: '🍬', color: '#e17055', size: 8 },
    cup:     { char: '🥤', color: '#74b9ff', size: 9 },
    bottle:  { char: '🍾', color: '#00b894', size: 9 },
    napkin:  { char: '📄', color: '#dfe6e9', size: 7 },
    plate:   { char: '🍽', color: '#fdcb6e', size: 9 },
  };

  private drawLitter(state: GameState): void {
    if (!state.litter || state.litter.items.length === 0) return;
    const ctx = this.ctx;

    for (const item of state.litter.items) {
      const px = item.x * TILE_SIZE + item.offsetX * TILE_SIZE;
      const py = item.y * TILE_SIZE + item.offsetY * TILE_SIZE;
      const info = Renderer.LITTER_ICONS[item.type] || Renderer.LITTER_ICONS.wrapper;

      ctx.save();
      ctx.font = `${info.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.85;
      ctx.fillText(info.char, px, py);
      ctx.restore();
    }
  }

  private drawTrashBins(state: GameState): void {
    if (!state.trashBins || state.trashBins.length === 0) return;
    const ctx = this.ctx;
    const s = TILE_SIZE;

    for (const bin of state.trashBins) {
      const px = bin.x * s;
      const py = bin.y * s;

      // Compact bin in top-right corner of tile (out of the path center)
      const bw = 10;
      const bh = 12;
      const bx = px + s - bw - 2;
      const by = py + 2;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(bx + 1, by + 1, bw, bh);

      // Body — slight trapezoid: wider at top
      ctx.fillStyle = '#636e72';
      ctx.beginPath();
      ctx.moveTo(bx + 1, by + 3);
      ctx.lineTo(bx + bw - 1, by + 3);
      ctx.lineTo(bx + bw - 2, by + bh);
      ctx.lineTo(bx + 2, by + bh);
      ctx.closePath();
      ctx.fill();

      // Lid
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(bx - 1, by, bw + 2, 3);

      // Rim highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(bx, by + 3, bw, 1);
    }
  }

  // ── Guest Overlay ────────────────────────────────────────────────

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

    // Position in world space but at bottom-left of viewport
    const bx = cam.x + padding;
    const by = cam.y + this.canvas.height - boxH - padding;

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

  private drawHoverPreview(state: GameState): void {
    if (!state.hoveredTile) return;
    const { x, y } = state.hoveredTile;

    this.ctx.fillStyle = HOVER_COLOR;
    this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

    if (state.buildMode === 'path') {
      const tile = state.grid.tiles[y]?.[x];
      const canPlace = tile && (tile.type === 'sand' || tile.type === 'beach_sand') && state.money >= 1;
      this.ctx.fillStyle = canPlace ? 'rgba(200, 200, 180, 0.6)' : INVALID_PREVIEW;
      this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      this.ctx.strokeStyle = canPlace ? '#bfbfaa' : '#d63031';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x * TILE_SIZE + 1, y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    } else if (state.buildMode === 'bin') {
      const tile = state.grid.tiles[y]?.[x];
      const hasBin = state.trashBins?.some(b => b.x === x && b.y === y);
      const canPlace = tile && (tile.type === 'path' || tile.type === 'beach_sand') && !hasBin && state.money >= 15;
      this.ctx.fillStyle = canPlace ? 'rgba(99, 110, 114, 0.4)' : hasBin ? 'rgba(214, 48, 49, 0.3)' : INVALID_PREVIEW;
      this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      this.ctx.strokeStyle = canPlace ? '#636e72' : '#d63031';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x * TILE_SIZE + 1, y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    } else if (state.buildMode) {
      const bm = state.buildMode as import('../state/types').BuildingType;
      const def = getBuildingDef(bm);
      const size = getBuildingSize(bm);
      const hasMoney = canAffordBuilding(state, bm);
      const valid = hasMoney && isValidPlacement(state.grid, x, y, size.width, size.height, hasMoney, def);

      this.ctx.fillStyle = valid ? VALID_PREVIEW : INVALID_PREVIEW;
      this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, size.width * TILE_SIZE, size.height * TILE_SIZE);
      this.ctx.strokeStyle = valid ? '#00b894' : '#d63031';
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeRect(x * TILE_SIZE + 1, y * TILE_SIZE + 1, size.width * TILE_SIZE - 2, size.height * TILE_SIZE - 2);

      // Show terrain hint
      const terrainLabel = def.terrain === 'beach' ? '🏖️ Beach only' : def.terrain === 'land' ? '🏗️ Land only' : '';
      if (terrainLabel && !valid) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.font = 'bold 10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(terrainLabel, (x + size.width / 2) * TILE_SIZE, y * TILE_SIZE - 4);
      }
    }
  }

  private drawWeatherOverlay(state: GameState): void {
    const overlay = WEATHER_OVERLAYS[state.weather.current];
    if (overlay === 'rgba(0,0,0,0)') return;
    this.ctx.fillStyle = overlay;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (state.weather.current === 'rain' || state.weather.current === 'storm') {
      this.ctx.strokeStyle = 'rgba(100,150,255,0.2)';
      this.ctx.lineWidth = 1;
      const time = performance.now() / 100;
      for (let i = 0; i < (state.weather.current === 'storm' ? 60 : 25); i++) {
        const rx = ((i * 47 + time * 2) % this.canvas.width);
        const ry = ((i * 31 + time * 5) % this.canvas.height);
        this.ctx.beginPath();
        this.ctx.moveTo(rx, ry);
        this.ctx.lineTo(rx - 3, ry + 10);
        this.ctx.stroke();
      }
    }
  }

  private drawDayNightOverlay(state: GameState): void {
    if (state.dayProgress > 0.7) {
      const nightAmount = (state.dayProgress - 0.7) / 0.3;
      this.ctx.fillStyle = `rgba(10, 10, 40, ${nightAmount * 0.15})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

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

  screenToGrid(screenX: number, screenY: number, camera: { x: number; y: number; zoom?: number }): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const zoom = camera.zoom || 1;
    return {
      x: Math.floor(((screenX - rect.left) * scaleX / zoom + camera.x) / TILE_SIZE),
      y: Math.floor(((screenY - rect.top) * scaleY / zoom + camera.y) / TILE_SIZE),
    };
  }

  screenToWorld(screenX: number, screenY: number, camera: { x: number; y: number; zoom?: number }): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const zoom = camera.zoom || 1;
    return {
      x: (screenX - rect.left) * scaleX / zoom + camera.x,
      y: (screenY - rect.top) * scaleY / zoom + camera.y,
    };
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
