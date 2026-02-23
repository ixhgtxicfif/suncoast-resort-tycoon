import { GameState, Tile, LandParcel, TileType } from './types';
import { createInitialMissions } from './missions';

export const GRID_WIDTH = 50;
export const GRID_HEIGHT = 26;
export const WATER_ROWS = 3;       // bottom 3 rows are sea
export const BEACH_ROWS = 3;       // 3 rows above water are beach
export const LAND_PARCEL_SIZE = 4;  // land sold in 4x4 blocks

// Starting owned area (near the beach, center-left -- bigger for larger buildings)
export const INITIAL_OWNED: LandParcel = { x: 4, y: 8, w: 14, h: 15 };

function isInOwnedParcel(x: number, y: number, parcels: LandParcel[]): boolean {
  return parcels.some(p => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
}

// Access road: 2-tile-wide strip from top of map down to parking
const ACCESS_ROAD = { x: 0, w: 2, yEnd: 13 };
// Parking lot: wider area where road meets the entrance
const PARKING_AREA = { x: 0, y: 13, w: 4, h: 5 };

function isAccessRoad(x: number, y: number): boolean {
  return x >= ACCESS_ROAD.x && x < ACCESS_ROAD.x + ACCESS_ROAD.w
      && y >= 0 && y < ACCESS_ROAD.yEnd;
}

function isParkingArea(x: number, y: number): boolean {
  return x >= PARKING_AREA.x && x < PARKING_AREA.x + PARKING_AREA.w
      && y >= PARKING_AREA.y && y < PARKING_AREA.y + PARKING_AREA.h;
}

function createInitialGrid(width: number, height: number, owned: LandParcel[]): Tile[][] {
  const waterStartY = height - WATER_ROWS;
  const beachStartY = waterStartY - BEACH_ROWS;
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      let type: TileType;
      if (y >= waterStartY) {
        type = 'water';
      } else if (isParkingArea(x, y) || isAccessRoad(x, y)) {
        type = 'parking';
      } else if (y >= beachStartY && isInOwnedParcel(x, y, owned)) {
        type = 'beach_sand';
      } else if (isInOwnedParcel(x, y, owned)) {
        type = 'sand';
      } else {
        type = 'unowned';
      }
      tiles[y][x] = { x, y, type };
    }
  }
  return tiles;
}

export function createFreshState(): GameState {
  const ownedLand: LandParcel[] = [INITIAL_OWNED];
  return {
    day: 1,
    dayProgress: 0,
    money: 3000,
    grid: {
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      tiles: createInitialGrid(GRID_WIDTH, GRID_HEIGHT, ownedLand),
    },
    buildings: [],
    nextBuildingId: 1,
    guests: [],
    nextGuestId: 1,
    weather: { current: 'sunny', daysUntilChange: 3 },
    reputation: 15,
    reputationBreakdown: { beauty: 20, safety: 30, fun: 15, value: 40, nightlife: 10, cleanliness: 30, foodQuality: 15 },
    gameSpeed: 1,
    buildMode: null,
    hoveredTile: null,
    selectedBuilding: null,
    selectedGuest: null,
    selectedStaff: null,
    finances: {
      grossIncome: 0,
      roomRevenue: 0,
      resortFeeRevenue: 0,
      ancillaryRevenue: 0,
      dayPassRevenue: 0,
      maintenanceCost: 0,
      staffCost: 0,
      loanInterest: 0,
      netIncome: 0,
      revenueByRole: { rooms: 0, ancillary: 0, amenities: 0 },
    },
    pendingAncillary: 0,
    totalGuestsServed: 0,
    totalMoneyEarned: 0,
    dayPassPrice: 5,
    dayPassEnabled: false,
    loans: [],
    nextLoanId: 1,
    missions: createInitialMissions(),
    events: [],
    eventLog: [],
    nextEventDay: 4 + Math.floor(Math.random() * 3),
    impactLog: [],
    previousDayLog: [],
    reviews: [],
    nextReviewId: 1,
    socialHeat: 0,
    staff: {
      cleaners: 0, animators: 0, builders: 0, mechanics: 0, lifeguards: 0, security: 0,
      cleanerCostPerDay: 80, animatorCostPerDay: 120, builderCostPerDay: 100,
      mechanicCostPerDay: 100, lifeguardCostPerDay: 120, securityCostPerDay: 150,
    },
    litter: { items: [], nextId: 1 },
    trashBins: [],
    stories: { activeStory: null, cooldownDays: 7, history: [], pendingDelayed: [], pendingOutcomes: [] },
    unlockedStories: [],
    contracts: [],
    ownedLand,
    camera: { x: -250, y: 150, zoom: 0.7 },  // Isometric view: centered on playable area
    marketing: [],
    entrance: { x: 4, y: 15 },  // Left edge of initial owned land, near beach
    dailyBreakdown: null,
    version: 22,
    tutorialSeen: {},
  };
}

export const initialState: GameState = createFreshState();
