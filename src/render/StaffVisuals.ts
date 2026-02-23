import { GameState, StaffRole } from '../state/types';
import { cartToIso, HALF_W, HALF_H } from './IsoEngine';

const TILE_SIZE = 42;

function toIso(px: number, py: number): { x: number; y: number } {
  const gx = px / TILE_SIZE;
  const gy = py / TILE_SIZE;
  const iso = cartToIso(gx, gy);
  return { x: iso.x + HALF_W, y: iso.y + HALF_H };
}
const MOVE_SPEED = 0.025;
const TARGET_CHANGE_INTERVAL = 4000;
const WAYPOINT_ARRIVE_DIST = 4;
const CLEAN_DURATION_MS = 1200;

export interface StaffVisual {
  id: number;
  role: StaffRole;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  waypoints: Array<{ x: number; y: number }>;
  lastTargetChange: number;
  bobPhase: number;
  currentTileX: number;
  currentTileY: number;
  cleanedToday: number;
  targetLitterPos: { x: number; y: number } | null;
  cleaningUntil: number;
  recentlyCleaned: Set<string>;
}

function stableRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

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
      if (tile.type !== 'water') {
        visited.add(nk);
        parent.set(nk, ck);
        if (nx === gx && ny === gy) {
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
  return null;
}

const ROLE_COLORS: Record<StaffRole, string> = {
  cleaners: '#27ae60',
  animators: '#e67e22',
  builders: '#f39c12',
  mechanics: '#2980b9',
  lifeguards: '#e74c3c',
  security: '#34495e',
};

const ROLE_ICONS: Record<StaffRole, string> = {
  cleaners: '🧹',
  animators: '🎭',
  builders: '🔨',
  mechanics: '🔧',
  lifeguards: '🏊',
  security: '🛡',
};

export class StaffVisualSystem {
  private visuals: Map<number, StaffVisual> = new Map();
  private nextStaffVisualId = 1;
  private lastDay = -1;
  private prevLitterCount = 0;

  update(state: GameState, ctx: CanvasRenderingContext2D, now: number): void {
    // Reset daily stats on new day
    if (state.day !== this.lastDay) {
      for (const v of this.visuals.values()) {
        v.cleanedToday = 0;
        v.recentlyCleaned.clear();
      }
      this.lastDay = state.day;
    }

    // Track actual litter cleaned by reducer and distribute to cleaners
    const currentLitterCount = state.litter.items.length;
    if (currentLitterCount < this.prevLitterCount) {
      const removed = this.prevLitterCount - currentLitterCount;
      const cleaners = [...this.visuals.values()].filter(v => v.role === 'cleaners');
      if (cleaners.length > 0) {
        const perCleaner = Math.ceil(removed / cleaners.length);
        for (const c of cleaners) {
          c.cleanedToday += perCleaner;
        }
      }
      // When reducer actually removes litter, clear recentlyCleaned so cleaners
      // can re-check those positions for new litter that might have spawned there
      const currentLitterKeys = new Set(state.litter.items.map(it => `${it.x},${it.y}`));
      for (const c of cleaners) {
        for (const key of c.recentlyCleaned) {
          if (!currentLitterKeys.has(key)) {
            c.recentlyCleaned.delete(key);
          }
        }
      }
    }
    this.prevLitterCount = currentLitterCount;

    // Sync visual staff count with actual staff counts
    this.syncStaffCounts(state, now);

    // Update and draw each staff member
    for (const vis of this.visuals.values()) {
      // If cleaning animation is active, wait
      if (vis.cleaningUntil > now) {
        vis.bobPhase += 0.03;
        this.drawStaff(ctx, vis, now);
        continue;
      }

      // Movement: move toward waypoints
      if (vis.waypoints.length > 0) {
        const target = vis.waypoints[0];
        const dx = target.x - vis.x;
        const dy = target.y - vis.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < WAYPOINT_ARRIVE_DIST) {
          vis.x = target.x;
          vis.y = target.y;
          vis.waypoints.shift();
        } else {
          const speed = MOVE_SPEED * TILE_SIZE * (1 + state.gameSpeed * 0.3);
          const step = Math.min(speed, dist);
          vis.x += (dx / dist) * step;
          vis.y += (dy / dist) * step;
        }
      }

      vis.bobPhase += 0.025;
      vis.currentTileX = Math.floor(vis.x / TILE_SIZE);
      vis.currentTileY = Math.floor(vis.y / TILE_SIZE);

      // Cleaners: arrived at litter target → short cleaning animation
      if (vis.role === 'cleaners' && vis.targetLitterPos !== null && vis.waypoints.length === 0) {
        const litterKey = `${vis.targetLitterPos.x},${vis.targetLitterPos.y}`;
        console.log(`[Cleaner #${vis.id}] ARRIVED at litter (${vis.targetLitterPos.x},${vis.targetLitterPos.y}), starting clean. Pos=(${vis.currentTileX},${vis.currentTileY})`);
        vis.cleaningUntil = now + CLEAN_DURATION_MS;
        // Remember this position so we don't target it again immediately
        vis.recentlyCleaned.add(litterKey);
        vis.targetLitterPos = null;
        vis.lastTargetChange = now;
        this.drawStaff(ctx, vis, now);
        continue;
      }

      // Need new target?
      if (vis.waypoints.length === 0) {
        const timeSinceLast = now - vis.lastTargetChange;
        if (timeSinceLast > 300) {
          this.assignTarget(vis, state, now);
          vis.lastTargetChange = now;
          if (vis.role === 'cleaners') {
            console.log(`[Cleaner #${vis.id}] NEW TARGET: litter=${vis.targetLitterPos ? `(${vis.targetLitterPos.x},${vis.targetLitterPos.y})` : 'none'}, waypoints=${vis.waypoints.length}, from=(${vis.currentTileX},${vis.currentTileY})`);
          }
        }
      }

      this.drawStaff(ctx, vis, now);
    }
  }

  private syncStaffCounts(state: GameState, now: number): void {
    const roles: StaffRole[] = ['cleaners', 'animators', 'builders', 'mechanics', 'lifeguards', 'security'];
    const currentCounts: Record<StaffRole, number> = { cleaners: 0, animators: 0, builders: 0, mechanics: 0, lifeguards: 0, security: 0 };
    for (const v of this.visuals.values()) {
      currentCounts[v.role]++;
    }

    for (const role of roles) {
      const target = state.staff[role];
      const current = currentCounts[role];

      if (current < target) {
        for (let i = 0; i < target - current; i++) {
          const id = this.nextStaffVisualId++;
          const spawn = this.getSpawnPosition(state, role, id);
          const tx = Math.floor(spawn.x / TILE_SIZE);
          const ty = Math.floor(spawn.y / TILE_SIZE);
          this.visuals.set(id, {
            id, role,
            x: spawn.x, y: spawn.y,
            targetX: spawn.x, targetY: spawn.y,
            waypoints: [],
            lastTargetChange: now - TARGET_CHANGE_INTERVAL,
            bobPhase: stableRandom(id) * Math.PI * 2,
            currentTileX: tx, currentTileY: ty,
            cleanedToday: 0,
            targetLitterPos: null,
            cleaningUntil: 0,
            recentlyCleaned: new Set(),
          });
        }
      } else if (current > target) {
        let toRemove = current - target;
        for (const [id, v] of this.visuals) {
          if (v.role === role && toRemove > 0) {
            this.visuals.delete(id);
            toRemove--;
          }
        }
      }
    }
  }

  private getSpawnPosition(state: GameState, role: StaffRole, id: number): { x: number; y: number } {
    if (role === 'lifeguards') {
      const beachY = (state.grid.height - 4) * TILE_SIZE;
      return { x: (2 + stableRandom(id * 7) * (state.grid.width - 4)) * TILE_SIZE, y: beachY };
    }
    if (state.entrance) {
      return {
        x: (state.entrance.x + 0.5) * TILE_SIZE + (stableRandom(id * 31) - 0.5) * 20,
        y: (state.entrance.y + 0.5) * TILE_SIZE + (stableRandom(id * 37) - 0.5) * 20,
      };
    }
    return { x: stableRandom(id * 7) * state.grid.width * TILE_SIZE, y: 5 * TILE_SIZE };
  }

  private assignTarget(vis: StaffVisual, state: GameState, now: number): void {
    let targetTile: { x: number; y: number } | null = null;

    switch (vis.role) {
      case 'cleaners':
        targetTile = this.findCleanerTarget(vis, state, now);
        break;
      case 'builders':
        targetTile = this.findBuildingTarget(state, vis.id, now, b => b.isConstructing);
        break;
      case 'mechanics':
        targetTile = this.findBuildingTarget(state, vis.id, now, b => b.damaged);
        break;
      case 'lifeguards':
        targetTile = this.findBeachTarget(state, vis.id, now);
        break;
      case 'security':
      case 'animators':
        targetTile = this.findPatrolTarget(state, vis.id, now);
        break;
    }

    if (!targetTile) {
      // Patrol: wander to a random walkable tile across the resort
      // (cleaners patrol widely to look busy, others wander nearby)
      if (vis.role === 'cleaners') {
        targetTile = this.findPatrolTarget(state, vis.id, now);
      }
      if (!targetTile) {
        const range = 4;
        targetTile = {
          x: Math.max(0, Math.min(state.grid.width - 1, vis.currentTileX + Math.floor(stableRandom(vis.id * 11 + now * 0.0003) * range * 2 - range))),
          y: Math.max(0, Math.min(state.grid.height - 1, vis.currentTileY + Math.floor(stableRandom(vis.id * 13 + now * 0.0004) * range * 2 - range))),
        };
      }
    }

    vis.targetX = (targetTile.x + 0.5) * TILE_SIZE;
    vis.targetY = (targetTile.y + 0.5) * TILE_SIZE;

    // Debug: log what tile the staff is on
    const startTile = state.grid.tiles[vis.currentTileY]?.[vis.currentTileX];
    const startType = startTile?.type ?? 'NONE';

    const path = bfsPath(state.grid, vis.currentTileX, vis.currentTileY, targetTile.x, targetTile.y);
    if (path && path.length > 0) {
      vis.waypoints = path.map((t, i) => ({
        x: (t.x + 0.5) * TILE_SIZE + (stableRandom(vis.id * 3 + i * 7) - 0.5) * 6,
        y: (t.y + 0.5) * TILE_SIZE + (stableRandom(vis.id * 5 + i * 11) - 0.5) * 6,
      }));
    } else {
      console.warn(`[Staff #${vis.id} ${vis.role}] BFS FAILED from (${vis.currentTileX},${vis.currentTileY} type=${startType}) to (${targetTile.x},${targetTile.y}). Stepping toward target.`);
      // BFS failed: move one step toward target on any non-water tile
      const dx = targetTile.x > vis.currentTileX ? 1 : targetTile.x < vis.currentTileX ? -1 : 0;
      const dy = targetTile.y > vis.currentTileY ? 1 : targetTile.y < vis.currentTileY ? -1 : 0;
      const candidates = [
        { x: vis.currentTileX + dx, y: vis.currentTileY },
        { x: vis.currentTileX, y: vis.currentTileY + dy },
        { x: vis.currentTileX + dx, y: vis.currentTileY + dy },
      ].filter(c => {
        if (c.x < 0 || c.y < 0 || c.x >= state.grid.width || c.y >= state.grid.height) return false;
        const t = state.grid.tiles[c.y]?.[c.x];
        return t && t.type !== 'water';
      });

      if (candidates.length > 0) {
        const step = candidates[0];
        vis.waypoints = [{ x: (step.x + 0.5) * TILE_SIZE, y: (step.y + 0.5) * TILE_SIZE }];
      } else {
        vis.waypoints = [];
        vis.targetLitterPos = null;
      }
    }
  }

  private findCleanerTarget(vis: StaffVisual, state: GameState, _now: number): { x: number; y: number } | null {
    if (state.litter.items.length === 0) return null;

    // Find positions claimed by other cleaners
    const claimedPositions = new Set<string>();
    for (const other of this.visuals.values()) {
      if (other.role === 'cleaners' && other.id !== vis.id && other.targetLitterPos) {
        claimedPositions.add(`${other.targetLitterPos.x},${other.targetLitterPos.y}`);
      }
    }

    // Find nearest unclaimed litter that we haven't recently "cleaned"
    let bestItem: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const item of state.litter.items) {
      const key = `${item.x},${item.y}`;
      if (claimedPositions.has(key)) continue;
      // Skip positions we already visited and "cleaned" — the reducer
      // will actually remove them; no need to keep returning to the same spot
      if (vis.recentlyCleaned.has(key)) continue;
      const lx = (item.x + 0.5) * TILE_SIZE;
      const ly = (item.y + 0.5) * TILE_SIZE;
      const dist = Math.sqrt((vis.x - lx) ** 2 + (vis.y - ly) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestItem = { x: item.x, y: item.y };
      }
    }

    if (bestItem) {
      vis.targetLitterPos = bestItem;
      return bestItem;
    }

    // All litter has been "recently cleaned" but reducer hasn't removed it yet.
    // If there's a lot of recentlyCleaned, clear half of them so cleaner can re-visit
    // the oldest ones instead of standing idle while litter is still visible.
    if (vis.recentlyCleaned.size > 0 && state.litter.items.length > 0) {
      const keys = [...vis.recentlyCleaned];
      const halfCount = Math.ceil(keys.length / 2);
      for (let i = 0; i < halfCount; i++) {
        vis.recentlyCleaned.delete(keys[i]);
      }
    }

    vis.targetLitterPos = null;
    return null;
  }

  private findBuildingTarget(state: GameState, staffId: number, now: number, filter: (b: any) => boolean): { x: number; y: number } | null {
    const candidates = state.buildings.filter(filter);
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(stableRandom(staffId * 7 + now * 0.0001) * candidates.length)];
    return { x: pick.x, y: pick.y };
  }

  private findBeachTarget(state: GameState, staffId: number, now: number): { x: number; y: number } | null {
    const beachY = state.grid.height - 4;
    const bx = Math.floor(stableRandom(staffId * 17 + now * 0.0002) * state.grid.width);
    return { x: Math.max(0, Math.min(state.grid.width - 1, bx)), y: Math.max(0, beachY) };
  }

  private findPatrolTarget(state: GameState, staffId: number, now: number): { x: number; y: number } | null {
    const walkable: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < state.grid.height; y++) {
      for (let x = 0; x < state.grid.width; x++) {
        const tile = state.grid.tiles[y]?.[x];
        if (tile && (tile.type === 'path' || tile.type === 'sand')) {
          walkable.push({ x, y });
        }
      }
    }
    if (walkable.length === 0) return null;
    return walkable[Math.floor(stableRandom(staffId * 23 + now * 0.0001) * walkable.length)];
  }

  // moveAlongWaypoints is now inlined in the update loop for smoother multi-waypoint processing

  // ── Hit Testing ───────────────────────────────────────────────

  getStaffAtPosition(worldX: number, worldY: number): StaffVisual | null {
    const HIT_RADIUS = 20;
    let best: StaffVisual | null = null;
    let bestDist = HIT_RADIUS;
    for (const vis of this.visuals.values()) {
      const iso = toIso(vis.x, vis.y);
      const dx = worldX - iso.x;
      const dy = worldY - iso.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = vis;
      }
    }
    return best;
  }

  getVisual(staffId: number): StaffVisual | null {
    return this.visuals.get(staffId) ?? null;
  }

  // ── Drawing ───────────────────────────────────────────────────

  private drawStaff(ctx: CanvasRenderingContext2D, vis: StaffVisual, now: number): void {
    const isCleaning = vis.cleaningUntil > now;
    const bob = isCleaning ? Math.sin(now * 0.02) * 3 : Math.sin(vis.bobPhase) * 1.2;
    const iso = toIso(vis.x, vis.y);
    const x = iso.x;
    const y = iso.y + bob;
    const color = ROLE_COLORS[vis.role];

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (uniform — wider, more visible)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 1);
    ctx.lineTo(x + 5, y - 1);
    ctx.lineTo(x + 4, y + 8);
    ctx.lineTo(x - 4, y + 8);
    ctx.closePath();
    ctx.fill();

    // White belt/stripe for visibility
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(x - 4.5, y + 2, 9, 1.5);

    // Head
    ctx.fillStyle = '#ffeaa7';
    ctx.beginPath();
    ctx.arc(x, y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Cap/hat
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y - 6.5, 5, 2.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 5, y - 7.5, 10, 2);

    // Eyes
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(x - 1.5, y - 4.5, 1, 1);
    ctx.fillRect(x + 0.5, y - 4.5, 1, 1);

    // Role icon above head
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(ROLE_ICONS[vis.role], x, y - 11);

    // Cleaning animation: sparkles and broom motion
    if (isCleaning && vis.role === 'cleaners') {
      const phase = (now % CLEAN_DURATION_MS) / CLEAN_DURATION_MS;
      ctx.save();
      ctx.font = '8px sans-serif';
      ctx.globalAlpha = 0.8;
      ctx.fillText('✨', x + 7 * Math.cos(phase * Math.PI * 2), y - 2 + 4 * Math.sin(phase * Math.PI * 2));
      ctx.fillText('✨', x - 5 * Math.cos(phase * Math.PI * 2 + 1), y + 2 * Math.sin(phase * Math.PI * 2 + 1));
      ctx.restore();
    }

    // Cleaners heading to litter: show target indicator
    if (vis.role === 'cleaners' && vis.targetLitterPos !== null && !isCleaning) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
      ctx.save();
      ctx.globalAlpha = 0.3 + pulse * 0.2;
      ctx.strokeStyle = '#27ae60';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      const tIso = toIso((vis.targetLitterPos.x + 0.5) * TILE_SIZE, (vis.targetLitterPos.y + 0.5) * TILE_SIZE);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tIso.x, tIso.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  drawSelectedHighlight(ctx: CanvasRenderingContext2D, vis: StaffVisual, now: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
    const radius = 14 + pulse * 3;
    const color = ROLE_COLORS[vis.role];
    const iso = toIso(vis.x, vis.y);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.5 + pulse * 0.4;
    ctx.beginPath();
    ctx.arc(iso.x, iso.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    const arrowY = iso.y - 20 - pulse * 3;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7 + pulse * 0.3;
    ctx.beginPath();
    ctx.moveTo(iso.x, arrowY + 5);
    ctx.lineTo(iso.x - 5, arrowY);
    ctx.lineTo(iso.x + 5, arrowY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
