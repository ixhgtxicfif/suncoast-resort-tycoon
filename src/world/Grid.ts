import { Grid as GridType, Tile, BuildingDef } from '../state/types';

export class Grid {
  static getTile(grid: GridType, x: number, y: number): Tile | null {
    if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) {
      return null;
    }
    return grid.tiles[y][x];
  }

  static isInBounds(grid: GridType, x: number, y: number): boolean {
    return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
  }

  /** Check if a tile is buildable for a given building (terrain check) */
  static isTileBuildable(grid: GridType, x: number, y: number, def?: BuildingDef): boolean {
    const tile = this.getTile(grid, x, y);
    if (!tile) return false;

    const terrain = def?.terrain ?? 'any';

    if (tile.type === 'sand') {
      return terrain === 'land' || terrain === 'any';
    }
    if (tile.type === 'beach_sand') {
      return terrain === 'beach' || terrain === 'any';
    }
    return false; // water, unowned, occupied, path are not buildable
  }

  /** Legacy: check if tile is not buildable (used for generic placement) */
  static isTileOccupied(grid: GridType, x: number, y: number): boolean {
    const tile = this.getTile(grid, x, y);
    if (!tile) return true;
    return tile.type !== 'sand' && tile.type !== 'beach_sand';
  }

  /** Check if a tile is walkable by guests (paths + beach_sand near water) */
  static isWalkable(grid: GridType, x: number, y: number): boolean {
    const tile = this.getTile(grid, x, y);
    if (!tile) return false;
    return tile.type === 'path' || tile.type === 'beach_sand';
  }

  /** Is this tile in the beach zone? */
  static isBeachZone(grid: GridType, x: number, y: number): boolean {
    const tile = this.getTile(grid, x, y);
    if (!tile) return false;
    return tile.type === 'beach_sand';
  }

  /** BFS from entrance. Returns Map of "x,y" -> distance (tile count from entrance) */
  static computePathReachable(grid: GridType, entrance: { x: number; y: number }): Map<string, number> {
    const reachable = new Map<string, number>();
    const queue: Array<{ x: number; y: number; dist: number }> = [{ ...entrance, dist: 0 }];
    const key = (x: number, y: number) => `${x},${y}`;
    reachable.set(key(entrance.x, entrance.y), 0);

    while (queue.length > 0) {
      const { x, y, dist } = queue.shift()!;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        const nk = key(nx, ny);
        if (reachable.has(nk)) continue;
        const tile = this.getTile(grid, nx, ny);
        if (!tile) continue;
        if (tile.type === 'path' || tile.type === 'beach_sand' || tile.type === 'occupied') {
          reachable.set(nk, dist + 1);
          queue.push({ x: nx, y: ny, dist: dist + 1 });
        }
      }
    }
    return reachable;
  }

  /** Check if a building is reachable from the entrance via paths */
  static isBuildingReachable(
    _grid: GridType,
    building: { x: number; y: number; width: number; height: number },
    reachable: Map<string, number>
  ): boolean {
    for (let by = building.y; by < building.y + building.height; by++) {
      for (let bx = building.x; bx < building.x + building.width; bx++) {
        if (reachable.has(`${bx},${by}`)) return true;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          if (reachable.has(`${bx + dx},${by + dy}`)) return true;
        }
      }
    }
    return false;
  }

  /** Get the minimum path distance from entrance to a building */
  static getBuildingDistance(
    building: { x: number; y: number; width: number; height: number },
    reachable: Map<string, number>
  ): number {
    let minDist = Infinity;
    for (let by = building.y; by < building.y + building.height; by++) {
      for (let bx = building.x; bx < building.x + building.width; bx++) {
        const d = reachable.get(`${bx},${by}`);
        if (d !== undefined && d < minDist) minDist = d;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const ad = reachable.get(`${bx + dx},${by + dy}`);
          if (ad !== undefined && ad < minDist) minDist = ad;
        }
      }
    }
    return minDist;
  }
}



