import { GameState, Guest, Building, NeedType } from '../state/types';
import { getBuildingDef, GUEST_SEGMENT_DEFS } from '../state/buildingDefs';
import { cartToIso, HALF_W, HALF_H } from './IsoEngine';

const TILE_SIZE = 42;

/** Convert internal cartesian pixel position to isometric world coords. */
function toIso(px: number, py: number): { x: number; y: number } {
  const gx = px / TILE_SIZE;
  const gy = py / TILE_SIZE;
  const iso = cartToIso(gx, gy);
  return { x: iso.x + HALF_W, y: iso.y + HALF_H };
}
const MOVE_SPEED = 0.04;
const TARGET_CHANGE_INTERVAL = 3500;
const WAYPOINT_ARRIVE_DIST = 3;

interface GuestVisual {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  waypoints: Array<{ x: number; y: number }>;
  lastTargetChange: number;
  bobPhase: number;
  currentTileX: number;
  currentTileY: number;
}

function stableRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** BFS from start tile to goal tile on walkable tiles. Returns array of tile coords (path). */
function bfsPath(
  grid: GameState['grid'],
  sx: number, sy: number,
  gx: number, gy: number
): Array<{ x: number; y: number }> | null {
  if (sx === gx && sy === gy) return [{ x: gx, y: gy }];
  const key = (x: number, y: number) => y * grid.width + x;
  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const queue: number[] = [];
  const startK = key(sx, sy);
  visited.add(startK);
  queue.push(startK);

  while (queue.length > 0) {
    const ck = queue.shift()!;
    const cx = ck % grid.width;
    const cy = (ck - cx) / grid.width;

    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;
      const tile = grid.tiles[ny]?.[nx];
      if (!tile) continue;
      // Walkable: path, beach_sand, occupied (buildings), sand, parking
      if (tile.type === 'path' || tile.type === 'beach_sand' || tile.type === 'occupied' || tile.type === 'sand' || tile.type === 'parking') {
        visited.add(nk);
        parent.set(nk, ck);
        if (nx === gx && ny === gy) {
          // Reconstruct path
          const result: Array<{ x: number; y: number }> = [];
          let traceK = nk;
          while (traceK !== startK) {
            const tx = traceK % grid.width;
            const ty = (traceK - tx) / grid.width;
            result.unshift({ x: tx, y: ty });
            traceK = parent.get(traceK)!;
          }
          return result;
        }
        queue.push(nk);
      }
    }
  }
  return null; // no path found
}

export class GuestVisualSystem {
  private visuals: Map<number, GuestVisual> = new Map();

  update(state: GameState, ctx: CanvasRenderingContext2D, now: number): void {
    const aliveIds = new Set(state.guests.map(g => g.id));

    for (const id of this.visuals.keys()) {
      if (!aliveIds.has(id)) this.visuals.delete(id);
    }

    for (const guest of state.guests) {
      let vis = this.visuals.get(guest.id);
      if (!vis) {
        const spawn = this.getSpawnPosition(guest, state);
        const tx = Math.floor(spawn.x / TILE_SIZE);
        const ty = Math.floor(spawn.y / TILE_SIZE);
        vis = {
          id: guest.id,
          x: spawn.x,
          y: spawn.y,
          targetX: spawn.x,
          targetY: spawn.y,
          waypoints: [],
          lastTargetChange: now - TARGET_CHANGE_INTERVAL,
          bobPhase: stableRandom(guest.id) * Math.PI * 2,
          currentTileX: tx,
          currentTileY: ty,
        };
        this.visuals.set(guest.id, vis);
      }

      // Pick new target when interval elapsed or guest started visiting
      const needsNewTarget = now - vis.lastTargetChange > TARGET_CHANGE_INTERVAL
        || (guest.currentVisiting !== null && vis.lastTargetChange < now - 500);
      if (needsNewTarget) {
        this.assignNewTarget(vis, guest, state, now);
        vis.lastTargetChange = now;
      }

      // Follow waypoints tile-by-tile
      this.moveAlongWaypoints(vis, state);

      vis.bobPhase += 0.06 * (1 + state.gameSpeed);

      // Update current tile tracking
      vis.currentTileX = Math.floor(vis.x / TILE_SIZE);
      vis.currentTileY = Math.floor(vis.y / TILE_SIZE);

      this.drawGuest(ctx, vis, guest);

      // Highlight selected guest
      if (state.selectedGuest === guest.id) {
        this.drawSelectedHighlight(ctx, vis, now);
      }
    }
  }

  // ── Movement ────────────────────────────────────────────────────

  private assignNewTarget(vis: GuestVisual, guest: Guest, state: GameState, now: number): void {
    const targetTile = this.pickTargetTile(guest, state, now);
    if (!targetTile) return;

    // Convert target to pixel coords (tile center)
    vis.targetX = (targetTile.x + 0.5) * TILE_SIZE;
    vis.targetY = (targetTile.y + 0.5) * TILE_SIZE;

    // Compute BFS path from current tile to target tile
    const path = bfsPath(state.grid, vis.currentTileX, vis.currentTileY, targetTile.x, targetTile.y);
    if (path && path.length > 0) {
      // Convert tile coords to pixel centers with small random offset for natural look
      vis.waypoints = path.map((t, i) => ({
        x: (t.x + 0.5) * TILE_SIZE + (stableRandom(guest.id * 3 + i * 7) - 0.5) * 8,
        y: (t.y + 0.5) * TILE_SIZE + (stableRandom(guest.id * 5 + i * 11) - 0.5) * 8,
      }));
    } else {
      // No BFS path: move directly (fallback for when tiles aren't connected)
      vis.waypoints = [{
        x: vis.targetX + (stableRandom(guest.id * 3) - 0.5) * 8,
        y: vis.targetY + (stableRandom(guest.id * 5) - 0.5) * 8,
      }];
    }
  }

  private moveAlongWaypoints(vis: GuestVisual, state: GameState): void {
    if (vis.waypoints.length === 0) return;

    const target = vis.waypoints[0];
    const dx = target.x - vis.x;
    const dy = target.y - vis.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < WAYPOINT_ARRIVE_DIST) {
      // Arrived at waypoint, advance to next
      vis.x = target.x;
      vis.y = target.y;
      vis.waypoints.shift();
      return;
    }

    // Move toward current waypoint
    const speed = MOVE_SPEED * TILE_SIZE * (1 + state.gameSpeed * 0.5);
    const step = Math.min(speed, dist);
    vis.x += (dx / dist) * step;
    vis.y += (dy / dist) * step;
  }

  // ── Target Picking ──────────────────────────────────────────────

  private pickTargetTile(guest: Guest, state: GameState, now: number): { x: number; y: number } | null {
    // Beach visit: go to assigned beach tile
    if (guest.currentVisiting === -1 && guest.beachTile) {
      return { x: guest.beachTile.x, y: guest.beachTile.y };
    }

    // Visiting a building: go to building tile
    if (guest.currentVisiting !== null && guest.currentVisiting > 0) {
      const visiting = state.buildings.find(b => b.id === guest.currentVisiting);
      if (visiting) {
        return this.buildingTile(visiting, guest.id);
      }
    }

    // When idle, prefer paths
    const vis = this.visuals.get(guest.id);
    if (vis) {
      const pathTile = this.findNearbyPathTile(vis, guest, state, now);
      if (pathTile) return pathTile;
    }

    // Look for building by highest need
    const needKeys: NeedType[] = ['hunger', 'thirst', 'fun', 'relaxation', 'toilet', 'beach'];
    let bestNeed: NeedType | null = null;
    let bestVal = 0;
    for (const n of needKeys) {
      if (guest.needs[n] > bestVal) {
        bestVal = guest.needs[n];
        bestNeed = n;
      }
    }

    // Beach need: go toward beach area
    if (bestNeed === 'beach' && bestVal > 40) {
      const waterStartY = state.grid.height - 3;
      const beachY = waterStartY - 1;
      const bx = Math.floor(stableRandom(guest.id * 7 + now * 0.0001) * state.grid.width);
      return { x: Math.max(0, Math.min(state.grid.width - 1, bx)), y: Math.max(0, beachY) };
    }

    if (bestNeed && bestVal > 40) {
      const candidates = state.buildings.filter(b => {
        if (b.isConstructing || !b.powered || b.damaged) return false;
        const def = getBuildingDef(b.type);
        return def.satisfiesNeed === bestNeed && def.capacity > 0;
      });
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(stableRandom(guest.id + now * 0.001) * candidates.length)];
        return this.buildingTile(pick, guest.id);
      }
    }

    // Go home
    if (guest.assignedAccommodation !== null) {
      const home = state.buildings.find(b => b.id === guest.assignedAccommodation);
      if (home) return this.buildingTile(home, guest.id);
    }

    // Entrance area fallback
    if (state.entrance) {
      return { x: state.entrance.x, y: state.entrance.y };
    }

    return null;
  }

  private findNearbyPathTile(vis: GuestVisual, guest: Guest, state: GameState, now: number): { x: number; y: number } | null {
    const cx = vis.currentTileX;
    const cy = vis.currentTileY;
    const range = 6;
    const pathOptions: Array<{ x: number; y: number }> = [];

    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx >= 0 && ty >= 0 && tx < state.grid.width && ty < state.grid.height) {
          const tile = state.grid.tiles[ty]?.[tx];
          if (tile && (tile.type === 'path' || tile.type === 'beach_sand')) {
            pathOptions.push({ x: tx, y: ty });
          }
        }
      }
    }

    if (pathOptions.length > 0) {
      const idx = Math.floor(stableRandom(guest.id * 11 + now * 0.0002) * pathOptions.length);
      return pathOptions[idx];
    }
    return null;
  }

  // ── Position Helpers ────────────────────────────────────────────

  private getSpawnPosition(guest: Guest, state: GameState): { x: number; y: number } {
    if (state.entrance) {
      return {
        x: (state.entrance.x + 0.5) * TILE_SIZE + (stableRandom(guest.id * 7) - 0.5) * 10,
        y: (state.entrance.y + 0.5) * TILE_SIZE + (stableRandom(guest.id * 13) - 0.5) * 10,
      };
    }
    const gridW = state.grid.width * TILE_SIZE;
    return {
      x: stableRandom(guest.id * 7) * gridW,
      y: (state.grid.height - 1) * TILE_SIZE + stableRandom(guest.id * 13) * TILE_SIZE,
    };
  }

  private buildingTile(b: Building, guestId: number): { x: number; y: number } {
    // Pick an adjacent walkable tile or the building's own tile
    const bx = b.x + Math.floor(stableRandom(guestId * 3) * b.width);
    const by = b.y + Math.floor(stableRandom(guestId * 5) * b.height);
    return { x: bx, y: by };
  }

  // ── Hit Testing ────────────────────────────────────────────────────

  getGuestAtPosition(worldX: number, worldY: number, guests: Guest[]): number | null {
    const HIT_RADIUS = 20;
    let bestId: number | null = null;
    let bestDist = HIT_RADIUS;
    for (const guest of guests) {
      const vis = this.visuals.get(guest.id);
      if (!vis) continue;
      const iso = toIso(vis.x, vis.y);
      const dx = worldX - iso.x;
      const dy = worldY - iso.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = guest.id;
      }
    }
    return bestId;
  }

  getVisual(guestId: number): { x: number; y: number } | null {
    const vis = this.visuals.get(guestId);
    if (!vis) return null;
    const iso = toIso(vis.x, vis.y);
    return { x: iso.x, y: iso.y };
  }

  // ── Drawing ──────────────────────────────────────────────────────

  private drawSelectedHighlight(ctx: CanvasRenderingContext2D, vis: GuestVisual, now: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
    const radius = 12 + pulse * 3;

    // Pulsing ring
    ctx.save();
    const iso = toIso(vis.x, vis.y);
    ctx.strokeStyle = `rgba(85, 239, 196, ${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(iso.x, iso.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Arrow above head
    const arrowY = iso.y - 18 - pulse * 3;
    ctx.fillStyle = `rgba(85, 239, 196, ${0.7 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(iso.x, arrowY + 5);
    ctx.lineTo(iso.x - 4, arrowY);
    ctx.lineTo(iso.x + 4, arrowY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawGuest(ctx: CanvasRenderingContext2D, vis: GuestVisual, guest: Guest): void {
    const bob = Math.sin(vis.bobPhase) * 1.5;
    const iso = toIso(vis.x, vis.y);
    const x = iso.x;
    const y = iso.y + bob;

    const segDef = GUEST_SEGMENT_DEFS[guest.segment];
    const bodyColor = segDef.color;
    const skinColor = '#ffeaa7';

    // Beach mode: draw lying down with towel
    if (guest.currentVisiting === -1 && guest.beachTile) {
      this.drawBeachGuest(ctx, x, y, guest, bodyColor, skinColor);
      return;
    }

    // Locals are slightly transparent
    if (guest.segment === 'local') {
      ctx.globalAlpha = 0.65;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (torso)
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    this.roundedRect(ctx, x - 3.5, y - 2, 7, 9, 2);
    ctx.fill();

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(x, y - 5, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = this.hairColor(guest.id);
    ctx.beginPath();
    ctx.arc(x, y - 7, 3, -Math.PI, 0);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(x - 1.5, y - 5.5, 1, 1);
    ctx.fillRect(x + 0.5, y - 5.5, 1, 1);

    // Mouth by mood
    if (guest.happiness >= 65) {
      ctx.beginPath();
      ctx.arc(x, y - 3.5, 1.5, 0.1, Math.PI - 0.1);
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    } else if (guest.happiness >= 35) {
      ctx.fillRect(x - 1, y - 3.5, 2, 0.6);
    } else {
      ctx.beginPath();
      ctx.arc(x, y - 2.5, 1.5, Math.PI + 0.1, -0.1);
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // VIP: golden ring around head
    if (guest.segment === 'vip') {
      ctx.strokeStyle = '#fdcb6e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y - 5, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fdcb6e';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('♛', x, y - 10);
    }

    // Family: small child figure next to parent
    if (guest.segment === 'family') {
      const childX = x + 6;
      const childY = y + 2;
      ctx.fillStyle = '#81ecec';
      ctx.beginPath();
      this.roundedRect(ctx, childX - 2, childY, 4, 5, 1.5);
      ctx.fill();
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(childX, childY - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mood bubble for very happy/unhappy
    if (guest.happiness >= 85) {
      this.drawBubble(ctx, x, y - 13, '♥', '#ff6b81');
    } else if (guest.happiness <= 20) {
      this.drawBubble(ctx, x, y - 13, '!', '#ff4757');
    } else if (guest.happiness <= 35) {
      this.drawBubble(ctx, x, y - 13, '?', '#ffa502');
    }

    // Reset alpha
    if (guest.segment === 'local') {
      ctx.globalAlpha = 1.0;
    }
  }

  private drawBeachGuest(ctx: CanvasRenderingContext2D, x: number, y: number, guest: Guest, bodyColor: string, skinColor: string): void {
    const towelColors = ['#ff6b6b', '#74b9ff', '#55efc4', '#fd79a8', '#ffeaa7'];
    ctx.fillStyle = towelColors[guest.id % towelColors.length];
    ctx.fillRect(x - 10, y - 2, 20, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - 10, y - 2, 20, 10);

    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - 6, y, 12, 4);

    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(x - 8, y + 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2d3436';
    ctx.fillRect(x - 10, y + 1, 3, 1.5);

    if (guest.happiness >= 60) {
      ctx.fillStyle = '#fdcb6e';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('☀', x + 2, y - 5);
    }
  }

  private drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): void {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    this.roundedRect(ctx, x - 5, y - 5, 10, 10, 3);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  private hairColor(id: number): string {
    const colors = ['#2d3436', '#636e72', '#a0522d', '#daa520', '#c0392b', '#e84393'];
    return colors[id % colors.length];
  }

  private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
