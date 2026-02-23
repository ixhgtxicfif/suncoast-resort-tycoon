import { Grid as GridType, BuildingDef } from '../state/types';
import { Grid } from './Grid';

export function canPlaceBuilding(
  grid: GridType,
  x: number,
  y: number,
  width: number,
  height: number,
  def?: BuildingDef
): boolean {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tileX = x + dx;
      const tileY = y + dy;

      if (!Grid.isInBounds(grid, tileX, tileY)) {
        return false;
      }

      if (!Grid.isTileBuildable(grid, tileX, tileY, def)) {
        return false;
      }
    }
  }

  return true;
}

export function isValidPlacement(
  grid: GridType,
  x: number,
  y: number,
  width: number,
  height: number,
  hasMoney: boolean,
  def?: BuildingDef
): boolean {
  return hasMoney && canPlaceBuilding(grid, x, y, width, height, def);
}



