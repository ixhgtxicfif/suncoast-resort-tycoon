import { Store } from '../core/Store';
import { GameState, TileType, LandParcel } from '../state/types';
import { loadState } from '../state/actions';
import { createDefaultOfferings, GUEST_SEGMENT_DEFS } from '../state/buildingDefs';
import { GRID_WIDTH, GRID_HEIGHT, WATER_ROWS, BEACH_ROWS, INITIAL_OWNED } from '../state/initialState';
import { createInitialMissions } from '../state/missions';

const SAVE_KEY = 'suncoast_save_v22';
const AUTO_SAVE_INTERVAL = 3000;
const CURRENT_VERSION = 22;

export class SaveSystem {
  private autoSaveTimer: number | null = null;

  constructor(private store: Store) {}

  startAutoSave(): void {
    this.autoSaveTimer = window.setInterval(() => this.save(), AUTO_SAVE_INTERVAL);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  save(): void {
    try {
      const state = this.store.getState();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Save failed:', e);
    }
  }

  load(): boolean {
    try {
      let raw = localStorage.getItem(SAVE_KEY);
      // Migrate from old "beachlife" save keys
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v21');
      }
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v20');
      }
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v19');
      }
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v18');
      }
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v17');
      }
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v16');
      }
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v15');
      }
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v14');
      }
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v13');
      }
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v12');
      }
      if (!raw) {
        raw = localStorage.getItem('beachlife_save_v11');
      }
      if (!raw) {
        for (let i = 0; i <= 21; i++) {
          localStorage.removeItem(i === 0 ? 'beachlife_save' : `beachlife_save_v${i}`);
        }
        return false;
      }
      const saved: GameState = JSON.parse(raw);

      if (!saved.version || saved.version < CURRENT_VERSION) {
        console.log('Old save format detected, migrating...');
        this.migrateState(saved);
      }

      // Patch in any fields that may be missing
      if (!saved.tutorialSeen) saved.tutorialSeen = {};
      if (saved.pendingAncillary === undefined) saved.pendingAncillary = 0;
      if (!saved.impactLog) saved.impactLog = [];
      if (!saved.previousDayLog) saved.previousDayLog = [];
      if (!saved.reviews) saved.reviews = [];
      if (saved.nextReviewId === undefined) saved.nextReviewId = 1;
      if (saved.socialHeat === undefined) saved.socialHeat = 0;
      if (!saved.staff) saved.staff = {
        cleaners: 0, animators: 0, builders: 0, mechanics: 0, lifeguards: 0, security: 0,
        cleanerCostPerDay: 8, animatorCostPerDay: 12, builderCostPerDay: 10,
        mechanicCostPerDay: 10, lifeguardCostPerDay: 12, securityCostPerDay: 15,
      };
      // v13: migrate old staff to new format (add missing fields)
      if (saved.staff.builders === undefined) saved.staff.builders = 0;
      if (saved.staff.mechanics === undefined) saved.staff.mechanics = 0;
      if (saved.staff.lifeguards === undefined) saved.staff.lifeguards = 0;
      if (saved.staff.security === undefined) saved.staff.security = 0;
      if (saved.staff.builderCostPerDay === undefined) saved.staff.builderCostPerDay = 4;
      if (saved.staff.mechanicCostPerDay === undefined) saved.staff.mechanicCostPerDay = 4;
      if (saved.staff.lifeguardCostPerDay === undefined) saved.staff.lifeguardCostPerDay = 5;
      if (saved.staff.securityCostPerDay === undefined) saved.staff.securityCostPerDay = 6;
      if (!saved.stories) saved.stories = { activeStory: null, cooldownDays: 7, history: [], pendingDelayed: [], pendingOutcomes: [] };
      if (!saved.contracts) saved.contracts = [];
      if (!saved.finances.resortFeeRevenue) (saved.finances as any).resortFeeRevenue = 0;
      if (saved.finances.staffCost === undefined) (saved.finances as any).staffCost = 0;

      // v9: Ensure ownedLand and camera exist
      if (!saved.ownedLand) saved.ownedLand = [INITIAL_OWNED];
      if (!saved.camera) saved.camera = { x: 0, y: 126, zoom: 1.0 };
      if (saved.camera && saved.camera.zoom === undefined) saved.camera.zoom = 1.0;
      if (!saved.marketing) saved.marketing = [];
      if (!saved.entrance) saved.entrance = { x: 2, y: 12 };
      if (saved.dailyBreakdown === undefined) (saved as any).dailyBreakdown = null;

      // v12: Add reputation breakdown
      if (!saved.reputationBreakdown) {
        saved.reputationBreakdown = { beauty: 20, safety: 30, fun: 15, value: 40, nightlife: 10, cleanliness: 30, foodQuality: 15 };
      }

      // v13: Add litter state and trash bins
      if (!saved.litter) {
        saved.litter = { items: [], nextId: 1 };
      }
      if (!saved.trashBins) {
        // Migrate any old trash_bin buildings to the new trashBins array
        const oldBins = saved.buildings.filter((b: any) => b.type === 'trash_bin');
        saved.trashBins = oldBins.map((b: any) => ({ x: b.x, y: b.y }));
        // Remove old trash_bin buildings
        saved.buildings = saved.buildings.filter((b: any) => b.type !== 'trash_bin');
        // Restore tiles that were occupied by trash bins
        for (const bin of oldBins) {
          const tile = saved.grid.tiles[bin.y]?.[bin.x];
          if (tile && tile.type === 'occupied') {
            const bStartY = GRID_HEIGHT - WATER_ROWS - BEACH_ROWS;
            tile.type = bin.y >= bStartY ? 'beach_sand' : 'sand';
            delete tile.buildingId;
          }
        }
      }

      // Migrate guests: add beach and stroll needs
      for (const g of saved.guests) {
        if ((g.needs as any).beach === undefined) {
          (g.needs as any).beach = 20 + Math.floor(Math.random() * 30);
        }
        if ((g.needs as any).stroll === undefined) {
          (g.needs as any).stroll = 10 + Math.floor(Math.random() * 20);
        }
      }

      // Migrate grid if old format (smaller grid)
      if (saved.grid.width < GRID_WIDTH || saved.grid.height < GRID_HEIGHT) {
        saved.grid = this.migrateGrid(saved.grid, saved.ownedLand, saved.buildings);
      }

      // v11: Migrate sand tiles in beach zone to beach_sand
      const migrateWaterStartY = GRID_HEIGHT - WATER_ROWS;
      const migrateBeachStartY = migrateWaterStartY - BEACH_ROWS;
      for (let y = migrateBeachStartY; y < migrateWaterStartY; y++) {
        for (let x = 0; x < saved.grid.width; x++) {
          const tile = saved.grid.tiles[y]?.[x];
          if (tile && tile.type === 'sand') {
            tile.type = 'beach_sand';
          }
        }
      }

      // v11: Add beachTile to guests
      for (const g of saved.guests) {
        if ((g as any).beachTile === undefined) {
          (g as any).beachTile = null;
        }
      }

      // Migrate buildings
      for (const b of saved.buildings) {
        if (!b.offerings) {
          b.offerings = createDefaultOfferings(b.type).filter((o: any) => o.unlockLevel <= b.level);
          for (const o of b.offerings) {
            if (o.unlockLevel === 1) o.enabled = true;
          }
        }
        for (const p of b.packages) {
          if (p.unlockLevel === undefined) p.unlockLevel = 1;
        }
      }

      // Migrate guests
      for (const g of saved.guests) {
        if (!g.visitCounts) g.visitCounts = {};
        if (g.dailySpendRemaining === undefined) {
          g.dailySpendRemaining = GUEST_SEGMENT_DEFS[g.segment].spendPerDay;
        }
        if (!g.thoughts) g.thoughts = [];
        // v14: Economic model fields
        if (g.originalStayDuration === undefined) g.originalStayDuration = g.stayDuration;
        if (g.stayBonusApplied === undefined) g.stayBonusApplied = 0;
        if (g.packageUpgraded === undefined) g.packageUpgraded = false;
        if (g.effectivePriceSensitivity === undefined) {
          g.effectivePriceSensitivity = GUEST_SEGMENT_DEFS[g.segment]?.priceSensitivity ?? 1.0;
        }
        if (g.todayStayBonusAccum === undefined) g.todayStayBonusAccum = 0;
        if (g.todayPackageUpgradeAccum === undefined) g.todayPackageUpgradeAccum = 0;
      }

      // v15: Story unlock system + revenue tracking
      if (!saved.unlockedStories) {
        saved.unlockedStories = [];
        // Compute from existing enabled offerings
        for (const b of saved.buildings) {
          for (const o of (b.offerings || [])) {
            if (o.enabled && o.unlockStories) {
              for (const sid of o.unlockStories) {
                if (!saved.unlockedStories.includes(sid)) saved.unlockedStories.push(sid);
              }
            }
          }
        }
      }
      if (!saved.finances.revenueByRole) {
        (saved.finances as any).revenueByRole = { rooms: 0, ancillary: 0, amenities: 0 };
      }

      // v16: Building consolidation — merge removed types into new ones
      const MERGE_MAP: Record<string, string> = {
        'soft_drink': 'kiosk',
        'ice_cream': 'kiosk',
        'fast_food': 'barbecue',
        'souvenir_shop': 'gift_shop',
        'beach_disco': 'event_space',
        'club': 'event_space',
        'stage': 'event_space',
      };
      for (const b of saved.buildings) {
        const newType = MERGE_MAP[b.type as string];
        if (newType) {
          (b as any).type = newType;
          b.offerings = createDefaultOfferings(newType as any).filter((o: any) => o.unlockLevel <= b.level);
          for (const o of b.offerings) {
            if (o.unlockLevel === 1) o.enabled = true;
          }
        }
      }

      // v17: Initialize pendingOutcomes for probabilistic story system
      if (!saved.stories.pendingOutcomes) {
        saved.stories.pendingOutcomes = [];
      }

      // v18→v21: Economy rebalance — update staff costs to rescaled values (only for old saves)
      if (saved.staff && saved.staff.cleanerCostPerDay < 20) {
        saved.staff.cleanerCostPerDay = 80;
        saved.staff.animatorCostPerDay = 120;
        saved.staff.builderCostPerDay = 100;
        saved.staff.mechanicCostPerDay = 100;
        saved.staff.lifeguardCostPerDay = 120;
        saved.staff.securityCostPerDay = 150;
      }

      // Guest thought log: ensure selectedGuest exists
      if (saved.selectedGuest === undefined) saved.selectedGuest = null;
      if (saved.selectedStaff === undefined) saved.selectedStaff = null;

      // Clean up litter stuck inside buildings (occupied tiles)
      if (saved.litter && saved.litter.items) {
        saved.litter.items = saved.litter.items.filter((item: any) => {
          const tile = saved.grid.tiles[item.y]?.[item.x];
          return tile && tile.type !== 'occupied';
        });
      }

      // v21: Economy rescale — migrate old saves to new price scale
      if (!saved.version || saved.version < 21) {
        // Reset missions with new rescaled rewards
        const claimedIds = new Set((saved.missions || []).filter((m: any) => m.claimed).map((m: any) => m.id));
        const completedIds = new Set((saved.missions || []).filter((m: any) => m.completed).map((m: any) => m.id));
        saved.missions = createInitialMissions().map(m => ({
          ...m,
          claimed: claimedIds.has(m.id),
          completed: completedIds.has(m.id) || claimedIds.has(m.id),
        }));

        // Rescale money if still on old economy (small amounts)
        if (saved.money < 500 && saved.day <= 3) {
          saved.money = 3000;
        } else if (saved.money < 500) {
          saved.money = saved.money * 15;
        }

        // Rescale loan amounts for existing loans
        for (const loan of (saved.loans || [])) {
          if (loan.principal < 500) {
            loan.principal *= 15;
            loan.remaining *= 15;
            loan.dailyInterest *= 15;
            if (loan.dailyPayment) loan.dailyPayment *= 15;
          }
        }

        // Rescale totalMoneyEarned
        if (saved.totalMoneyEarned !== undefined && saved.totalMoneyEarned < 5000) {
          saved.totalMoneyEarned *= 15;
        }
      }

      saved.version = CURRENT_VERSION;
      this.store.dispatch(loadState(saved));
      return true;
    } catch (e) {
      console.error('Load failed:', e);
      return false;
    }
  }

  private migrateState(saved: any): void {
    if (!saved.ownedLand) saved.ownedLand = [INITIAL_OWNED];
    if (!saved.camera) saved.camera = { x: -250, y: 150, zoom: 0.7 };
    if (saved.camera && saved.camera.zoom === undefined) saved.camera.zoom = 1.0;
    if (!saved.marketing) saved.marketing = [];

    // v19: migrate camera from top-down to isometric defaults
    if (saved.version && saved.version < 19) {
      saved.camera = { x: -250, y: 150, zoom: 0.7 };
    }

    // v20: grid expanded from 40x20 to 50x25, buildings resized, camera reset
    if (!saved.version || saved.version < 20) {
      saved.camera = { x: -250, y: 150, zoom: 0.7 };

      // Expand grid if it's the old 40x20 size
      if (saved.grid && (saved.grid.width < GRID_WIDTH || saved.grid.height < GRID_HEIGHT)) {
        saved.grid = this.migrateGrid(saved.grid, saved.ownedLand || [INITIAL_OWNED], saved.buildings || []);
      }

      // Update building dimensions for resized buildings
      if (saved.buildings) {
        const sizeMap: Record<string, { w: number; h: number }> = {
          beach_hut: { w: 2, h: 2 }, hotel: { w: 4, h: 3 },
          beach_bar: { w: 2, h: 1 }, barbecue: { w: 2, h: 1 },
          restaurant: { w: 3, h: 2 }, kiosk: { w: 2, h: 1 },
          arcade: { w: 2, h: 2 }, main_pool: { w: 3, h: 3 },
          equipment_hire: { w: 2, h: 1 }, rep_office: { w: 2, h: 1 },
          windsurfing: { w: 2, h: 1 }, cocktail_bar: { w: 2, h: 1 },
          casino: { w: 3, h: 3 }, fun_pool: { w: 3, h: 3 },
          jacuzzi: { w: 2, h: 2 }, spa: { w: 3, h: 2 },
          mini_golf: { w: 3, h: 2 }, gift_shop: { w: 2, h: 1 },
          kids_club: { w: 3, h: 2 }, gym: { w: 2, h: 2 },
          concierge: { w: 2, h: 1 }, coworking: { w: 2, h: 2 },
          event_space: { w: 3, h: 3 },
        };
        for (const b of saved.buildings) {
          const newSize = sizeMap[b.type];
          if (newSize) {
            b.width = newSize.w;
            b.height = newSize.h;
          }
        }
        // Re-mark occupied tiles based on updated building sizes
        if (saved.grid) {
          for (const row of saved.grid.tiles) {
            for (const tile of row) {
              if (tile.type === 'occupied') {
                tile.type = 'sand';
                delete tile.buildingId;
              }
            }
          }
          for (const b of saved.buildings) {
            for (let dy = 0; dy < (b.height || 1); dy++) {
              for (let dx = 0; dx < (b.width || 1); dx++) {
                const t = saved.grid.tiles[b.y + dy]?.[b.x + dx];
                if (t) {
                  t.type = 'occupied';
                  t.buildingId = b.id;
                }
              }
            }
          }
        }
      }
    }
  }

  private migrateGrid(oldGrid: any, ownedParcels: LandParcel[], buildings: any[]): GameState['grid'] {
    const waterStartY = GRID_HEIGHT - WATER_ROWS;
    const tiles: any[][] = [];

    // Build set of occupied tiles from buildings
    const occupiedTiles = new Set<string>();
    for (const b of buildings) {
      for (let dy = 0; dy < (b.height || 1); dy++) {
        for (let dx = 0; dx < (b.width || 1); dx++) {
          occupiedTiles.add(`${b.x + dx},${b.y + dy}`);
        }
      }
    }

    // Keep existing owned parcels; only add small parcels around buildings that are outside owned land
    const expandedOwned: LandParcel[] = [...ownedParcels];
    for (const b of buildings) {
      const bx = b.x as number;
      const by = b.y as number;
      const bw = (b.width || 1) as number;
      const bh = (b.height || 1) as number;
      if (!this.isInAnyParcel(bx, by, expandedOwned)) {
        expandedOwned.push({ x: bx, y: by, w: bw, h: bh });
      }
    }

    const beachStartY = waterStartY - BEACH_ROWS;
    for (let y = 0; y < GRID_HEIGHT; y++) {
      tiles[y] = [];
      for (let x = 0; x < GRID_WIDTH; x++) {
        let type: TileType;
        if (y >= waterStartY) {
          type = 'water';
        } else if (occupiedTiles.has(`${x},${y}`)) {
          type = 'occupied';
        } else if (this.isInAnyParcel(x, y, expandedOwned)) {
          type = (y >= beachStartY) ? 'beach_sand' : 'sand';
        } else {
          type = 'unowned';
        }

        // Carry over buildingId from old grid if exists
        const oldTile = oldGrid.tiles?.[y]?.[x];
        tiles[y][x] = {
          x, y, type,
          ...(oldTile?.buildingId !== undefined ? { buildingId: oldTile.buildingId } : {}),
        };
      }
    }

    // Update ownedLand to include the old grid
    ownedParcels.length = 0;
    for (const p of expandedOwned) ownedParcels.push(p);

    return { width: GRID_WIDTH, height: GRID_HEIGHT, tiles };
  }

  private isInAnyParcel(x: number, y: number, parcels: LandParcel[]): boolean {
    return parcels.some(p => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
  }

  clear(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
      for (let i = 0; i <= 22; i++) {
        localStorage.removeItem(i === 0 ? 'beachlife_save' : `beachlife_save_v${i}`);
        localStorage.removeItem(i === 0 ? 'suncoast_save' : `suncoast_save_v${i}`);
      }
    } catch (e) {
      console.error('Clear failed:', e);
    }
  }
}
