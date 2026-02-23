import { GameState, Action, Building, Guest, NeedType, WeatherType, GameEvent, GameEventType, Mission, GuestSegment, ServicePackage, Loan, ImpactLogItem, Review, Contract, ReputationComponent, ReviewTopic, LitterItem, LitterType, LitterState, StaffRole, GuestThought, EventProgramType } from './types';
import { createFreshState, GRID_WIDTH, GRID_HEIGHT, WATER_ROWS, BEACH_ROWS, LAND_PARCEL_SIZE } from './initialState';
import {
  getBuildingDef, getEffectiveCapacity, getEffectiveIncome, getEffectiveMaintenance,
  getUpgradeCost, ADJACENCY_SYNERGIES, ADJACENCY_PENALTIES,
  createDefaultPackages, createDefaultOfferings, GUEST_SEGMENT_DEFS, getEffectivePackagePrice,
  isServiceIncluded, getOfferingHappinessForGuest, getEffectivePower, isBuildingUnlocked,
  ALL_BUILDING_TYPES, BUILDING_DEFS, getEffectiveBehaviorModifiers,
} from './buildingDefs';
import { canPlaceBuilding } from '../world/Placement';
import { Grid } from '../world/Grid';
import {
  getWeatherArrivalModifier,
  getWeatherHappinessModifier,
  calculateReputation,
  calculateReputationBreakdown,
  getOccupancyPercent,
  getGuestExperience,
  getSegmentAttractiveness,
  getMaintenanceMult,
  getRoomPriceMult,
  getStarTier,
} from './selectors';
import { STORY_CARDS } from './storyCards';
import { REVIEW_TEMPLATES } from './reviewTemplates';
import { CONTRACT_POOL } from './contracts';
import { getCampaignDef } from './marketingDefs';

// ── Review Topic -> Reputation Component Mapping ────────────────────
const TOPIC_TO_COMPONENT: Record<ReviewTopic, ReputationComponent> = {
  cleanliness: 'cleanliness',
  queues: 'value',
  service: 'value',
  noise: 'nightlife',
  value: 'value',
  food: 'foodQuality',
  entertainment: 'fun',
  safety: 'safety',
};

// ── Helpers ──────────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const NEED_RISE_PER_DAY: Record<NeedType, number> = {
  hunger: 35, thirst: 40, fun: 25,
  relaxation: 20, toilet: 40, accommodation: 5,
  beach: 30, stroll: 20,
};

const NEED_THRESHOLD = 35;
const VISIT_DURATION = 0.15;
const POST_VISIT_COOLDOWN = 0.05;

// ── Litter Constants ────────────────────────────────────────────────
const LITTER_TYPES: LitterType[] = ['wrapper', 'cup', 'bottle', 'napkin', 'plate'];
const LITTER_CHANCE_FOOD = 0.35;    // chance to drop litter after food/drink visit
const LITTER_CHANCE_BEACH = 0.15;   // chance to drop litter when leaving beach
const LITTER_CHANCE_IDLE = 0.02;    // small chance per tick while idle on walkable tiles
const LITTER_TRASH_BIN_RADIUS = 4;  // tiles radius around trash bin that reduces litter chance
const MAX_LITTER = 200;             // cap total litter items

// ── Segment-based Guest Creation ────────────────────────────────────

function pickSegment(reputationNorm: number, hasAccommodation: boolean, dayPassEnabled: boolean, state?: GameState): GuestSegment {
  const weights: Record<GuestSegment, number> = { family: 0, couple: 0, nomad: 0, vip: 0, local: 0 };

  for (const seg of Object.keys(GUEST_SEGMENT_DEFS) as GuestSegment[]) {
    const def = GUEST_SEGMENT_DEFS[seg];
    let w = def.spawnWeight;
    // Modulate by segment attractiveness if state available
    if (state) {
      const attr = getSegmentAttractiveness(state, seg);
      w *= attr.score;
    }
    weights[seg] = w;
  }

  // VIPs only at higher reputation
  if (reputationNorm < 0.4) weights.vip = 0;
  else weights.vip *= reputationNorm;

  // Locals only if day pass enabled
  if (!dayPassEnabled) weights.local = 0;

  // If no accommodation, only locals can come
  if (!hasAccommodation) {
    for (const k of Object.keys(weights) as GuestSegment[]) {
      if (k !== 'local') weights[k] = 0;
    }
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total === 0) return 'local';

  let r = Math.random() * total;
  for (const [seg, w] of Object.entries(weights) as [GuestSegment, number][]) {
    r -= w;
    if (r <= 0) return seg;
  }
  return 'nomad';
}

function checkPackageHardRequirements(pkg: ServicePackage, allBuildings: Building[]): boolean {
  if (!pkg.hardRequirements || pkg.hardRequirements.length === 0) return true;
  return pkg.hardRequirements.every(req => {
    return allBuildings.some(b => b.type === req.buildingType && b.level >= req.level && !b.isConstructing && b.powered && !b.damaged);
  });
}

function pickPackageForGuest(segment: GuestSegment, building: Building, allBuildings?: Building[]): string | null {
  if (segment === 'local') return null;

  const def = GUEST_SEGMENT_DEFS[segment];
  const enabledPkgs = building.packages.filter(p =>
    p.enabled && p.unlockLevel <= building.level &&
    checkPackageHardRequirements(p, allBuildings ?? [building])
  );
  if (enabledPkgs.length === 0) return null;

  // Try to find preferred package
  const preferred = enabledPkgs.find(p => p.id === def.preferredPackage);
  if (preferred) {
    const effectivePrice = getEffectivePackagePrice(preferred, building.level);
    const budget = def.budgetMin + Math.random() * (def.budgetMax - def.budgetMin);
    // Price-sensitive guests refuse expensive packages
    if (effectivePrice <= budget * (1 - def.priceSensitivity * 0.3)) {
      return preferred.id;
    }
  }

  // Fallback: pick cheapest affordable enabled package
  const sorted = [...enabledPkgs].sort((a, b) =>
    getEffectivePackagePrice(a, building.level) - getEffectivePackagePrice(b, building.level)
  );
  for (const pkg of sorted) {
    const effectivePrice = getEffectivePackagePrice(pkg, building.level);
    const budget = def.budgetMin + Math.random() * (def.budgetMax - def.budgetMin);
    if (effectivePrice <= budget * 0.8) return pkg.id;
  }

  // Take cheapest regardless if not too price sensitive
  if (def.priceSensitivity < 0.7 && sorted.length > 0) {
    return sorted[0].id;
  }

  return null; // can't afford any package
}

function createGuest(id: number, day: number, segment: GuestSegment, packageId: string | null): Guest {
  const def = GUEST_SEGMENT_DEFS[segment];
  const isVIP = segment === 'vip';
  const stayDuration = segment === 'local' ? 1 : def.stayMin + Math.floor(Math.random() * (def.stayMax - def.stayMin + 1));

  return {
    id,
    happiness: def.happinessBase + Math.floor(Math.random() * def.happinessRange),
    money: def.budgetMin + Math.floor(Math.random() * (def.budgetMax - def.budgetMin)),
    needs: {
      hunger: 40 + Math.floor(Math.random() * 30),    // hungry from travel
      thirst: 45 + Math.floor(Math.random() * 30),    // thirsty from travel
      fun: 10 + Math.floor(Math.random() * 20),       // excited, not bored yet
      relaxation: 50 + Math.floor(Math.random() * 25), // tired from travel
      toilet: 50 + Math.floor(Math.random() * 30),    // definitely need the toilet
      accommodation: 0,
      beach: 55 + Math.floor(Math.random() * 25),     // came here for the beach!
      stroll: 15 + Math.floor(Math.random() * 20),    // will want to explore later
    },
    stayDuration,
    originalStayDuration: stayDuration,
    arrivalDay: day,
    assignedAccommodation: null,
    currentVisiting: null,
    visitTimeLeft: 0,
    isVIP,
    segment,
    packageId,
    visitCounts: {},
    dailySpendRemaining: def.spendPerDay,
    beachTile: null,
    thoughts: [],
    stayBonusApplied: 0,
    packageUpgraded: false,
    effectivePriceSensitivity: def.priceSensitivity,
    todayStayBonusAccum: 0,
    todayPackageUpgradeAccum: 0,
  };
}

function advanceWeather(w: { current: WeatherType; daysUntilChange: number }) {
  if (w.daysUntilChange > 0) return { ...w, daysUntilChange: w.daysUntilChange - 1 };
  const types: WeatherType[] = ['sunny', 'sunny', 'sunny', 'cloudy', 'cloudy', 'rain', 'storm'];
  return { current: types[Math.floor(Math.random() * types.length)], daysUntilChange: 1 + Math.floor(Math.random() * 3) };
}

function countVisitors(guests: Guest[], buildingId: number): number {
  return guests.filter(g => g.currentVisiting === buildingId).length;
}

function getStaffCount(staffState: any, role: string): number {
  return (staffState as Record<string, number>)[role] ?? 0;
}

function isOperational(b: Building, staffState?: any): boolean {
  if (b.isConstructing || !b.powered || b.damaged) return false;
  const def = getBuildingDef(b.type);
  if (def.requiresStaff && staffState) {
    const required = def.requiredStaffCount ?? 1;
    const requiredAtLevel = b.level >= 2 ? required + 1 : required;
    const available = getStaffCount(staffState, def.requiresStaff);
    if (available < requiredAtLevel) return false;
  }
  return true;
}

function getGuestPackage(guest: Guest, buildings: Building[]): ServicePackage | null {
  if (!guest.packageId || !guest.assignedAccommodation) return null;
  const accom = buildings.find(b => b.id === guest.assignedAccommodation);
  if (!accom) return null;
  return accom.packages.find(p => p.id === guest.packageId) ?? null;
}

/** Sync package prices/enabled from an existing building of the same type */
function syncPackagesFromExisting(packages: ServicePackage[], buildingType: string, existingBuildings: Building[]): ServicePackage[] {
  const sibling = existingBuildings.find(b => b.type === buildingType && b.packages.length > 0);
  if (!sibling) return packages;
  return packages.map(pkg => {
    const match = sibling.packages.find(p => p.id === pkg.id);
    if (match) {
      return { ...pkg, pricePerNight: match.pricePerNight, enabled: match.enabled };
    }
    return pkg;
  });
}

/** Sync priceMultiplier from an existing building of the same type */
function syncPriceFromExisting(buildingType: string, existingBuildings: Building[]): number {
  const sibling = existingBuildings.find(b => b.type === buildingType);
  return sibling ? sibling.priceMultiplier : 1.0;
}

// ── Adjacency Bonus Calculation ──────────────────────────────────────

function computeAdjacencyBonuses(buildings: Building[]): void {
  for (const b of buildings) {
    if (b.isConstructing) { b.adjacencyBonus = 0; continue; }

    const synergies = ADJACENCY_SYNERGIES[b.type] ?? [];
    const penalties = ADJACENCY_PENALTIES[b.type] ?? [];
    if (synergies.length === 0 && penalties.length === 0) { b.adjacencyBonus = 0; continue; }

    let bonus = 0;
    for (const other of buildings) {
      if (other.id === b.id || other.isConstructing) continue;

      const dx = Math.abs((b.x + b.width / 2) - (other.x + other.width / 2));
      const dy = Math.abs((b.y + b.height / 2) - (other.y + other.height / 2));
      const adjacent = dx <= (b.width / 2 + other.width / 2 + 1) && dy <= (b.height / 2 + other.height / 2 + 1);

      if (!adjacent) continue;

      if (synergies.includes(other.type)) bonus += 0.15;
      if (penalties.includes(other.type)) bonus -= 0.10;
    }

    b.adjacencyBonus = Math.max(-0.3, Math.min(0.5, bonus));
  }
}

// ── Power System ─────────────────────────────────────────────────────

const BASE_POWER_SUPPLY = 2;

function updatePowerState(buildings: Building[]): void {
  const genSupply = buildings
    .filter(b => !b.isConstructing && !b.damaged && getBuildingDef(b.type).powerProduction > 0)
    .reduce((s, b) => s + getEffectivePower(b), 0);

  let remaining = BASE_POWER_SUPPLY + genSupply;

  for (const b of buildings) {
    if (b.isConstructing) { b.powered = false; continue; }
    const def = getBuildingDef(b.type);
    if (def.requiresPower === false || def.powerConsumption === 0) {
      b.powered = true;
    } else if (remaining >= def.powerConsumption) {
      b.powered = true;
      remaining -= def.powerConsumption;
    } else {
      b.powered = false;
    }
  }
}

// ── Construction System ──────────────────────────────────────────────

function processConstruction(buildings: Building[], deltaProgress: number, builderStaff: number): void {
  const builderSlots = 1 + buildings.filter(b => b.type === 'cleaners_shack' && !b.isConstructing).length + builderStaff;
  const constructing = buildings.filter(b => b.isConstructing);
  const active = constructing.slice(0, builderSlots);
  // Each builder staff adds 25% speed bonus to all active construction
  const speedMult = 1 + builderStaff * 0.25;

  for (const b of active) {
    const def = getBuildingDef(b.type);
    if (def.constructionDays <= 0) {
      b.isConstructing = false;
      b.constructionProgress = 1;
      continue;
    }
    b.constructionProgress += (deltaProgress / def.constructionDays) * speedMult;
    if (b.constructionProgress >= 1) {
      b.isConstructing = false;
      b.constructionProgress = 1;
    }
  }
}

// ── Event System ─────────────────────────────────────────────────────

const EVENT_POOL: { type: GameEventType; title: string; desc: string; days: number }[] = [
  { type: 'vip_guest', title: 'VIP Arrival!', desc: 'A VIP guest is coming! They pay 5x but leave if unhappy.', days: 0 },
  { type: 'festival', title: 'Beach Festival!', desc: 'Double guest arrivals for 2 days!', days: 2 },
  { type: 'competitor', title: 'Competitor Opens!', desc: 'A rival resort opened nearby. Guests want lower prices for 3 days.', days: 3 },
  { type: 'celebrity', title: 'Celebrity Visit!', desc: 'A celebrity is visiting! Keep them happy for a reputation boost.', days: 0 },
  { type: 'inspection', title: 'Health Inspection!', desc: 'Inspectors are checking hygiene. No toilets/cleaners = $100 fine!', days: 0 },
  { type: 'heatwave', title: 'Heatwave!', desc: 'Scorching heat! More guests, but thirst rises twice as fast for 2 days.', days: 2 },
  { type: 'power_surge', title: 'Power Surge!', desc: 'A power surge damaged a random building!', days: 0 },
];

// ── Event Space Programming ──────────────────────────────────────────

interface EventProgramDef {
  type: EventProgramType;
  name: string;
  happinessBonus: number;
  nightlifeBonus: number;
  noisePenalty: number;      // families/VIP near event lose happiness
  safetyPenalty: number;     // reputation safety reduction
  costPerDay: number;
  segmentEffects: Partial<Record<GuestSegment, number>>;  // happiness modifier per segment
}

const EVENT_PROGRAMS: Record<EventProgramType, EventProgramDef> = {
  cinema_night: { type: 'cinema_night', name: 'Cinema Night', happinessBonus: 3, nightlifeBonus: 5, noisePenalty: 0, safetyPenalty: 0, costPerDay: 80,
    segmentEffects: { family: 4, couple: 3, nomad: 2 } },
  live_band: { type: 'live_band', name: 'Live Band', happinessBonus: 5, nightlifeBonus: 12, noisePenalty: 2, safetyPenalty: 0, costPerDay: 150,
    segmentEffects: { couple: 5, nomad: 4, vip: 3, family: 2 } },
  kids_show: { type: 'kids_show', name: 'Kids Show', happinessBonus: 4, nightlifeBonus: 0, noisePenalty: 0, safetyPenalty: 0, costPerDay: 100,
    segmentEffects: { family: 8, couple: 1 } },
  silent_party: { type: 'silent_party', name: 'Silent Party', happinessBonus: 4, nightlifeBonus: 8, noisePenalty: 0, safetyPenalty: 0, costPerDay: 120,
    segmentEffects: { nomad: 5, couple: 4 } },
  dj_night: { type: 'dj_night', name: 'DJ Night', happinessBonus: 4, nightlifeBonus: 15, noisePenalty: 4, safetyPenalty: 3, costPerDay: 140,
    segmentEffects: { nomad: 5, couple: 3, family: -3, vip: -2 } },
};

function generateRandomEvent(state: GameState): GameEvent | null {
  if (state.day < state.nextEventDay) return null;

  const pool = EVENT_POOL.filter(e => {
    if (e.type === 'vip_guest' && state.guests.length < 3) return false;
    if (e.type === 'inspection' && state.buildings.length < 3) return false;
    if (e.type === 'power_surge' && state.buildings.filter(b => !b.isConstructing).length < 2) return false;
    return true;
  });

  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return {
    type: pick.type,
    title: pick.title,
    description: pick.desc,
    daysRemaining: pick.days,
    day: state.day,
  };
}

function applyEventEffect(state: GameState, event: GameEvent): GameState {
  let s = { ...state };

  switch (event.type) {
    case 'vip_guest': {
      const vip = createGuest(s.nextGuestId, s.day, 'vip', null);
      const accomBuildings = s.buildings.filter(b =>
        isOperational(b) && getBuildingDef(b.type).satisfiesNeed === 'accommodation'
        && b.currentGuests < getEffectiveCapacity(b.type, b.level, b)
      );
      if (accomBuildings.length > 0) {
        const chosen = accomBuildings[0];
        const pkgId = pickPackageForGuest('vip', chosen, s.buildings);
        if (pkgId) {
          vip.packageId = pkgId;
          vip.assignedAccommodation = chosen.id;
          const buildings = s.buildings.map(b => b.id === chosen.id ? { ...b, currentGuests: b.currentGuests + 1 } : b);
          return { ...s, guests: [...s.guests, vip], buildings, nextGuestId: s.nextGuestId + 1 };
        }
      }
      return s;
    }

    case 'inspection': {
      const hasToilet = s.buildings.some(b => b.type === 'toilet' && isOperational(b));
      const hasCleaner = s.buildings.some(b => b.type === 'cleaners_shack' && !b.isConstructing);
      let fine = 0;
      if (!hasToilet) fine += 100;
      if (!hasCleaner) fine += 50;
      if (fine > 0) {
        return { ...s, money: s.money - fine };
      }
      return { ...s, reputation: Math.min(100, s.reputation + 2) };
    }

    case 'celebrity': {
      const celeb = createGuest(s.nextGuestId, s.day, 'vip', null);
      celeb.happiness = 60;
      const accom = s.buildings.filter(b =>
        isOperational(b) && getBuildingDef(b.type).satisfiesNeed === 'accommodation'
        && b.currentGuests < getEffectiveCapacity(b.type, b.level, b)
      );
      if (accom.length > 0) {
        const chosen = accom[0];
        const pkgId = pickPackageForGuest('vip', chosen, s.buildings);
        if (pkgId) {
          celeb.packageId = pkgId;
          celeb.assignedAccommodation = chosen.id;
          const buildings = s.buildings.map(b => b.id === chosen.id ? { ...b, currentGuests: b.currentGuests + 1 } : b);
          return { ...s, guests: [...s.guests, celeb], buildings, nextGuestId: s.nextGuestId + 1 };
        }
      }
      return s;
    }

    case 'power_surge': {
      const operational = s.buildings.filter(b => !b.isConstructing && !b.damaged);
      if (operational.length > 0) {
        const victim = operational[Math.floor(Math.random() * operational.length)];
        return {
          ...s,
          buildings: s.buildings.map(b => b.id === victim.id ? { ...b, damaged: true } : b),
        };
      }
      return s;
    }

    default:
      return s;
  }
}

// ── Mission Checking ─────────────────────────────────────────────────

// Track segment departures: stored in a simple map during processDayEnd
interface DepartureStats {
  segmentCounts: Partial<Record<GuestSegment, number>>;
  happyVipDeparted: boolean;
}

function checkMissions(state: GameState, departures?: DepartureStats): Mission[] {
  return state.missions.map(m => {
    if (m.completed) return m;

    let met = false;
    switch (m.type) {
      case 'build_count':
        met = state.buildings.length >= m.target;
        break;
      case 'build_type':
        met = state.buildings.some(b => b.type === m.targetBuildingType || (
          m.targetBuildingType === 'beach_hut' && (b.type === 'beach_hut' || b.type === 'hotel')
        ));
        break;
      case 'reach_guests':
        met = state.guests.length >= m.target;
        break;
      case 'reach_reputation':
        met = state.reputation >= m.target;
        break;
      case 'earn_money':
        met = state.totalMoneyEarned >= m.target;
        break;
      case 'serve_guests':
        met = state.totalGuestsServed >= m.target;
        break;
      case 'reach_day':
        met = state.day >= m.target;
        break;
      case 'upgrade_building':
        met = state.buildings.some(b => b.level >= m.target);
        break;
      case 'enable_daypass':
        met = state.dayPassEnabled;
        break;
      case 'serve_segment':
        if (m.targetSegment === 'vip' && departures?.happyVipDeparted) {
          met = true;
        } else if (m.targetSegment && departures?.segmentCounts) {
          met = (departures.segmentCounts[m.targetSegment] ?? 0) >= m.target;
        }
        break;
    }

    return met ? { ...m, completed: true } : m;
  });
}

// ── Litter Helpers ──────────────────────────────────────────────────

function createLitterItem(nextId: number, tileX: number, tileY: number, day: number, seed: number): LitterItem {
  return {
    id: nextId,
    x: tileX,
    y: tileY,
    offsetX: seededRandom(seed * 31) * 0.8 + 0.1,
    offsetY: seededRandom(seed * 37) * 0.8 + 0.1,
    type: LITTER_TYPES[Math.floor(seededRandom(seed * 41) * LITTER_TYPES.length)],
    createdDay: day,
  };
}

function isNearTrashBin(tileX: number, tileY: number, trashBins: Array<{ x: number; y: number }>): boolean {
  for (const bin of trashBins) {
    const dx = Math.abs(bin.x - tileX);
    const dy = Math.abs(bin.y - tileY);
    if (dx <= LITTER_TRASH_BIN_RADIUS && dy <= LITTER_TRASH_BIN_RADIUS) return true;
  }
  return false;
}

function processLitterCleaning(litter: LitterState, cleaners: number, _buildings: Building[], deltaProgress: number): LitterState {
  if (litter.items.length === 0 || cleaners === 0) return litter;

  // Each cleaner removes ~8 items per day — requires multiple cleaners for big resorts
  const urgencyMult = litter.items.length > 30 ? 1.3 : 1.0;
  const cleanRate = cleaners * 8 * urgencyMult * deltaProgress;
  let toRemove = Math.floor(cleanRate);
  // Use Math.random() instead of seededRandom — seededRandom with a constant seed
  // would return the same value every frame, causing litter to never be removed
  if (Math.random() < (cleanRate - toRemove)) toRemove++;

  if (toRemove <= 0) return litter;

  // Remove oldest litter first
  const sorted = [...litter.items].sort((a, b) => a.createdDay - b.createdDay);
  const remaining = sorted.slice(toRemove);
  return { ...litter, items: remaining };
}

// ── Guest Thought Helper ─────────────────────────────────────────────

const MAX_THOUGHTS = 20;

function addThought(
  guest: Guest,
  text: string,
  mood: GuestThought['mood'],
  day: number,
  dayProgress: number,
  repComponent?: ReputationComponent,
): void {
  guest.thoughts.push({ text, mood, repComponent, dayProgress, day });
  if (guest.thoughts.length > MAX_THOUGHTS) {
    guest.thoughts.splice(0, guest.thoughts.length - MAX_THOUGHTS);
  }
}

// ── Continuous Guest Activity ────────────────────────────────────────

function processGuestActivity(state: GameState, deltaProgress: number): GameState {
  const buildings = state.buildings.map(b => ({ ...b, packages: b.packages.map(p => ({ ...p })), offerings: b.offerings.map(o => ({ ...o })) }));

  processConstruction(buildings, deltaProgress, state.staff.builders);
  updatePowerState(buildings);
  computeAdjacencyBonuses(buildings);

  if (state.guests.length === 0) {
    // Still process litter cleaning even with no guests
    const cleanedLitter = processLitterCleaning(state.litter, state.staff.cleaners, buildings, deltaProgress);
    return { ...state, buildings, litter: cleanedLitter };
  }

  // Compute path reachability from entrance (cached per tick)
  // If no paths exist at all, skip path checks (early game grace period)
  const hasAnyPaths = state.grid.tiles.some(row => row.some(t => t.type === 'path'));
  const reachable: Map<string, number> | null = hasAnyPaths ? Grid.computePathReachable(state.grid, state.entrance) : null;

  const guests = state.guests.map(g => ({ ...g, needs: { ...g.needs }, visitCounts: { ...g.visitCounts }, beachTile: g.beachTile ? { ...g.beachTile } : null, thoughts: [...(g.thoughts || [])] }));
  let money = state.money;
  let ancillaryRevenue = state.pendingAncillary;
  const impactLog = [...state.impactLog];

  // Litter tracking
  const newLitterItems: LitterItem[] = [];
  let litterNextId = state.litter.nextId;

  const hasHeatwave = state.events.some(e => e.type === 'heatwave' && e.daysRemaining > 0);
  const hasCompetitor = state.events.some(e => e.type === 'competitor' && e.daysRemaining > 0);

  // Grow needs (scaled by segment)
  const needKeys: NeedType[] = ['hunger', 'thirst', 'fun', 'relaxation', 'toilet', 'accommodation', 'beach', 'stroll'];
  for (const guest of guests) {
    const segDef = GUEST_SEGMENT_DEFS[guest.segment];
    for (const need of needKeys) {
      let rate = NEED_RISE_PER_DAY[need] * deltaProgress * segDef.needMultipliers[need];
      if (need === 'thirst' && hasHeatwave) rate *= 2;
      guest.needs[need] = Math.min(100, guest.needs[need] + rate);
    }
  }

  for (const guest of guests) {
    // --- Currently visiting ---
    if (guest.currentVisiting !== null) {
      guest.visitTimeLeft -= deltaProgress;

      // Beach: continuous relaxation while lying on the beach
      if (guest.currentVisiting === -1) {
        guest.needs.relaxation = Math.max(0, guest.needs.relaxation - 25 * deltaProgress);
        guest.needs.fun = Math.max(0, guest.needs.fun - 8 * deltaProgress);
        guest.needs.stroll = Math.max(0, guest.needs.stroll - 5 * deltaProgress);
      }

      // Force guests off the beach during storm/rain or if urgent needs
      if (guest.currentVisiting === -1) {
        const urgentOnBeach = guest.needs.toilet >= 80 || guest.needs.hunger >= 90 || guest.needs.thirst >= 90;
        const stormOnBeach = state.weather.current === 'storm';
        const rainOnBeach = state.weather.current === 'rain';
        if (urgentOnBeach || stormOnBeach || rainOnBeach) {
          guest.visitTimeLeft = 0; // force completion
          if (guest.needs.toilet >= 80) {
            addThought(guest, 'Had to leave the beach to find a toilet — wish there was one closer to the beach!', 'negative', state.day, state.dayProgress, 'cleanliness');
          }
          if (guest.needs.hunger >= 90) {
            addThought(guest, 'Starving! Had to leave the beach to find food', 'negative', state.day, state.dayProgress, 'foodQuality');
          }
          if (guest.needs.thirst >= 90) {
            addThought(guest, 'So thirsty, had to leave the beach to get a drink', 'negative', state.day, state.dayProgress, 'foodQuality');
          }
          if (stormOnBeach && !guest.thoughts.some(t => t.text.includes('storm') && t.text.includes('beach') && t.day === state.day)) {
            addThought(guest, 'Had to run off the beach — storm hit! Are they crazy to let us be there?', 'negative', state.day, state.dayProgress, 'safety');
          }
          if (rainOnBeach && !stormOnBeach && !guest.thoughts.some(t => t.text.includes('rain') && t.text.includes('beach') && t.day === state.day)) {
            addThought(guest, 'Rain started, leaving the beach...', 'neutral', state.day, state.dayProgress);
          }
        }
      }

      if (guest.visitTimeLeft <= 0) {
        // Beach visit completion (special ID -1)
        if (guest.currentVisiting === -1) {
          // Thought: beach litter or clean beach
          const nearbyLitter = state.litter.items.filter(l =>
            guest.beachTile && Math.abs(l.x - guest.beachTile.x) <= 2 && Math.abs(l.y - guest.beachTile.y) <= 2
          ).length;
          if (nearbyLitter >= 3) {
            addThought(guest, 'Ugh, trash everywhere on the beach...', 'negative', state.day, state.dayProgress, 'cleanliness');
          } else if (nearbyLitter === 0 && state.litter.items.length < 5) {
            addThought(guest, 'Beautiful clean beach!', 'positive', state.day, state.dayProgress, 'beauty');
          }

          // Litter: chance to leave trash on beach
          if (guest.beachTile && state.litter.items.length + newLitterItems.length < MAX_LITTER) {
            let chance = LITTER_CHANCE_BEACH;
            if (isNearTrashBin(guest.beachTile.x, guest.beachTile.y, state.trashBins)) chance *= 0.3;
            if (seededRandom(guest.id * 23 + state.day * 11) < chance) {
              newLitterItems.push(createLitterItem(litterNextId++, guest.beachTile.x, guest.beachTile.y, state.day, guest.id * 29 + state.day));
            }
          }
          guest.currentVisiting = null;
          guest.beachTile = null;
          guest.visitTimeLeft = -(POST_VISIT_COOLDOWN + seededRandom(guest.id * 7) * 0.04);
          continue;
        }
        const bldg = buildings.find(b => b.id === guest.currentVisiting);
        if (bldg) {
          bldg.currentGuests = Math.max(0, bldg.currentGuests - 1);
          const def = getBuildingDef(bldg.type);
          const income = getEffectiveIncome(bldg.type, bldg.level, bldg);

          if (def.satisfiesNeed && def.satisfiesNeed !== 'accommodation') {
            guest.needs[def.satisfiesNeed] = Math.max(0, guest.needs[def.satisfiesNeed] - 45);
            guest.visitCounts[def.satisfiesNeed] = (guest.visitCounts[def.satisfiesNeed] ?? 0) + 1;
          }

          const guestPkg = getGuestPackage(guest, buildings);
          const included = isServiceIncluded(guestPkg, def.category);

          const adjMult = 1 + bldg.adjacencyBonus;
          const segDef = GUEST_SEGMENT_DEFS[guest.segment];
          const vipMult = guest.isVIP ? 3 : 1;

          const offeringHappiness = getOfferingHappinessForGuest(bldg, guest.segment);

          if (included) {
            // All-inclusive: no money charged, but much more happiness
            let happinessGain = 5 + Math.round(offeringHappiness * 0.7);
            if (bldg.adjacencyBonus > 0) happinessGain += 1;
            guest.happiness = Math.max(0, Math.min(100, guest.happiness + happinessGain));
            // Thought: positive all-inclusive experience
            if (def.category === 'food_drink') {
              addThought(guest, `The ${def.name} was delicious — and it's all-inclusive!`, 'positive', state.day, state.dayProgress, 'foodQuality');
            } else if (def.category === 'entertainment') {
              addThought(guest, `${def.name} was a blast!`, 'positive', state.day, state.dayProgress, 'fun');
            }
          } else {
            // Paid visit: capped by dailySpendRemaining
            let rawPrice = Math.round(income.perVisit * bldg.priceMultiplier * adjMult * vipMult * segDef.ancillarySpendRate);

            // Casino risk mechanics: variable income per visit
            if (bldg.type === 'casino') {
              const roll = Math.random();
              const isVipGambler = guest.segment === 'vip';
              if (roll < 0.15) {
                // Guest wins: resort loses money
                const loss = isVipGambler ? rawPrice * 3 : rawPrice;
                money -= loss;
                ancillaryRevenue -= loss;
                impactLog.push({ day: state.day, category: 'money', label: 'Casino: guest won big!', delta: -loss, causeId: `casino_loss_${bldg.id}`, relatedEntityId: bldg.id });
                guest.happiness = Math.min(100, guest.happiness + 8);
                addThought(guest, 'I won at the casino! Lucky day!', 'positive', state.day, state.dayProgress, 'fun');
                rawPrice = 0;
              } else if (roll < 0.40) {
                // Big house win: 2x income
                rawPrice = rawPrice * 2;
                if (isVipGambler) rawPrice = Math.round(rawPrice * 1.5);
                impactLog.push({ day: state.day, category: 'money', label: 'Casino: house wins big', delta: rawPrice, causeId: `casino_win_${bldg.id}`, relatedEntityId: bldg.id });
              }
              // else: normal income (60% chance)
            }

            const cappedPrice = Math.min(rawPrice, guest.dailySpendRemaining);
            if (cappedPrice > 0 && guest.money >= cappedPrice) {
              guest.money -= cappedPrice;
              guest.dailySpendRemaining -= cappedPrice;
              money += cappedPrice;
              ancillaryRevenue += cappedPrice;
              impactLog.push({ day: state.day, category: 'money', label: `${def.name} visit`, delta: cappedPrice, causeId: `building_${bldg.type}_${bldg.id}`, relatedEntityId: bldg.id });
            } else if (rawPrice > 0 && (guest.money < rawPrice || guest.dailySpendRemaining <= 0)) {
              guest.happiness = Math.max(0, guest.happiness - 3);
              if (guest.money < rawPrice) {
                addThought(guest, `${def.name} costs $${rawPrice} but I only have $${guest.money}...`, 'negative', state.day, state.dayProgress, 'value');
              } else {
                addThought(guest, `Wanted to pay at ${def.name} but hit my daily spending limit`, 'negative', state.day, state.dayProgress, 'value');
              }
            }

            let happinessGain = 2 + Math.round(offeringHappiness);
            if (bldg.priceMultiplier > 1.2) {
              happinessGain -= Math.round(4 * (bldg.priceMultiplier - 1.2));
            } else if (bldg.priceMultiplier < 0.8) {
              happinessGain += 1;
            }
            if (bldg.adjacencyBonus > 0) happinessGain += 1;
            if (guest.isVIP && happinessGain < 3) happinessGain -= 2;

            guest.happiness = Math.max(0, Math.min(100, guest.happiness + happinessGain));

            // Thought: building visit reaction (enriched for economy overhaul)
            if (bldg.type === 'restaurant' && bldg.level >= 3 && happinessGain >= 4) {
              addThought(guest, 'This restaurant alone was worth the stay!', 'positive', state.day, state.dayProgress, 'foodQuality');
            } else if (bldg.type === 'kids_club' && guest.segment === 'family') {
              addThought(guest, 'Kids loved the club — we might stay another day!', 'positive', state.day, state.dayProgress, 'fun');
            } else if (def.role === 'experience_driver' && happinessGain >= 3) {
              addThought(guest, `${def.name} really makes this place special!`, 'positive', state.day, state.dayProgress, 'fun');
            } else if (happinessGain >= 3 && def.category === 'food_drink') {
              addThought(guest, `The ${def.name} was great!`, 'positive', state.day, state.dayProgress, 'foodQuality');
            } else if (happinessGain >= 3 && def.category === 'entertainment') {
              addThought(guest, `Had fun at the ${def.name}!`, 'positive', state.day, state.dayProgress, 'fun');
            } else if (bldg.priceMultiplier > 1.3) {
              addThought(guest, `${def.name} is overpriced...`, 'negative', state.day, state.dayProgress, 'value');
            }
          }

          // Economy overhaul: accumulate behavior modifiers from experience/revenue buildings
          const behaviorMods = getEffectiveBehaviorModifiers(bldg);
          if (behaviorMods.stayBonusDays > 0) {
            const segMultiplier = (bldg.type === 'kids_club' && guest.segment === 'family') ? 1.5 :
                                  (bldg.type === 'gym' && guest.segment === 'nomad') ? 1.3 : 1.0;
            guest.todayStayBonusAccum += behaviorMods.stayBonusDays * segMultiplier;
          }
          if (behaviorMods.packageUpgradeChance > 0) {
            guest.todayPackageUpgradeAccum += behaviorMods.packageUpgradeChance;
          }
          if (behaviorMods.priceSensitivityModifier !== 0) {
            guest.effectivePriceSensitivity = Math.max(0, Math.min(1,
              guest.effectivePriceSensitivity + behaviorMods.priceSensitivityModifier));
          }
          if (behaviorMods.needSatisfactionBonus > 0 && def.satisfiesNeed && def.satisfiesNeed !== 'accommodation') {
            guest.needs[def.satisfiesNeed] = Math.max(0, guest.needs[def.satisfiesNeed] - behaviorMods.needSatisfactionBonus);
          }

          // Litter: food/drink buildings have higher litter chance
          if (state.litter.items.length + newLitterItems.length < MAX_LITTER) {
            const isFood = def.category === 'food_drink';
            const litterChance = isFood ? LITTER_CHANCE_FOOD : LITTER_CHANCE_IDLE * 3;
            let adjustedChance = litterChance;
            if (isNearTrashBin(bldg.x, bldg.y, state.trashBins)) adjustedChance *= 0.3;
            if (seededRandom(guest.id * 43 + state.day * 13 + bldg.id) < adjustedChance) {
              // Drop litter on walkable tiles AROUND the building, not inside it
              const litterSpots: Array<{ x: number; y: number }> = [];
              for (let dy = -1; dy <= bldg.height; dy++) {
                for (let dx = -1; dx <= bldg.width; dx++) {
                  if (dx >= 0 && dx < bldg.width && dy >= 0 && dy < bldg.height) continue; // skip building tiles
                  const tx = bldg.x + dx;
                  const ty = bldg.y + dy;
                  if (tx < 0 || ty < 0 || tx >= state.grid.width || ty >= state.grid.height) continue;
                  const tile = state.grid.tiles[ty]?.[tx];
                  if (tile && (tile.type === 'path' || tile.type === 'sand' || tile.type === 'beach_sand')) {
                    litterSpots.push({ x: tx, y: ty });
                  }
                }
              }
              if (litterSpots.length > 0) {
                const spot = litterSpots[Math.floor(seededRandom(guest.id * 47 + bldg.id) * litterSpots.length)];
                newLitterItems.push(createLitterItem(litterNextId++, spot.x, spot.y, state.day, guest.id * 59 + state.day + bldg.id));
              }
            }
          }
        }
        guest.currentVisiting = null;
        guest.visitTimeLeft = -(POST_VISIT_COOLDOWN + seededRandom(guest.id * 7) * 0.04);
      }
      continue;
    }

    // --- Cooldown ---
    if (guest.visitTimeLeft < 0) {
      guest.visitTimeLeft += deltaProgress;
      continue;
    }

    // --- Idle: check needs priority ---
    const segDef = GUEST_SEGMENT_DEFS[guest.segment];

    // Urgent needs override beach: toilet, hunger, thirst at critical levels take absolute priority
    const hasUrgentNeed = guest.needs.toilet >= 70 || guest.needs.hunger >= 85 || guest.needs.thirst >= 85;

    // Beach activity: if beach need is high and hasn't visited beach today, go to beach
    // BUT NOT if there's an urgent bodily need, and NOT during storm/rain!
    const badWeatherForBeach = state.weather.current === 'storm' || state.weather.current === 'rain';
    // Thought: wanted to go to beach but weather is bad
    if (badWeatherForBeach && guest.needs.beach >= NEED_THRESHOLD && !guest.thoughts.some(t => t.text.includes('weather') && t.text.includes('beach') && t.day === state.day)) {
      if (state.weather.current === 'storm') {
        addThought(guest, 'Want to go to the beach but this storm is insane...', 'negative', state.day, state.dayProgress, 'fun');
      } else {
        addThought(guest, 'Wanted to go to the beach but the weather is bad...', 'neutral', state.day, state.dayProgress);
      }
    }
    if (!hasUrgentNeed && !badWeatherForBeach && guest.needs.beach >= NEED_THRESHOLD && (guest.visitCounts['beach'] ?? 0) < 2) {
      // Find a beach_sand tile with capacity (max 2 guests per tile)
      const beachTiles: Array<{ x: number; y: number }> = [];
      for (let by = 0; by < state.grid.height; by++) {
        for (let bx = 0; bx < state.grid.width; bx++) {
          if (state.grid.tiles[by]?.[bx]?.type === 'beach_sand') {
            beachTiles.push({ x: bx, y: by });
          }
        }
      }
      if (beachTiles.length > 0) {
        // Count guests per beach tile
        const beachOccupancy = new Map<string, number>();
        for (const g of guests) {
          if (g.beachTile) {
            const k = `${g.beachTile.x},${g.beachTile.y}`;
            beachOccupancy.set(k, (beachOccupancy.get(k) ?? 0) + 1);
          }
        }
        // Filter to tiles with < 2 guests
        const available = beachTiles.filter(t => (beachOccupancy.get(`${t.x},${t.y}`) ?? 0) < 2);
        const pool = available.length > 0 ? available : beachTiles;
        const idx = Math.floor(seededRandom(guest.id * 19 + state.day * 7) * pool.length);
        guest.beachTile = pool[idx];
      }

      guest.needs.beach = Math.max(0, guest.needs.beach - 40);
      guest.needs.relaxation = Math.max(0, guest.needs.relaxation - 15);
      guest.needs.fun = Math.max(0, guest.needs.fun - 10);
      guest.visitCounts['beach'] = (guest.visitCounts['beach'] ?? 0) + 1;
      guest.happiness = Math.min(100, guest.happiness + 3);
      guest.currentVisiting = -1; // Special marker: visiting beach
      guest.visitTimeLeft = VISIT_DURATION * 2 + seededRandom(guest.id * 13) * 0.08;

      // Thought: heading to beach
      if (!hasAnyPaths) {
        addThought(guest, 'Had to walk through sand to get to the beach — no paths!', 'negative', state.day, state.dayProgress, 'beauty');
      } else if ((guest.visitCounts['beach'] ?? 0) <= 1) {
        addThought(guest, 'Time for the beach! ☀️', 'positive', state.day, state.dayProgress);
      }
      continue;
    }

    // Stroll satisfaction: idle guests on paths slowly satisfy stroll need (FREE)
    if (hasAnyPaths && guest.needs.stroll > 10) {
      const strollBefore = guest.needs.stroll;
      guest.needs.stroll = Math.max(0, guest.needs.stroll - 8 * deltaProgress);
      if (guest.needs.stroll < 20) {
        guest.happiness = Math.min(100, guest.happiness + 0.5 * deltaProgress);
      }
      // Thought: stroll enjoyment (throttled — only when crossing the satisfaction threshold)
      if (strollBefore >= 30 && guest.needs.stroll < 30) {
        addThought(guest, 'Lovely stroll along the paths', 'positive', state.day, state.dayProgress, 'beauty');
      }
    } else if (!hasAnyPaths && guest.needs.stroll >= 80) {
      // No paths at all and stroll need is very high
      if (!guest.thoughts.some(t => t.day === state.day && t.text.includes('no walkways'))) {
        addThought(guest, 'There are no walkways to stroll on...', 'negative', state.day, state.dayProgress, 'beauty');
      }
    }

    // --- Find building for other needs ---
    // Separate needs into: actionable (can still visit) vs visited-out (hit daily limit)
    const actionableNeeds: NeedType[] = [];
    const visitedOutNeeds: NeedType[] = [];
    for (const n of needKeys) {
      if (n === 'accommodation' || n === 'beach' || n === 'stroll') continue;
      if (guest.needs[n] < NEED_THRESHOLD) continue;
      if ((guest.visitCounts[n] ?? 0) >= segDef.maxVisitsPerCategory) {
        visitedOutNeeds.push(n);
      } else {
        actionableNeeds.push(n);
      }
    }

    // Generate "been there, done that" thoughts for visited-out needs
    if (visitedOutNeeds.length > 0) {
      const repMap: Record<string, ReputationComponent> = {
        hunger: 'foodQuality', thirst: 'foodQuality',
        fun: 'fun', relaxation: 'fun', toilet: 'cleanliness',
      };
      for (const need of visitedOutNeeds) {
        const val = guest.needs[need];
        if (val < 70) continue;
        // Already generated a "variety" thought for this need today? Skip
        if (guest.thoughts.some(t => t.day === state.day && t.text.includes('wish there was more') && t.repComponent === repMap[need])) continue;
        if (guest.thoughts.some(t => t.day === state.day && t.text.includes('already tried') && t.repComponent === repMap[need])) continue;

        // What buildings for this need exist on the map?
        const builtForNeed = buildings.filter(b => getBuildingDef(b.type).satisfiesNeed === need && !b.isConstructing);
        const builtNames = [...new Set(builtForNeed.map(b => getBuildingDef(b.type).name))];

        // What COULD be built but isn't? (suggest alternatives)
        const allTypesForNeed = ALL_BUILDING_TYPES.filter(t => BUILDING_DEFS[t].satisfiesNeed === need);
        const builtTypes = new Set(builtForNeed.map(b => b.type));
        const unbuiltNames = allTypesForNeed
          .filter(t => !builtTypes.has(t))
          .map(t => BUILDING_DEFS[t].name)
          .slice(0, 3); // show max 3 suggestions

        let msg: string;
        if (builtNames.length === 0) {
          continue; // no buildings at all — will be caught by unsatisfiedReasons below
        } else if (builtNames.length === 1) {
          msg = unbuiltNames.length > 0
            ? `Already tried the ${builtNames[0]} — wish there was more variety! Maybe ${unbuiltNames.join(' or ')}?`
            : `Already visited the ${builtNames[0]} today — wish there was more to do`;
        } else {
          msg = unbuiltNames.length > 0
            ? `Already tried ${builtNames.join(', ')} — want something new! How about ${unbuiltNames.slice(0, 2).join(' or ')}?`
            : `Already tried ${builtNames.join(', ')} — done everything, getting bored`;
        }
        const mood = val >= 90 ? 'negative' as const : 'neutral' as const;
        addThought(guest, msg, mood, state.day, state.dayProgress, repMap[need]);
      }
    }

    const unmetNeeds = actionableNeeds.sort((a, b) => guest.needs[b] - guest.needs[a]);

    if (unmetNeeds.length === 0) continue;

    let found = false;
    type UnsatisfiedReason = 'none' | 'unpowered' | 'damaged' | 'constructing' | 'unreachable' | 'full' | 'expensive' | 'no_money';
    const unsatisfiedReasons: Array<{ need: NeedType; reason: UnsatisfiedReason; details?: string }> = [];
    for (const need of unmetNeeds) {
      // Step 1: Does ANY building for this need exist at all (even broken/unpowered)?
      const allForNeed = buildings.filter(b => getBuildingDef(b.type).satisfiesNeed === need);
      const anyPlaced = allForNeed.length > 0;
      const anyOperational = allForNeed.some(b => isOperational(b, state.staff));

      const candidates = buildings.filter(b => {
        if (!isOperational(b, state.staff)) return false;
        const def = getBuildingDef(b.type);
        if (def.satisfiesNeed !== need) return false;
        const cap = getEffectiveCapacity(b.type, b.level, b);
        if (cap <= 0) return false;

        // Path connectivity: building must be reachable from entrance (if paths exist)
        if (reachable && !Grid.isBuildingReachable(state.grid, b, reachable)) return false;

        const guestPkg = getGuestPackage(guest, buildings);
        const included = isServiceIncluded(guestPkg, def.category);
        // Free buildings (toilet, shower, etc.) are always accessible
        const isFreeBuilding = def.incomePerVisit === 0;
        if (!included && !isFreeBuilding) {
          if (guest.dailySpendRemaining <= 0) return false;
          if (hasCompetitor && b.priceMultiplier > 1.0) return false;
          const priceThreshold = 1.6 + (1 - guest.effectivePriceSensitivity) * 0.4;
          if (b.priceMultiplier > priceThreshold && seededRandom(guest.id * 11 + state.dayProgress * 50) < guest.effectivePriceSensitivity * 0.5) return false;
        }

        return countVisitors(guests, b.id) < cap;
      });

      if (candidates.length > 0) {
        if (!found) {
          // Sort by path distance (nearest first) with small random factor
          if (reachable) {
            candidates.sort((a, b) => {
              const da = Grid.getBuildingDistance(a, reachable) + seededRandom(guest.id * 7 + a.id) * 3;
              const db = Grid.getBuildingDistance(b, reachable) + seededRandom(guest.id * 7 + b.id) * 3;
              return da - db;
            });
          }
          const pick = candidates[0];
          guest.currentVisiting = pick.id;
          guest.visitTimeLeft = VISIT_DURATION + seededRandom(guest.id * 3 + state.day) * 0.06;
          pick.currentGuests++;
          found = true;
        }
      } else if (!anyPlaced) {
        // No building of this type exists at all — suggest what to build
        const suggestions = ALL_BUILDING_TYPES
          .filter(t => BUILDING_DEFS[t].satisfiesNeed === need)
          .map(t => BUILDING_DEFS[t].name)
          .slice(0, 3);
        unsatisfiedReasons.push({ need, reason: 'none', details: suggestions.join(', ') });
      } else if (!anyOperational) {
        // Building exists but ALL are broken/unpowered/constructing/understaffed
        const names = [...new Set(allForNeed.map(b => getBuildingDef(b.type).name))];
        const hasUnpowered = allForNeed.some(b => !b.isConstructing && !b.damaged && !b.powered);
        const hasDamaged = allForNeed.some(b => b.damaged);
        const hasConstructing = allForNeed.some(b => b.isConstructing);
        const needsStaff = allForNeed.some(b => {
          const d = getBuildingDef(b.type);
          return d.requiresStaff && !b.isConstructing && b.powered && !b.damaged;
        });
        if (needsStaff) {
          const staffBuilding = allForNeed.find(b => getBuildingDef(b.type).requiresStaff);
          const staffRole = staffBuilding ? getBuildingDef(staffBuilding.type).requiresStaff : 'staff';
          unsatisfiedReasons.push({ need, reason: 'unpowered', details: `${names.join(', ')} (needs ${staffRole})` });
        } else if (hasUnpowered) unsatisfiedReasons.push({ need, reason: 'unpowered', details: names.join(', ') });
        else if (hasDamaged) unsatisfiedReasons.push({ need, reason: 'damaged', details: names.join(', ') });
        else if (hasConstructing) unsatisfiedReasons.push({ need, reason: 'constructing', details: names.join(', ') });
        else unsatisfiedReasons.push({ need, reason: 'none' });
      } else {
        // Building is operational but can't use it — figure out exactly why
        const operationalForNeed = allForNeed.filter(b => isOperational(b, state.staff));
        const opNames = [...new Set(operationalForNeed.map(b => getBuildingDef(b.type).name))];
        const anyReachable = !reachable || operationalForNeed.some(b => Grid.isBuildingReachable(state.grid, b, reachable));
        if (!anyReachable) {
          unsatisfiedReasons.push({ need, reason: 'unreachable', details: opNames.join(', ') });
        } else {
          // Check specific sub-reasons: no money, too expensive, or actually at capacity
          const guestPkg = getGuestPackage(guest, buildings);
          const reachableOps = operationalForNeed.filter(b => !reachable || Grid.isBuildingReachable(state.grid, b, reachable));
          const noMoneyForAny = reachableOps.every(b => {
            const def = getBuildingDef(b.type);
            const included = isServiceIncluded(guestPkg, def.category);
            const isFree = def.incomePerVisit === 0;
            return !included && !isFree && guest.dailySpendRemaining <= 0;
          });
          const tooExpensive = !noMoneyForAny && reachableOps.every(b => b.priceMultiplier > 1.4);
          const actuallyFull = reachableOps.every(b => {
            const cap = getEffectiveCapacity(b.type, b.level, b);
            return countVisitors(guests, b.id) >= cap;
          });

          if (noMoneyForAny) {
            unsatisfiedReasons.push({ need, reason: 'no_money', details: opNames.join(', ') });
          } else if (tooExpensive) {
            unsatisfiedReasons.push({ need, reason: 'expensive', details: opNames.join(', ') });
          } else if (actuallyFull) {
            // Show actual occupancy
            const fullInfo = reachableOps.map(b => {
              const cap = getEffectiveCapacity(b.type, b.level, b);
              const vis = countVisitors(guests, b.id);
              return `${getBuildingDef(b.type).name} (${vis}/${cap})`;
            });
            unsatisfiedReasons.push({ need, reason: 'full', details: fullInfo.join(', ') });
          } else {
            // Catch-all: something else blocked it (competitor event, price sensitivity, etc.)
            unsatisfiedReasons.push({ need, reason: 'full', details: opNames.join(', ') });
          }
        }
      }
    }

    // Generate thoughts based on specific reasons — gives player actionable feedback
    if (unsatisfiedReasons.length > 0) {
      if (!found) {
        guest.happiness = Math.max(0, guest.happiness - deltaProgress * 15);
      }
      const repMap: Record<string, ReputationComponent> = {
        hunger: 'foodQuality', thirst: 'foodQuality',
        fun: 'fun', relaxation: 'fun', toilet: 'cleanliness',
      };
      for (const { need, reason, details } of unsatisfiedReasons) {
        const val = guest.needs[need];
        const hadPositiveToday = guest.thoughts.some(t =>
          t.day === state.day && t.mood === 'positive' && t.repComponent === repMap[need]
        );
        const alreadyComplained = (text: string) => guest.thoughts.some(t => t.day === state.day && t.text === text);

        if (reason === 'none') {
          // No building at all — suggest what to build!
          const suggestion = details ? ` Build a ${details}!` : '';
          const msg70: Record<string, string> = {
            hunger: `Starving but nowhere to eat!${suggestion}`,
            thirst: `So thirsty but no drink spots...${suggestion}`,
            fun: `Nothing fun to do here!${suggestion}`,
            relaxation: `Need to relax but nowhere to go...${suggestion}`,
            toilet: `Where are the toilets?! None here!${suggestion}`,
          };
          const msg90: Record<string, string> = {
            hunger: `STARVING! Not a single restaurant!${suggestion}`,
            thirst: `Dying of thirst! No drinks!${suggestion}`,
            fun: `SO BORED! Zero entertainment!${suggestion}`,
            relaxation: `Can't relax at all — nothing to unwind!${suggestion}`,
            toilet: `No toilets?! Unacceptable!${suggestion}`,
          };
          if (val >= 90 && !alreadyComplained(msg90[need] ?? '')) {
            addThought(guest, msg90[need] ?? `Desperately need ${need}!${suggestion}`, 'negative', state.day, state.dayProgress, repMap[need]);
          } else if (val >= 70 && !hadPositiveToday && !alreadyComplained(msg70[need] ?? '')) {
            addThought(guest, msg70[need] ?? `Need ${need}!${suggestion}`, 'negative', state.day, state.dayProgress, repMap[need]);
          }
        } else if (reason === 'unpowered') {
          const msg = `${details || 'Building'} has no power! Need more generators`;
          if (val >= 60 && !alreadyComplained(msg)) {
            addThought(guest, msg, 'negative', state.day, state.dayProgress, repMap[need]);
          }
        } else if (reason === 'damaged') {
          const msg = `${details || 'Building'} is damaged — closed for repairs`;
          if (val >= 60 && !alreadyComplained(msg)) {
            addThought(guest, msg, 'negative', state.day, state.dayProgress, 'safety');
          }
        } else if (reason === 'constructing') {
          const msg = `${details || 'Building'} is still under construction`;
          if (val >= 60 && !alreadyComplained(msg)) {
            addThought(guest, msg, 'neutral', state.day, state.dayProgress);
          }
        } else if (reason === 'unreachable') {
          const msg = `Can see ${details || 'the building'} but can't reach it — no path!`;
          if (val >= 60 && !alreadyComplained(msg)) {
            addThought(guest, msg, 'negative', state.day, state.dayProgress, 'beauty');
          }
        } else if (reason === 'no_money') {
          const msg = `Want to visit ${details || 'something'} but my daily spending budget is used up. Upgrade package to include more!`;
          if (val >= 70 && !alreadyComplained(msg)) {
            addThought(guest, msg, 'negative', state.day, state.dayProgress, 'value');
          }
        } else if (reason === 'expensive') {
          const msg = `${details || 'Everything'} is overpriced! Not paying that much`;
          if (val >= 75 && !hadPositiveToday && !alreadyComplained(msg)) {
            addThought(guest, msg, 'negative', state.day, state.dayProgress, 'value');
          }
        } else {
          // 'full' — building at capacity, show occupancy
          const msg = `${details || 'Everything'} is packed right now — no free spots`;
          if (val >= 80 && !hadPositiveToday && !alreadyComplained(msg)) {
            addThought(guest, msg, 'neutral', state.day, state.dayProgress);
          }
        }
      }
    }
  }

  // Passive happiness decay (reduced by concierge and experience buildings)
  const hasConcierge = buildings.some(b => b.type === 'concierge' && isOperational(b, state.staff));
  const conciergeDecayReduction = hasConcierge ? 0.15 : 0;
  // Global happiness decay reduction from all operational experience buildings
  let globalDecayReduction = conciergeDecayReduction;
  for (const b of buildings) {
    if (!isOperational(b, state.staff)) continue;
    const def = getBuildingDef(b.type);
    if (def.happinessDecayReduction > 0) {
      globalDecayReduction += def.happinessDecayReduction * 0.3;
    }
  }
  globalDecayReduction = Math.min(globalDecayReduction, 0.6);

  for (const guest of guests) {
    const unmetCount = needKeys.filter(n => n !== 'accommodation' && guest.needs[n] >= 60).length;
    const decayRate = 2 + unmetCount * 3;
    const effectiveDecay = decayRate * (1 - globalDecayReduction);
    guest.happiness = Math.max(0, guest.happiness - effectiveDecay * deltaProgress);
  }

  // Concierge recovery mechanic: unhappy guests get a chance to recover
  if (hasConcierge) {
    for (const guest of guests) {
      if (guest.happiness < 40 && Math.random() < 0.20 * deltaProgress) {
        guest.happiness = Math.min(100, guest.happiness + 5);
        addThought(guest, 'The concierge sorted everything out!', 'positive', state.day, state.dayProgress, 'value');
        impactLog.push({ day: state.day, category: 'happiness', label: `Concierge recovered unhappy ${guest.segment} guest`, delta: 5 });
      }
    }
  }

  // Weather happiness drain
  const weatherMod = getWeatherHappinessModifier(state.weather.current);
  if (weatherMod !== 0) {
    for (const guest of guests) {
      guest.happiness = Math.max(0, Math.min(100, guest.happiness + weatherMod * deltaProgress));
    }
  }
  // Weather thought (throttled: once per storm/rain cycle)
  if (state.weather.current === 'storm' && Math.floor(state.dayProgress * 10) === 2) {
    for (const guest of guests) {
      if (!guest.thoughts.some(t => t.text.includes('storm') && t.day === state.day)) {
        addThought(guest, 'This storm is terrible...', 'negative', state.day, state.dayProgress);
      }
    }
  }

  // Litter: merge new litter, then process cleaner removal
  let updatedLitter: LitterState = {
    items: [...state.litter.items, ...newLitterItems],
    nextId: litterNextId,
  };
  updatedLitter = processLitterCleaning(updatedLitter, state.staff.cleaners, buildings, deltaProgress);

  // Litter happiness penalty: guests near litter lose happiness
  if (updatedLitter.items.length > 0) {
    const litterDensity = updatedLitter.items.length;
    // Light penalty scales with total litter (more litter = everyone notices)
    const globalPenalty = Math.min(5, litterDensity * 0.05) * deltaProgress;
    if (globalPenalty > 0.01) {
      for (const g of guests) {
        g.happiness = Math.max(0, g.happiness - globalPenalty);
      }
    }
  }

  return { ...state, guests, buildings, money, pendingAncillary: ancillaryRevenue, impactLog, litter: updatedLitter };
}

// ── Storm Damage ─────────────────────────────────────────────────────

function applyStormDamage(buildings: Building[]): Building[] {
  const operational = buildings.filter(b => !b.isConstructing && !b.damaged);
  if (operational.length === 0 || Math.random() > 0.35) return buildings;
  const victim = operational[Math.floor(Math.random() * operational.length)];
  return buildings.map(b => b.id === victim.id ? { ...b, damaged: true } : b);
}

// ── Day Boundary ─────────────────────────────────────────────────────

function processDayEnd(state: GameState): GameState {
  let s = { ...state };
  const dayLog: ImpactLogItem[] = [];

  // 1. Weather
  s.weather = advanceWeather(s.weather);

  // 2. Storm damage (skip first 10 days — beginner shield)
  let updatedBuildings = s.buildings.map(b => ({ ...b, packages: b.packages.map(p => ({ ...p })), offerings: b.offerings.map(o => ({ ...o })) }));
  if (s.day >= 10 && s.weather.current === 'storm') {
    const before = updatedBuildings.filter(b => b.damaged).length;
    updatedBuildings = applyStormDamage(updatedBuildings);
    const after = updatedBuildings.filter(b => b.damaged).length;
    if (after > before) {
      dayLog.push({ day: s.day, category: 'reputation', label: 'Storm damage', delta: -2, causeId: 'weather_storm', repComponent: 'safety' });
    }
  }

  // 3. Clear visits and reset daily trackers
  const existingGuests = s.guests.map(g => {
    if (g.currentVisiting !== null) {
      const bldg = updatedBuildings.find(b => b.id === g.currentVisiting);
      if (bldg) bldg.currentGuests = Math.max(0, bldg.currentGuests - 1);
    }
    const segDef = GUEST_SEGMENT_DEFS[g.segment];
    return { ...g, needs: { ...g.needs }, currentVisiting: null, visitTimeLeft: 0, visitCounts: {}, dailySpendRemaining: segDef.spendPerDay, todayStayBonusAccum: 0, todayPackageUpgradeAccum: 0 };
  });

  updatePowerState(updatedBuildings);

  // 4. Process delayed story effects
  let storyState = { ...s.stories, pendingDelayed: [...s.stories.pendingDelayed], pendingOutcomes: [...(s.stories.pendingOutcomes || [])] };
  for (const pending of storyState.pendingDelayed) {
    if (pending.triggerDay <= s.day) {
      dayLog.push(pending.log);
    }
  }
  storyState.pendingDelayed = storyState.pendingDelayed.filter(p => p.triggerDay > s.day);

  // 5. Events
  let events = s.events
    .map(e => ({ ...e, daysRemaining: e.daysRemaining - 1 }))
    .filter(e => e.daysRemaining >= 0);

  let evtLog = [...s.eventLog];
  let nextEventDay = s.nextEventDay;

  const newEvent = generateRandomEvent(s);
  if (newEvent) {
    events.push(newEvent);
    evtLog = [newEvent, ...evtLog].slice(0, 10);
    nextEventDay = s.day + 3 + Math.floor(Math.random() * 4);
  }

  let eventState: GameState = { ...s, events, eventLog: evtLog, nextEventDay, buildings: updatedBuildings, guests: existingGuests };
  if (newEvent) {
    eventState = applyEventEffect(eventState, newEvent);
    updatedBuildings = eventState.buildings.map(b => ({ ...b, packages: b.packages.map(p => ({ ...p })), offerings: b.offerings.map(o => ({ ...o })) }));
    dayLog.push({ day: s.day, category: 'demand', label: newEvent.title, delta: 0, causeId: `event_${newEvent.type}` });
  }
  const guestsAfterEvents = eventState.guests;

  // 6. Active event flags
  const hasFestival = events.some(e => e.type === 'festival' && e.daysRemaining >= 0);
  const hasHeatwave = events.some(e => e.type === 'heatwave' && e.daysRemaining >= 0);
  const hasViralBacklash = events.some(e => e.type === 'viral_backlash' && e.daysRemaining >= 0);

  // 7. Calculate reputation breakdown and overall (drifts slowly)
  const tempStateForRep = { ...eventState, buildings: updatedBuildings, guests: guestsAfterEvents };
  const newBreakdown = calculateReputationBreakdown(tempStateForRep);
  const targetReputation = calculateReputation({ ...tempStateForRep, reputationBreakdown: newBreakdown });
  const currentRep = s.reputation;
  let newReputation = Math.round(currentRep + (targetReputation - currentRep) * 0.3);

  // 7b. Litter day log
  const dailyLitterCount = s.litter ? s.litter.items.length : 0;
  if (dailyLitterCount > 20) {
    dayLog.push({ day: s.day, category: 'reputation', label: `Litter problem (${dailyLitterCount} items)`, delta: -Math.min(5, Math.floor(dailyLitterCount / 10)), causeId: 'litter_problem', repComponent: 'cleanliness' });
  } else if (dailyLitterCount === 0 && s.guests.length > 5) {
    dayLog.push({ day: s.day, category: 'reputation', label: 'Resort is spotless!', delta: 1, causeId: 'litter_clean', repComponent: 'cleanliness' });
  }

  // 8. Social Heat decay
  let socialHeat = Math.max(0, s.socialHeat - 3);
  if (hasFestival) socialHeat = Math.min(100, socialHeat + 10);
  if (newReputation > 60) socialHeat = Math.min(100, socialHeat + 1);

  // Check path availability for arrival thoughts
  const hasAnyPaths = s.grid.tiles.some(row => row.some(t => t.type === 'path'));

  // 9. Spawn lodging guests (reputation-gated + marketing bonus)
  const reputationNorm = newReputation / 100;
  let baseRate = Math.max(0, Math.floor(reputationNorm * 5 - 0.2));
  if (hasFestival) baseRate *= 2;
  if (hasHeatwave) baseRate = Math.floor(baseRate * 1.3);
  if (hasViralBacklash) baseRate = Math.floor(baseRate * 0.5);
  const weatherMod = getWeatherArrivalModifier(s.weather.current);
  const accomCap = updatedBuildings
    .filter(b => isOperational(b) && getBuildingDef(b.type).satisfiesNeed === 'accommodation')
    .reduce((sum, b) => sum + getEffectiveCapacity(b.type, b.level, b), 0);
  const currentAccom = guestsAfterEvents.filter(g => g.assignedAccommodation !== null).length;
  const freeSlots = Math.max(0, accomCap - currentAccom);
  const hasAccommodation = accomCap > 0;

  // Marketing bonus: active campaigns add extra guests (daily roll within effectiveness range)
  let marketingBonus = 0;
  for (const c of s.marketing) {
    const def = getCampaignDef(c.campaignId);
    if (!def) continue;
    const range = def.effectivenessRange;
    let effectiveMult = 1.0;
    if (range) {
      effectiveMult = range.min + Math.random() * (range.max - range.min);
    }
    const dailyBonus = Math.round(def.guestBonus * effectiveMult);
    marketingBonus += dailyBonus;
    if (range) {
      dayLog.push({ day: s.day, category: 'demand', label: `${def.name}: ${dailyBonus > 0 ? '+' + dailyBonus : dailyBonus} guest${dailyBonus !== 1 ? 's' : ''} (${Math.round(effectiveMult * 100)}% effectiveness)`, delta: dailyBonus, causeId: `marketing_${def.id}` });
    }
  }

  // Social Heat bonus: high visibility attracts extra guests
  const heatBonus = socialHeat > 30 ? Math.floor((socialHeat - 30) / 20) : 0;

  // Guaranteed minimum: at least 1 guest/day if accommodation exists and weather permits
  let rawArrivals = Math.floor(baseRate * weatherMod) + marketingBonus + heatBonus;
  if (hasAccommodation && freeSlots > 0 && weatherMod > 0 && rawArrivals < 1) {
    rawArrivals = 1;
  }
  const arrivals = Math.min(rawArrivals, freeSlots);

  let nextGuestId = eventState.nextGuestId;
  const newGuests: Guest[] = [];

  for (let i = 0; i < arrivals; i++) {
    const segment = pickSegment(reputationNorm, hasAccommodation, false, eventState);
    if (segment === 'local') continue;

    const accomBuildings = updatedBuildings.filter(b =>
      isOperational(b) && getBuildingDef(b.type).satisfiesNeed === 'accommodation'
      && b.currentGuests < getEffectiveCapacity(b.type, b.level, b)
    );

    if (accomBuildings.length === 0) break;

    let booked = false;
    for (const accom of accomBuildings) {
      const pkgId = pickPackageForGuest(segment, accom, updatedBuildings);
      if (pkgId) {
        const guest = createGuest(nextGuestId++, s.day + 1, segment, pkgId);
        guest.assignedAccommodation = accom.id;
        accom.currentGuests++;

        // Nomad stay extension: coworking space extends nomad stays
        if (segment === 'nomad') {
          const hasCoworking = updatedBuildings.some(bl => bl.type === 'coworking' && isOperational(bl, s.staff));
          if (hasCoworking) {
            const extraDays = 3 + Math.floor(Math.random() * 4); // +3-6 days
            guest.stayDuration += extraDays;
            guest.originalStayDuration = guest.stayDuration;
            addThought(guest, 'Coworking space here — I can stay and work!', 'positive', s.day + 1, 0);
          }
        }

        // Arrival thought
        const accomDef = getBuildingDef(accom.type);
        addThought(guest, `Just arrived! Checked into ${accomDef.name}. Let's see what this resort has to offer`, 'neutral', s.day + 1, 0);
        if (hasAnyPaths) {
          addThought(guest, 'Nice walkways around the resort', 'positive', s.day + 1, 0, 'beauty');
        }
        newGuests.push(guest);
        booked = true;
        break;
      }
    }
    if (!booked) continue;
  }

  // 10. Spawn local day-pass guests
  if (s.dayPassEnabled) {
    const localRate = Math.floor(reputationNorm * 4 * weatherMod);
    for (let i = 0; i < localRate; i++) {
      const localGuest = createGuest(nextGuestId++, s.day + 1, 'local', null);
      addThought(localGuest, 'Day trip to the resort! Hoping for a good time', 'neutral', s.day + 1, 0);
      newGuests.push(localGuest);
    }
  }

  const allGuests = [...guestsAfterEvents, ...newGuests];

  // 10.4 Event Space programming effects
  let eventProgramCost = 0;
  for (const b of updatedBuildings) {
    if (b.type !== 'event_space' || !b.activeEventProgram || !isOperational(b, s.staff)) continue;
    const prog = EVENT_PROGRAMS[b.activeEventProgram];
    if (!prog) continue;
    eventProgramCost += prog.costPerDay;
    // Apply segment happiness effects to all guests
    for (const g of allGuests) {
      const segEffect = prog.segmentEffects[g.segment] ?? 0;
      if (segEffect !== 0) {
        g.happiness = Math.max(0, Math.min(100, g.happiness + segEffect * 0.3));
      }
    }
    // Noise penalty: families/VIP near event space lose extra happiness
    if (prog.noisePenalty > 0) {
      for (const g of allGuests) {
        if (g.segment === 'family' || g.segment === 'vip') {
          g.happiness = Math.max(0, g.happiness - prog.noisePenalty * 0.5);
        }
      }
    }
    dayLog.push({ day: s.day, category: 'happiness', label: `Event: ${prog.name}`, delta: prog.happinessBonus, causeId: `event_${prog.type}` });
    if (prog.costPerDay > 0) {
      dayLog.push({ day: s.day, category: 'money', label: `Event cost: ${prog.name}`, delta: -prog.costPerDay, causeId: `event_cost_${prog.type}` });
    }
  }

  // 10.4b Event Space noise & safety trade-offs (evening phase: nightlife programs generate noise)
  const nightlifeNoiseBuildings = updatedBuildings.filter(b =>
    b.type === 'event_space' && b.activeEventProgram && isOperational(b, s.staff)
  );
  if (nightlifeNoiseBuildings.length > 0) {
    const noisyCount = nightlifeNoiseBuildings.length;
    let disturbedFamilies = 0;
    let disturbedVIPs = 0;
    for (const g of allGuests) {
      if (g.segment === 'family') {
        // Families near nightlife buildings lose happiness
        if (g.assignedAccommodation !== null) {
          const accom = updatedBuildings.find(bl => bl.id === g.assignedAccommodation);
          if (accom) {
            const isNearNightlife = nightlifeNoiseBuildings.some(nb => {
              const dx = Math.abs((accom.x + accom.width / 2) - (nb.x + nb.width / 2));
              const dy = Math.abs((accom.y + accom.height / 2) - (nb.y + nb.height / 2));
              return dx <= 4 && dy <= 4;
            });
            if (isNearNightlife) {
              g.happiness = Math.max(0, g.happiness - noisyCount * 2);
              disturbedFamilies++;
            }
          }
        }
      } else if (g.segment === 'vip') {
        if (g.assignedAccommodation !== null) {
          const accom = updatedBuildings.find(bl => bl.id === g.assignedAccommodation);
          if (accom) {
            const isNearNightlife = nightlifeNoiseBuildings.some(nb => {
              const dx = Math.abs((accom.x + accom.width / 2) - (nb.x + nb.width / 2));
              const dy = Math.abs((accom.y + accom.height / 2) - (nb.y + nb.height / 2));
              return dx <= 3 && dy <= 3;
            });
            if (isNearNightlife) {
              g.happiness = Math.max(0, g.happiness - noisyCount * 1.5);
              disturbedVIPs++;
            }
          }
        }
      }
    }
    if (disturbedFamilies > 0 || disturbedVIPs > 0) {
      dayLog.push({ day: s.day, category: 'happiness', label: `Nightlife noise disturbed ${disturbedFamilies + disturbedVIPs} guest(s)`, delta: -(disturbedFamilies + disturbedVIPs), causeId: 'nightlife_noise' });
    }
  }

  // 10.5 Economy overhaul: Stay Bonus & Package Upgrade processing
  const MAX_STAY_BONUS = 2;
  let stayExtensionCount = 0;
  let packageUpgradeCount = 0;
  for (const g of allGuests) {
    if (g.segment === 'local') continue;

    // Stay Bonus: accumulated from experience buildings visited today
    if (g.todayStayBonusAccum > 0 && g.stayBonusApplied < MAX_STAY_BONUS && g.stayDuration <= 2) {
      const chance = Math.min(g.todayStayBonusAccum, 0.8);
      if (Math.random() < chance) {
        g.stayDuration += 1;
        g.stayBonusApplied += 1;
        stayExtensionCount++;
        addThought(g, 'Having such a great time — extending my stay!', 'positive', s.day, 1.0, 'value');
        dayLog.push({ day: s.day, category: 'stay_extension', label: `${GUEST_SEGMENT_DEFS[g.segment].label} extended stay`, delta: 1, causeId: 'stay_bonus', relatedEntityId: g.id });
      }
    }

    // Package Upgrade: accumulated from experience buildings
    if (g.todayPackageUpgradeAccum > 0 && !g.packageUpgraded && g.packageId && g.assignedAccommodation !== null) {
      const upgChance = Math.min(g.todayPackageUpgradeAccum, 0.5);
      if (Math.random() < upgChance) {
        const accBldg = updatedBuildings.find(b => b.id === g.assignedAccommodation);
        if (accBldg) {
          const sortedPkgs = accBldg.packages
            .filter(p => p.enabled && p.unlockLevel <= accBldg.level)
            .sort((a, b) => a.pricePerNight - b.pricePerNight);
          const currentIdx = sortedPkgs.findIndex(p => p.id === g.packageId);
          if (currentIdx >= 0 && currentIdx < sortedPkgs.length - 1) {
            const nextPkg = sortedPkgs[currentIdx + 1];
            g.packageId = nextPkg.id;
            g.packageUpgraded = true;
            packageUpgradeCount++;
            addThought(g, `Upgraded to ${nextPkg.name} — this place is worth it!`, 'positive', s.day, 1.0, 'value');
            dayLog.push({ day: s.day, category: 'package_upgrade', label: `${GUEST_SEGMENT_DEFS[g.segment].label} upgraded to ${nextPkg.name}`, delta: nextPkg.pricePerNight, causeId: 'package_upgrade', relatedEntityId: g.id });
          }
        }
      }
    }
  }
  if (stayExtensionCount > 0) {
    dayLog.push({ day: s.day, category: 'stay_extension', label: `${stayExtensionCount} guest(s) extended their stay`, delta: stayExtensionCount, causeId: 'stay_bonus_summary' });
  }
  if (packageUpgradeCount > 0) {
    dayLog.push({ day: s.day, category: 'package_upgrade', label: `${packageUpgradeCount} guest(s) upgraded their package`, delta: packageUpgradeCount, causeId: 'package_upgrade_summary' });
  }

  // 11. Departures
  for (const g of allGuests) {
    g.stayDuration = Math.max(0, g.stayDuration - 1);
  }

  const departing = allGuests.filter(g => g.stayDuration <= 0 || g.happiness <= 25 || g.money <= 0);
  const remaining = allGuests.filter(g => g.stayDuration > 0 && g.happiness > 25 && g.money > 0);

  const departureStats: DepartureStats = { segmentCounts: {}, happyVipDeparted: false };
  for (const guest of departing) {
    departureStats.segmentCounts[guest.segment] = (departureStats.segmentCounts[guest.segment] ?? 0) + 1;
    if (guest.segment === 'vip' && guest.happiness >= 80) {
      departureStats.happyVipDeparted = true;
      socialHeat = Math.min(100, socialHeat + 5);
    }

    // Departure thoughts — enriched with stay/package info
    const extendedStay = guest.stayBonusApplied > 0;
    const upgradedPkg = guest.packageUpgraded;
    if (guest.happiness >= 70) {
      if (extendedStay && upgradedPkg) {
        addThought(guest, 'Amazing resort! Extended my stay AND upgraded my package — worth every penny!', 'positive', s.day, 1.0, 'value');
      } else if (extendedStay) {
        addThought(guest, `Stayed ${guest.stayBonusApplied} extra day(s) — that's how good it was!`, 'positive', s.day, 1.0, 'value');
      } else if (upgradedPkg) {
        addThought(guest, 'Great stay! Glad I upgraded my package midway through', 'positive', s.day, 1.0, 'value');
      } else {
        addThought(guest, 'Great stay, will definitely recommend this resort!', 'positive', s.day, 1.0, 'value');
      }
    } else if (guest.happiness >= 40) {
      addThought(guest, 'It was okay, but could be better...', 'neutral', s.day, 1.0);
    } else {
      addThought(guest, "Won't be coming back... terrible experience", 'negative', s.day, 1.0, 'value');
    }

    if (guest.isVIP && guest.happiness >= 70) {
      s.reputation = Math.min(100, (s.reputation ?? 30) + 3);
      dayLog.push({ day: s.day, category: 'reputation', label: 'Happy VIP departure', delta: 3, causeId: 'vip_departure', repComponent: 'value' });
    }

    if (guest.happiness <= 25) {
      dayLog.push({ day: s.day, category: 'churn', label: `${GUEST_SEGMENT_DEFS[guest.segment].label} left unhappy`, delta: -1, causeId: 'unhappy_departure', relatedEntityId: guest.id });
    }

    if (guest.assignedAccommodation !== null) {
      const b = updatedBuildings.find(bl => bl.id === guest.assignedAccommodation);
      if (b) b.currentGuests = Math.max(0, b.currentGuests - 1);
    }
  }

  // 11b. Resolve probabilistic story outcomes
  let outcomeMoneyDelta = 0;
  const keptOutcomes: typeof storyState.pendingOutcomes = [];
  for (const pending of storyState.pendingOutcomes) {
    if (s.day >= pending.resolveDay) {
      const roll = Math.random();
      let cumulative = 0;
      for (const scenario of pending.outcomes) {
        cumulative += scenario.probability;
        if (roll <= cumulative) {
          if (scenario.effects.money) outcomeMoneyDelta += scenario.effects.money;
          if (scenario.effects.reputation) newReputation = Math.max(0, Math.min(100, newReputation + scenario.effects.reputation));
          if (scenario.effects.socialHeat) socialHeat = Math.max(0, Math.min(100, socialHeat + scenario.effects.socialHeat));
          if (scenario.effects.segmentHappiness) {
            for (const g of remaining) {
              const bonus = scenario.effects.segmentHappiness[g.segment] ?? 0;
              if (bonus !== 0) g.happiness = Math.max(0, Math.min(100, g.happiness + bonus));
            }
          }
          dayLog.push({
            day: s.day,
            category: 'outcome_report',
            label: `${pending.storyTitle}: ${scenario.label}`,
            delta: scenario.effects.reputation ?? 0,
            causeId: `outcome_${pending.storyId}_${pending.optionId}`,
          });
          break;
        }
      }
    } else {
      keptOutcomes.push(pending);
    }
  }
  storyState.pendingOutcomes = keptOutcomes;

  // 12. Finances
  // Building maintenance scaled by star tier (owner-labor concept)
  const maintMult = getMaintenanceMult(s.reputation);
  const buildingMaintenance = updatedBuildings.reduce(
    (sum, b) => {
      const rawMaint = getEffectiveMaintenance(b.type, b.level, b);
      const scaledMaint = Math.ceil(rawMaint * maintMult);
      const isIdle = b.currentGuests === 0 && !b.isConstructing && getBuildingDef(b.type).capacity > 0;
      return sum + (isIdle ? Math.ceil(scaledMaint * 0.5) : scaledMaint);
    }, 0
  );

  // Staff cost
  const staffCost =
    s.staff.cleaners * s.staff.cleanerCostPerDay +
    s.staff.animators * s.staff.animatorCostPerDay +
    s.staff.builders * s.staff.builderCostPerDay +
    s.staff.mechanics * s.staff.mechanicCostPerDay +
    s.staff.lifeguards * s.staff.lifeguardCostPerDay +
    s.staff.security * s.staff.securityCostPerDay;
  const maintenanceCost = buildingMaintenance + staffCost + eventProgramCost;

  // Security fines (calculated early so it feeds into grossIncome)
  const securityFineIncome = s.staff.security > 0 && s.guests.length > 5
    ? Math.round(s.staff.security * 30 * Math.min(s.guests.length / 10, 3))
    : 0;

  // Room Revenue: package price per night, scaled by star-tier market rate
  const roomPriceMult = getRoomPriceMult(s.reputation);
  // Discount promo: if any active campaign has revenueMultiplier, apply lowest one
  const promoMultiplier = s.marketing.reduce((mult, c) => {
    const def = getCampaignDef(c.campaignId);
    return def?.revenueMultiplier ? Math.min(mult, def.revenueMultiplier) : mult;
  }, 1.0);
  let roomRevenue = 0;
  for (const guest of remaining) {
    if (!guest.assignedAccommodation || !guest.packageId) continue;
    const accom = updatedBuildings.find(b => b.id === guest.assignedAccommodation);
    if (!accom || !isOperational(accom)) continue;
    const pkg = accom.packages.find(p => p.id === guest.packageId);
    if (!pkg) continue;
    const effectivePrice = getEffectivePackagePrice(pkg, accom.level);
    const adjMult = 1 + accom.adjacencyBonus;
    const priceMult = accom.priceMultiplier;
    roomRevenue += Math.round(effectivePrice * priceMult * adjMult * roomPriceMult * promoMultiplier);
  }

  // Resort Fee: per lodging guest per day, scaled by star tier
  let resortFeeRevenue = 0;
  for (const guest of remaining) {
    if (!guest.assignedAccommodation) continue;
    const accom = updatedBuildings.find(b => b.id === guest.assignedAccommodation);
    if (!accom || !isOperational(accom)) continue;
    const baseFee = accom.type === 'hotel' ? 60 : 30;
    const levelBonus = (accom.level - 1) * 15;
    resortFeeRevenue += Math.round((baseFee + levelBonus) * roomPriceMult);
  }

  // Day-Pass Revenue
  const localGuestsCount = newGuests.filter(g => g.segment === 'local').length;
  const dayPassRevenue = localGuestsCount * s.dayPassPrice;

  // Ancillary from pending
  const ancillaryRevenue = s.pendingAncillary;

  // Loan amortization (daily payment = principal + interest)
  let loanPayments = 0;
  let updatedLoans = s.loans.map(loan => {
    const payment = loan.dailyPayment ?? loan.dailyInterest;
    loanPayments += payment;
    const interest = Math.round(loan.remaining * (loan.dailyInterest / (loan.principal || 1)));
    const principalPaid = payment - interest;
    const newRemaining = Math.max(0, loan.remaining - principalPaid);
    const newDaysRemaining = (loan.daysRemaining ?? loan.term ?? 60) - 1;
    return { ...loan, remaining: newRemaining, daysRemaining: newDaysRemaining };
  });
  updatedLoans = updatedLoans.filter(l => l.remaining > 1 && (l.daysRemaining === undefined || l.daysRemaining > 0));

  const grossIncome = roomRevenue + resortFeeRevenue + dayPassRevenue + ancillaryRevenue + securityFineIncome + outcomeMoneyDelta;
  const netIncome = grossIncome - maintenanceCost - loanPayments;

  // Log financial items
  if (roomRevenue > 0) dayLog.push({ day: s.day, category: 'money', label: 'Room revenue', delta: roomRevenue, causeId: 'room_revenue' });
  if (resortFeeRevenue > 0) dayLog.push({ day: s.day, category: 'money', label: 'Resort fee', delta: resortFeeRevenue, causeId: 'resort_fee' });
  if (ancillaryRevenue > 0) dayLog.push({ day: s.day, category: 'money', label: 'Ancillary revenue', delta: ancillaryRevenue, causeId: 'ancillary_revenue' });
  if (dayPassRevenue > 0) dayLog.push({ day: s.day, category: 'money', label: 'Day-pass revenue', delta: dayPassRevenue, causeId: 'daypass_revenue' });
  if (outcomeMoneyDelta !== 0) dayLog.push({ day: s.day, category: 'money', label: 'Story outcome', delta: outcomeMoneyDelta, causeId: 'outcome_money' });
  if (maintenanceCost > 0) dayLog.push({ day: s.day, category: 'money', label: 'Maintenance', delta: -maintenanceCost, causeId: 'maintenance' });
  if (staffCost > 0) dayLog.push({ day: s.day, category: 'money', label: 'Staff wages', delta: -staffCost, causeId: 'staff_cost' });
  if (loanPayments > 0) dayLog.push({ day: s.day, category: 'money', label: 'Loan payment', delta: -loanPayments, causeId: 'loan_interest' });

  // Emergency government grant
  let emergencyGrant = 0;
  const projectedMoney = eventState.money + grossIncome - maintenanceCost - loanPayments;
  if (projectedMoney < -500 && s.reputation < 25 && s.day > 3) {
    emergencyGrant = 300 + Math.floor(Math.random() * 200);
    dayLog.push({ day: s.day, category: 'money', label: 'Emergency grant', delta: emergencyGrant, causeId: 'emergency_grant' });
  }

  // 13. Generate reviews
  let reviews = [...s.reviews];
  let nextReviewId = s.nextReviewId;
  const avgHappiness = remaining.length > 0 ? remaining.reduce((sum, g) => sum + g.happiness, 0) / remaining.length : 50;
  const hasCleaner = updatedBuildings.some(b => b.type === 'cleaners_shack' && !b.isConstructing);
  const hasToilet = updatedBuildings.some(b => b.type === 'toilet' && isOperational(b));
  const reviewCount = Math.min(3, Math.max(0, Math.floor(remaining.length / 3)));
  let reviewRepDelta = 0;

  for (let i = 0; i < reviewCount; i++) {
    const review = generateReview(nextReviewId++, s.day, remaining, avgHappiness, hasCleaner, hasToilet, s.staff.cleaners, updatedBuildings, s.reputation);
    if (review) {
      reviews.push(review);
      if (review.sentiment === 'negative') {
        reviewRepDelta -= review.severity;
        dayLog.push({ day: s.day, category: 'reputation', label: `Negative review: ${review.topic}`, delta: -review.severity, causeId: `review_${review.id}`, repComponent: TOPIC_TO_COMPONENT[review.topic] });
      } else if (review.sentiment === 'positive') {
        reviewRepDelta += review.severity * 0.3;
        dayLog.push({ day: s.day, category: 'reputation', label: `Positive review: ${review.topic}`, delta: review.severity * 0.3, causeId: `review_${review.id}`, repComponent: TOPIC_TO_COMPONENT[review.topic] });
      }

      // Viral backlash check
      if (review.sentiment === 'negative' && review.severity >= 4 && socialHeat > 60 && !hasViralBacklash) {
        events.push({ type: 'viral_backlash', title: 'Viral Backlash!', description: 'A negative review went viral! Guest arrivals halved for 3 days.', daysRemaining: 3, day: s.day });
        socialHeat = Math.min(100, socialHeat + 15);
        dayLog.push({ day: s.day, category: 'reputation', label: 'Viral backlash!', delta: -10, causeId: 'viral_backlash' });
      }
    }
  }

  reviews = reviews.slice(-20); // keep last 20

  // 14. Story generation (respects requiredUnlock from offerings)
  let stories = { ...storyState };
  stories.cooldownDays = Math.max(0, stories.cooldownDays - 1);
  if (!stories.activeStory && stories.cooldownDays <= 0 && remaining.length >= 5) {
    const available = STORY_CARDS.filter(sc => {
      if (stories.history.some(h => h.storyId === sc.id && h.day > s.day - 20)) return false;
      if (sc.requiredUnlock && !s.unlockedStories.includes(sc.requiredUnlock)) return false;
      return true;
    });
    if (available.length > 0) {
      stories.activeStory = available[Math.floor(Math.random() * available.length)];
    }
  }

  // 15. Contract management
  let contracts = [...s.contracts];
  // Offer new contracts if needed
  const availableContracts = contracts.filter(c => c.status === 'available');
  const activeContracts = contracts.filter(c => c.status === 'active');
  if (availableContracts.length === 0 && activeContracts.length < 2 && s.day > 3) {
    const usedIds = new Set(contracts.map(c => c.id));
    const freshContracts = CONTRACT_POOL.filter(c => !usedIds.has(c.id));
    if (freshContracts.length > 0) {
      const pick = freshContracts[Math.floor(Math.random() * freshContracts.length)];
      contracts.push({ ...pick, startDay: s.day + 1, progressDays: 0, status: 'available' });
    }
  }

  // Check active contracts
  const tempState: GameState = { ...s, day: s.day + 1, guests: remaining, buildings: updatedBuildings, reputation: newReputation, finances: { grossIncome, roomRevenue, resortFeeRevenue, ancillaryRevenue, dayPassRevenue, maintenanceCost, staffCost, loanInterest: loanPayments, netIncome, revenueByRole: { rooms: roomRevenue, ancillary: ancillaryRevenue, amenities: 0 } } };
  contracts = contracts.map(c => {
    if (c.status !== 'active') return c;
    const allMet = c.conditions.every(cond => checkContractCondition(cond, tempState));
    if (allMet) {
      const newProgress = c.progressDays + 1;
      if (newProgress >= c.durationDays) {
        dayLog.push({ day: s.day, category: 'money', label: `Contract completed: ${c.title}`, delta: c.reward.money ?? 0, causeId: `contract_${c.id}` });
        return { ...c, progressDays: newProgress, status: 'completed' as const };
      }
      return { ...c, progressDays: newProgress };
    } else {
      return { ...c, progressDays: 0 };
    }
  });

  // Apply contract rewards/penalties
  let contractMoney = 0;
  let contractRep = 0;
  for (const c of contracts) {
    if (c.status === 'completed' && c.progressDays === c.durationDays) {
      contractMoney += c.reward.money ?? 0;
      contractRep += c.reward.reputation ?? 0;
    }
  }

  // 16. Check missions
  const preState: GameState = {
    ...s,
    day: s.day + 1,
    guests: remaining,
    buildings: updatedBuildings,
    totalGuestsServed: s.totalGuestsServed + departing.length,
    totalMoneyEarned: s.totalMoneyEarned + Math.max(0, netIncome),
    reputation: newReputation,
    dayPassEnabled: s.dayPassEnabled,
  };
  const updatedMissions = checkMissions(preState, departureStats);

  // Debt reputation penalty
  let debtPenalty = 0;
  const finalMoney = eventState.money + grossIncome - maintenanceCost - loanPayments + emergencyGrant + contractMoney;
  if (finalMoney < 0) {
    debtPenalty = Math.min(3, Math.ceil(Math.abs(finalMoney) / 750));
  }
  const finalReputation = Math.max(0, Math.min(100, newReputation - debtPenalty + contractRep + reviewRepDelta));

  // Animator happiness bonus for families
  if (s.staff.animators > 0) {
    const bonusPerAnimator = 2;
    for (const g of remaining) {
      if (g.segment === 'family') {
        g.happiness = Math.min(100, g.happiness + Math.min(s.staff.animators, 3) * bonusPerAnimator);
      }
    }
  }

  // Handyman auto-repair: each handyman shack repairs one damaged building per day
  const handymanCount = updatedBuildings.filter(b => b.type === 'handyman_shack' && !b.isConstructing && !b.damaged).length;
  if (handymanCount > 0) {
    let repairsLeft = handymanCount;
    for (const b of updatedBuildings) {
      if (repairsLeft <= 0) break;
      if (b.damaged) {
        b.damaged = false;
        repairsLeft--;
        dayLog.push({ day: s.day, category: 'money', label: `Handyman repaired ${getBuildingDef(b.type).name}`, delta: 0, causeId: 'handyman_repair' });
      }
    }
  }

  // Mechanics staff: each mechanic repairs one additional damaged building per day
  if (s.staff.mechanics > 0) {
    let mechRepairs = s.staff.mechanics;
    for (const b of updatedBuildings) {
      if (mechRepairs <= 0) break;
      if (b.damaged) {
        b.damaged = false;
        mechRepairs--;
        dayLog.push({ day: s.day, category: 'money', label: `Mechanic repaired ${getBuildingDef(b.type).name}`, delta: 0, causeId: 'mechanic_repair' });
      }
    }
  }

  // Rep office happiness bonus: each rep office boosts all guest happiness slightly
  const repOfficeCount = updatedBuildings.filter(b => b.type === 'rep_office' && !b.isConstructing && b.powered).length;
  if (repOfficeCount > 0) {
    const bonusPerRep = 1.5;
    for (const g of remaining) {
      g.happiness = Math.min(100, g.happiness + Math.min(repOfficeCount, 2) * bonusPerRep);
    }
  }

  // Baywatch tower safety bonus: prevents drowning events and boosts reputation
  const hasBaywatch = updatedBuildings.some(b => b.type === 'baywatch_tower' && !b.isConstructing);
  if (hasBaywatch) {
    socialHeat = Math.min(100, socialHeat + 0.5); // slight positive visibility
  }

  // Lifeguards: boost safety and guest happiness on beach
  if (s.staff.lifeguards > 0) {
    const lgBonus = Math.min(s.staff.lifeguards, 3);
    for (const g of remaining) {
      if (g.beachTile) {
        g.happiness = Math.min(100, g.happiness + lgBonus);
      }
    }
  }

  // Security staff: log fine income
  if (securityFineIncome > 0) {
    dayLog.push({ day: s.day, category: 'money', label: `Security fines`, delta: securityFineIncome, causeId: 'security_fines' });
  }

  // Security post: reduces chance of incidents / negative reviews about safety
  // (effect is handled in review generation and reputation calc)

  // Cleaner hygiene bonus: reduces unhappiness from unmet toilet needs
  if (s.staff.cleaners > 0) {
    const hygieneBonus = Math.min(s.staff.cleaners, 3);
    for (const g of remaining) {
      if (g.needs.toilet > 60) {
        g.happiness = Math.min(100, g.happiness + hygieneBonus);
      }
    }
  }

  // Marketing campaign tick-down
  let updatedMarketing = s.marketing.map(c => ({ ...c, daysRemaining: c.daysRemaining - 1 }));
  let marketingRepBonus = 0;
  let marketingSocialHeat = 0;
  for (const c of updatedMarketing) {
    if (c.daysRemaining <= 0) {
      const def = getCampaignDef(c.campaignId);
      if (def?.reputationBonus) marketingRepBonus += def.reputationBonus;
    }
    // Apply socialHeat bonus on start day
    if (c.daysRemaining === (getCampaignDef(c.campaignId)?.durationDays ?? 0) - 1) {
      const def = getCampaignDef(c.campaignId);
      if (def?.socialHeatBonus) marketingSocialHeat += def.socialHeatBonus;
    }
  }
  updatedMarketing = updatedMarketing.filter(c => c.daysRemaining > 0);
  const finalReputationWithMarketing = Math.max(0, Math.min(100, finalReputation + marketingRepBonus));
  socialHeat = Math.min(100, socialHeat + marketingSocialHeat);

  if (marketingBonus > 0) {
    dayLog.push({ day: s.day, category: 'demand', label: `Marketing: +${marketingBonus} guests/day`, delta: marketingBonus, causeId: 'marketing' });
  }

  // Clear selectedGuest if departed
  const guestDeparted = s.selectedGuest !== null && !remaining.some(g => g.id === s.selectedGuest);

  return {
    ...s,
    day: s.day + 1,
    dayProgress: 0,
    money: finalMoney,
    guests: remaining,
    nextGuestId,
    buildings: updatedBuildings,
    reputation: finalReputationWithMarketing,
    reputationBreakdown: newBreakdown,
    totalGuestsServed: s.totalGuestsServed + departing.length,
    totalMoneyEarned: s.totalMoneyEarned + Math.max(0, netIncome),
    finances: { grossIncome, roomRevenue, resortFeeRevenue, ancillaryRevenue, dayPassRevenue, maintenanceCost, staffCost, loanInterest: loanPayments, netIncome, revenueByRole: { rooms: roomRevenue, ancillary: ancillaryRevenue, amenities: dayPassRevenue } },
    pendingAncillary: 0,
    loans: updatedLoans,
    dailyBreakdown: {
      roomRevenue,
      resortFeeRevenue,
      ancillaryRevenue,
      dayPassRevenue,
      otherIncome: securityFineIncome + outcomeMoneyDelta,
      totalIncome: grossIncome,
      buildingMaintenance,
      staffCost,
      loanPayments,
      eventCost: eventProgramCost,
      totalExpenses: maintenanceCost + loanPayments,
      netProfit: netIncome,
    },
    missions: updatedMissions,
    events,
    eventLog: evtLog,
    nextEventDay,
    impactLog: [],
    previousDayLog: [...s.impactLog, ...dayLog],
    reviews,
    nextReviewId,
    socialHeat,
    staff: s.staff,
    stories,
    contracts,
    marketing: updatedMarketing,
    selectedGuest: guestDeparted ? null : s.selectedGuest,
  };
}

// ── Review Generation ─────────────────────────────────────────────────

function generateReview(id: number, day: number, guests: Guest[], avgHappiness: number, hasCleaner: boolean, hasToilet: boolean, cleanerCount: number, buildings: Building[], reputation: number): Review | null {
  if (guests.length === 0) return null;
  const guest = guests[Math.floor(Math.random() * guests.length)];
  const starTier = getStarTier(reputation);

  // Determine base sentiment from happiness
  let baseSentiment: 'positive' | 'neutral' | 'negative';
  let severity: number;

  if (avgHappiness < 35) {
    baseSentiment = 'negative';
    severity = Math.min(5, Math.ceil((50 - avgHappiness) / 10));
  } else if (avgHappiness > 70) {
    baseSentiment = 'positive';
    severity = Math.min(5, Math.ceil((avgHappiness - 50) / 10));
  } else {
    baseSentiment = Math.random() < 0.5 ? 'neutral' : (Math.random() < 0.5 ? 'positive' : 'negative');
    severity = 1 + Math.floor(Math.random() * 2);
  }

  // Build topic pool with associated forced sentiments
  const damagedCount = buildings.filter(b => b.damaged).length;
  const operationalBuildings = buildings.filter(b => !b.isConstructing);
  const hasFood = operationalBuildings.some(b => getBuildingDef(b.type).category === 'food_drink');
  const hasEntertainment = operationalBuildings.some(b => getBuildingDef(b.type).category === 'entertainment');
  const highOccupancy = guests.length > operationalBuildings.reduce((s, b) => s + getBuildingDef(b.type).capacity, 0) * 0.8;

  type TopicEntry = { topic: Review['topic']; forceSentiment?: 'positive' | 'negative' };
  const topicPool: TopicEntry[] = [];

  // Star-tier gating: at 1-2 stars guests don't complain about lack of cleaners/amenities
  // (you handle it yourself at low star levels)
  if (starTier >= 3) {
    // Cleanliness: FORCED NEGATIVE if no cleaners/shack at 3+ stars
    if (!hasCleaner || cleanerCount === 0) {
      topicPool.push({ topic: 'cleanliness', forceSentiment: 'negative' });
      topicPool.push({ topic: 'cleanliness', forceSentiment: 'negative' });
    } else if (cleanerCount >= 2) {
      topicPool.push({ topic: 'cleanliness', forceSentiment: 'positive' });
    }

    if (!hasToilet) {
      topicPool.push({ topic: 'cleanliness', forceSentiment: 'negative' });
    }
  } else {
    // At 1-2 stars, cleanliness is fine (owner handles it) - can still get positive
    if (cleanerCount >= 1) {
      topicPool.push({ topic: 'cleanliness', forceSentiment: 'positive' });
    }
  }

  // Star-tier gating: entertainment complaints only at 4+ stars
  if (starTier >= 4 && !hasEntertainment) {
    topicPool.push({ topic: 'entertainment', forceSentiment: 'negative' });
  }

  if (damagedCount > 0) {
    topicPool.push({ topic: 'safety', forceSentiment: 'negative' });
  }

  if (highOccupancy) {
    topicPool.push({ topic: 'queues', forceSentiment: 'negative' });
  }

  // Neutral topics (use base sentiment)
  topicPool.push({ topic: 'service' });
  topicPool.push({ topic: 'value' });
  if (hasFood) topicPool.push({ topic: 'food' });
  if (hasEntertainment) topicPool.push({ topic: 'entertainment' });

  const pick = topicPool[Math.floor(Math.random() * topicPool.length)];
  const topic = pick.topic;
  const sentiment = pick.forceSentiment ?? baseSentiment;

  // Adjust severity for forced negative topics
  if (pick.forceSentiment === 'negative' && severity < 2) severity = 2;

  const templates = REVIEW_TEMPLATES[sentiment]?.[topic] ?? [`${sentiment} experience with ${topic}`];
  const text = templates[Math.floor(Math.random() * templates.length)];

  return { id, day, guestSegment: guest.segment, sentiment, topic, text, severity, handled: false };
}

// ── Contract Condition Check ─────────────────────────────────────────

function checkContractCondition(cond: Contract['conditions'][0], state: GameState): boolean {
  let val = 0;
  switch (cond.metric) {
    case 'reputation': val = state.reputation; break;
    case 'occupancy': val = getOccupancyPercent(state); break;
    case 'happiness': val = getGuestExperience(state); break;
    case 'profit': val = state.finances.netIncome; break;
    case 'segment_count':
      val = state.guests.filter(g => g.segment === cond.segment).length;
      break;
    case 'no_fines': return true; // simplified
  }
  switch (cond.operator) {
    case '>=': return val >= cond.value;
    case '<=': return val <= cond.value;
    case '>': return val > cond.value;
  }
  return false;
}

// ── Reducer ──────────────────────────────────────────────────────────

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_BUILD_MODE':
      return { ...state, buildMode: action.payload, selectedBuilding: null };

    case 'SET_HOVERED_TILE':
      return { ...state, hoveredTile: action.payload };

    case 'PLACE_BUILDING': {
      const { buildingType, x, y } = action.payload;
      const def = getBuildingDef(buildingType);
      if (state.money < def.cost) return state;
      if (!isBuildingUnlocked(buildingType, state.buildings)) return state;
      if (!canPlaceBuilding(state.grid, x, y, def.width, def.height, def)) return state;

      const isInstant = def.constructionDays <= 0;

      const defaultPkgs = def.defaultPackages ? createDefaultPackages(buildingType) : [];
      const syncedPkgs = syncPackagesFromExisting(defaultPkgs, buildingType, state.buildings);
      const syncedPrice = syncPriceFromExisting(buildingType, state.buildings);

      const newBuilding: Building = {
        id: state.nextBuildingId,
        type: buildingType,
        x, y,
        width: def.width,
        height: def.height,
        currentGuests: 0,
        priceMultiplier: syncedPrice,
        powered: isInstant && def.powerConsumption === 0,
        isConstructing: !isInstant,
        constructionProgress: isInstant ? 1 : 0,
        damaged: false,
        level: 1,
        adjacencyBonus: 0,
        packages: syncedPkgs,
        offerings: createDefaultOfferings(buildingType).filter(o => o.unlockLevel <= 1),
      };

      const newTiles = state.grid.tiles.map(row => row.map(tile => ({ ...tile })));
      for (let dy = 0; dy < def.height; dy++) {
        for (let dx = 0; dx < def.width; dx++) {
          newTiles[y + dy][x + dx].type = 'occupied';
          newTiles[y + dy][x + dx].buildingId = newBuilding.id;
        }
      }

      const newBuildings = [...state.buildings, newBuilding];
      updatePowerState(newBuildings);

      const newState = {
        ...state,
        money: state.money - def.cost,
        buildings: newBuildings,
        nextBuildingId: state.nextBuildingId + 1,
        grid: { ...state.grid, tiles: newTiles },
        buildMode: null,
      };
      return { ...newState, missions: checkMissions(newState) };
    }

    case 'SELECT_BUILDING':
      return { ...state, selectedBuilding: action.payload, selectedGuest: null, selectedStaff: null, buildMode: null };

    case 'SELECT_GUEST':
      return { ...state, selectedGuest: action.payload, selectedBuilding: null, selectedStaff: null, buildMode: null };

    case 'SELECT_STAFF':
      return { ...state, selectedStaff: action.payload, selectedBuilding: null, selectedGuest: null, buildMode: null };

    case 'SET_PRICE': {
      const { buildingId, multiplier } = action.payload;
      const clamped = Math.round(Math.max(0.5, Math.min(2.0, multiplier)) * 10) / 10;
      const target = state.buildings.find(b => b.id === buildingId);
      if (!target) return state;
      // Apply to ALL buildings of the same type
      return {
        ...state,
        buildings: state.buildings.map(b =>
          b.type === target.type ? { ...b, priceMultiplier: clamped } : b
        ),
      };
    }

    case 'SET_PACKAGE_PRICE': {
      const { buildingId, packageId, price } = action.payload;
      const clampedPrice = Math.max(1, Math.min(1500, Math.round(price)));
      const target = state.buildings.find(b => b.id === buildingId);
      if (!target) return state;
      // Apply to ALL buildings of the same type that have this package
      return {
        ...state,
        buildings: state.buildings.map(b =>
          b.type === target.type ? {
            ...b,
            packages: b.packages.map(p =>
              p.id === packageId ? { ...p, pricePerNight: clampedPrice } : p
            ),
          } : b
        ),
      };
    }

    case 'TOGGLE_PACKAGE': {
      const { buildingId, packageId } = action.payload;
      const target = state.buildings.find(b => b.id === buildingId);
      if (!target) return state;
      const pkg = target.packages.find(p => p.id === packageId);
      if (!pkg) return state;
      const newEnabled = !pkg.enabled;
      // Apply to ALL buildings of the same type
      return {
        ...state,
        buildings: state.buildings.map(b =>
          b.type === target.type ? {
            ...b,
            packages: b.packages.map(p =>
              p.id === packageId ? { ...p, enabled: newEnabled } : p
            ),
          } : b
        ),
      };
    }

    case 'TOGGLE_OFFERING': {
      const { buildingId, offeringId } = action.payload;
      const newBuildings = state.buildings.map(b =>
        b.id === buildingId ? {
          ...b,
          offerings: b.offerings.map(o => {
            if (o.id !== offeringId) return o;
            if (o.unlockLevel === 1) return o;
            return { ...o, enabled: !o.enabled };
          }),
        } : b
      );
      // Recompute unlocked stories from all enabled offerings across all buildings
      const newUnlockedStories: string[] = [];
      for (const b of newBuildings) {
        for (const o of b.offerings) {
          if (o.enabled && o.unlockStories) {
            for (const sid of o.unlockStories) {
              if (!newUnlockedStories.includes(sid)) newUnlockedStories.push(sid);
            }
          }
        }
      }
      return {
        ...state,
        buildings: newBuildings,
        unlockedStories: newUnlockedStories,
      };
    }

    case 'SET_EVENT_PROGRAM': {
      const { buildingId, eventType } = action.payload;
      return {
        ...state,
        buildings: state.buildings.map(b =>
          b.id === buildingId && b.type === 'event_space'
            ? { ...b, activeEventProgram: eventType }
            : b
        ),
      };
    }

    case 'SET_DAYPASS_PRICE': {
      const price = Math.max(5, Math.min(500, Math.round(action.payload)));
      return { ...state, dayPassPrice: price };
    }

    case 'TOGGLE_DAYPASS': {
      const newState = { ...state, dayPassEnabled: !state.dayPassEnabled };
      return { ...newState, missions: checkMissions(newState) };
    }

    case 'TAKE_LOAN': {
      const { name, amount, interestRate } = action.payload;
      if (state.loans.length >= 3) return state;
      const term = action.payload.term ?? 60;
      const dailyRate = interestRate;
      const dailyPayment = dailyRate > 0
        ? Math.round(amount * dailyRate / (1 - Math.pow(1 + dailyRate, -term)))
        : Math.round(amount / term);
      const dailyInterest = Math.round(amount * dailyRate);
      const newLoan: Loan = {
        id: state.nextLoanId,
        name,
        principal: amount,
        remaining: amount,
        dailyInterest,
        dayTaken: state.day,
        term,
        dailyPayment,
        daysRemaining: term,
      };
      return {
        ...state,
        money: state.money + amount,
        loans: [...state.loans, newLoan],
        nextLoanId: state.nextLoanId + 1,
      };
    }

    case 'REPAY_LOAN': {
      const loanId = action.payload;
      const loan = state.loans.find(l => l.id === loanId);
      if (!loan) return state;
      const repayAmount = Math.min(loan.remaining, state.money);
      if (repayAmount <= 0) return state;
      const newRemaining = loan.remaining - repayAmount;
      if (newRemaining <= 1) {
        // Fully repaid, remove loan
        return {
          ...state,
          money: state.money - loan.remaining,
          loans: state.loans.filter(l => l.id !== loanId),
        };
      }
      return {
        ...state,
        money: state.money - repayAmount,
        loans: state.loans.map(l =>
          l.id === loanId ? { ...l, remaining: newRemaining } : l
        ),
      };
    }

    case 'DEMOLISH_BUILDING': {
      const bId = action.payload;
      const building = state.buildings.find(b => b.id === bId);
      if (!building) return state;
      const def = getBuildingDef(building.type);
      const refund = Math.floor(def.cost * 0.55);

      const guests = state.guests.map(g => {
        if (g.assignedAccommodation === bId) return { ...g, assignedAccommodation: null };
        if (g.currentVisiting === bId) return { ...g, currentVisiting: null, visitTimeLeft: 0 };
        return g;
      });

      const newTiles = state.grid.tiles.map(row => row.map(tile => ({ ...tile })));
      for (let dy = 0; dy < building.height; dy++) {
        for (let dx = 0; dx < building.width; dx++) {
          const ty = building.y + dy;
          const tx = building.x + dx;
          if (ty < state.grid.height && tx < state.grid.width) {
            newTiles[ty][tx].type = 'sand';
            delete newTiles[ty][tx].buildingId;
          }
        }
      }

      const remainingBuildings = state.buildings.filter(b => b.id !== bId);
      updatePowerState(remainingBuildings);

      return {
        ...state,
        money: state.money + refund,
        buildings: remainingBuildings,
        guests,
        grid: { ...state.grid, tiles: newTiles },
        selectedBuilding: null,
      };
    }

    case 'REPAIR_BUILDING': {
      const rId = action.payload;
      const bldg = state.buildings.find(b => b.id === rId);
      if (!bldg || !bldg.damaged) return state;
      const repairCost = getEffectiveMaintenance(bldg.type, bldg.level) * 3;
      if (state.money < repairCost) return state;
      return {
        ...state,
        money: state.money - repairCost,
        buildings: state.buildings.map(b =>
          b.id === rId ? { ...b, damaged: false } : b
        ),
      };
    }

    case 'UPGRADE_BUILDING': {
      const uId = action.payload;
      const bldg = state.buildings.find(b => b.id === uId);
      if (!bldg || bldg.isConstructing || bldg.damaged) return state;
      const def = getBuildingDef(bldg.type);
      if (bldg.level >= def.maxLevel) return state;
      const cost = getUpgradeCost(bldg.type, bldg.level);
      if (state.money < cost) return state;

      const upgradeDays = def.constructionDays * 0.5 * bldg.level;
      const newLevel = bldg.level + 1;

      // Unlock new offerings for this level
      const allOfferings = createDefaultOfferings(bldg.type);
      const existingIds = new Set(bldg.offerings.map(o => o.id));
      const newOfferings = allOfferings
        .filter(o => o.unlockLevel === newLevel && !existingIds.has(o.id))
        .map(o => ({ ...o, enabled: false }));

      // Unlock new packages for this level (accommodation), synced from siblings
      const allPackages = createDefaultPackages(bldg.type);
      const existingPkgIds = new Set(bldg.packages.map(p => p.id));
      const rawNewPkgs = allPackages
        .filter(p => p.unlockLevel === newLevel && !existingPkgIds.has(p.id))
        .map(p => ({ ...p, enabled: false }));
      const otherBuildings = state.buildings.filter(b => b.id !== bldg.id);
      const newPackages = syncPackagesFromExisting(rawNewPkgs, bldg.type, otherBuildings);

      const newState = {
        ...state,
        money: state.money - cost,
        buildings: state.buildings.map(b =>
          b.id === uId ? {
            ...b,
            level: newLevel,
            isConstructing: upgradeDays > 0,
            constructionProgress: upgradeDays > 0 ? 0 : 1,
            offerings: [...b.offerings, ...newOfferings],
            packages: [...b.packages, ...newPackages],
          } : b
        ),
      };
      return { ...newState, missions: checkMissions(newState) };
    }

    case 'CLAIM_MISSION': {
      const mId = action.payload;
      const mission = state.missions.find(m => m.id === mId);
      if (!mission || !mission.completed || mission.claimed) return state;
      return {
        ...state,
        money: state.money + mission.reward,
        missions: state.missions.map(m =>
          m.id === mId ? { ...m, claimed: true } : m
        ),
      };
    }

    case 'DISMISS_EVENT':
      return state;

    case 'RESPOND_REVIEW': {
      const { reviewId, responseType } = action.payload;
      const review = state.reviews.find(r => r.id === reviewId);
      if (!review || review.handled) return state;

      let repChange = 0;
      let moneyChange = 0;
      let heatChange = 0;

      switch (responseType) {
        case 'respond':
          // Free public acknowledgement — stops ongoing rep bleed, small recovery
          repChange = 1;
          heatChange = -2;
          break;
        case 'compensate':
          // Spend money to fully recover reputation damage
          moneyChange = -(75 + review.severity * 45);
          repChange = Math.ceil(review.severity * 0.8);
          heatChange = -3;
          break;
        case 'ignore':
          // Extra reputation hit from unaddressed complaint
          repChange = -Math.ceil(review.severity * 0.5);
          heatChange = 2;
          break;
      }

      return {
        ...state,
        money: state.money + moneyChange,
        reputation: Math.max(0, Math.min(100, state.reputation + repChange)),
        socialHeat: Math.max(0, Math.min(100, state.socialHeat + heatChange)),
        reviews: state.reviews.map(r =>
          r.id === reviewId ? { ...r, handled: true, responseType } : r
        ),
      };
    }

    case 'HIRE_STAFF': {
      const { role } = action.payload;
      const salaryKey: Record<StaffRole, keyof typeof state.staff> = {
        cleaners: 'cleanerCostPerDay', animators: 'animatorCostPerDay',
        builders: 'builderCostPerDay', mechanics: 'mechanicCostPerDay',
        lifeguards: 'lifeguardCostPerDay', security: 'securityCostPerDay',
      };
      // Building requirements per role
      if (role === 'cleaners') {
        const shackCount = state.buildings.filter(b => b.type === 'cleaners_shack' && !b.isConstructing).length;
        if (shackCount === 0 || state.staff.cleaners >= shackCount * 2) return state;
      }
      if (role === 'animators') {
        const hasEntertainment = state.buildings.some(b =>
          getBuildingDef(b.type).category === 'entertainment' && !b.isConstructing
        );
        if (!hasEntertainment) return state;
      }
      if (role === 'builders') {
        const hasHandyman = state.buildings.some(b => b.type === 'handyman_shack' && !b.isConstructing);
        if (!hasHandyman) return state;
        const handyCount = state.buildings.filter(b => b.type === 'handyman_shack' && !b.isConstructing).length;
        if (state.staff.builders >= handyCount * 2) return state;
      }
      if (role === 'mechanics') {
        const hasHandyman = state.buildings.some(b => b.type === 'handyman_shack' && !b.isConstructing);
        if (!hasHandyman) return state;
        const handyCount = state.buildings.filter(b => b.type === 'handyman_shack' && !b.isConstructing).length;
        if (state.staff.mechanics >= handyCount * 2) return state;
      }
      if (role === 'lifeguards') {
        const baywatchCount = state.buildings.filter(b => b.type === 'baywatch_tower' && !b.isConstructing).length;
        if (baywatchCount === 0 || state.staff.lifeguards >= baywatchCount * 2) return state;
      }
      if (role === 'security') {
        const secPostCount = state.buildings.filter(b => b.type === 'security_post' && !b.isConstructing).length;
        if (secPostCount === 0 || state.staff.security >= secPostCount * 3) return state;
      }
      const dailySalary = state.staff[salaryKey[role]] as number;
      const hireCost = dailySalary * 5;
      if (state.money < hireCost) return state;
      const max = 10;
      if (state.staff[role] >= max) return state;
      return {
        ...state,
        money: state.money - hireCost,
        staff: { ...state.staff, [role]: state.staff[role] + 1 },
      };
    }

    case 'FIRE_STAFF': {
      const { role } = action.payload;
      if (state.staff[role] <= 0) return state;
      return {
        ...state,
        staff: { ...state.staff, [role]: state.staff[role] - 1 },
      };
    }

    case 'SET_SALARY': {
      const { role, salary } = action.payload;
      const salaryKey: Record<StaffRole, keyof typeof state.staff> = {
        cleaners: 'cleanerCostPerDay', animators: 'animatorCostPerDay',
        builders: 'builderCostPerDay', mechanics: 'mechanicCostPerDay',
        lifeguards: 'lifeguardCostPerDay', security: 'securityCostPerDay',
      };
      const clamped = Math.max(20, Math.min(300, Math.round(salary)));
      return {
        ...state,
        staff: { ...state.staff, [salaryKey[role]]: clamped },
      };
    }

    case 'RESOLVE_STORY': {
      const { optionId } = action.payload;
      const story = state.stories.activeStory;
      if (!story) return state;
      const option = story.options.find(o => o.id === optionId);
      if (!option) return state;

      // Probabilistic path: option has outcomes array
      if (option.outcomes && option.outcomes.length > 0) {
        const immediateCost = option.cost ?? 0;
        const pendingOutcomes = [...(state.stories.pendingOutcomes || []), {
          storyId: story.id,
          storyTitle: story.title,
          optionId: option.id,
          resolveDay: state.day + (option.resolveDays ?? 2),
          outcomes: option.outcomes,
        }];
        return {
          ...state,
          money: state.money - immediateCost,
          stories: {
            ...state.stories,
            activeStory: null,
            cooldownDays: 4 + Math.floor(Math.random() * 4),
            history: [...state.stories.history, { storyId: story.id, choiceId: optionId, day: state.day }],
            pendingOutcomes,
          },
        };
      }

      // Deterministic path: option has effects (legacy / simple stories)
      const effects = option.effects ?? {};
      let money = state.money + (effects.money ?? 0);
      let reputation = Math.max(0, Math.min(100, state.reputation + (effects.reputation ?? 0)));
      let heat = Math.max(0, Math.min(100, state.socialHeat + (effects.socialHeat ?? 0)));
      const guests = effects.segmentHappiness
        ? state.guests.map(g => {
            const bonus = effects.segmentHappiness?.[g.segment] ?? 0;
            return bonus !== 0 ? { ...g, happiness: Math.max(0, Math.min(100, g.happiness + bonus)) } : g;
          })
        : state.guests;

      const pendingDelayed = [...state.stories.pendingDelayed];
      if (effects.delayedEffect) {
        pendingDelayed.push({
          triggerDay: state.day + effects.delayedEffect.daysLater,
          log: { ...effects.delayedEffect.logEntry, day: state.day + effects.delayedEffect.daysLater },
        });
      }

      return {
        ...state,
        money,
        reputation,
        socialHeat: heat,
        guests,
        stories: {
          ...state.stories,
          activeStory: null,
          cooldownDays: 4 + Math.floor(Math.random() * 4),
          history: [...state.stories.history, { storyId: story.id, choiceId: optionId, day: state.day }],
          pendingDelayed,
        },
      };
    }

    case 'ACCEPT_CONTRACT': {
      const contractId = action.payload;
      return {
        ...state,
        contracts: state.contracts.map(c =>
          c.id === contractId && c.status === 'available'
            ? { ...c, status: 'active' as const, startDay: state.day, progressDays: 0 }
            : c
        ),
      };
    }

    case 'DECLINE_CONTRACT': {
      const contractId = action.payload;
      return {
        ...state,
        contracts: state.contracts.filter(c => c.id !== contractId || c.status !== 'available'),
      };
    }

    case 'START_CAMPAIGN': {
      const campaignId = action.payload;
      const def = getCampaignDef(campaignId);
      if (!def) return state;
      if (state.money < def.cost) return state;
      if (def.minReputation && state.reputation < def.minReputation) return state;
      if (def.requiresHotel && !state.buildings.some(b => b.type === 'hotel' && !b.isConstructing)) return state;
      // Don't allow same campaign to be active twice
      if (state.marketing.some(c => c.campaignId === campaignId)) return state;

      return {
        ...state,
        money: state.money - def.cost,
        marketing: [...state.marketing, {
          campaignId,
          startDay: state.day,
          daysRemaining: def.durationDays,
        }],
      };
    }

    case 'SET_PATH_MODE':
      return { ...state, buildMode: action.payload ? 'path' as const : null };

    case 'PLACE_PATH': {
      const { x: pathX, y: pathY } = action.payload;
      const tile = state.grid.tiles[pathY]?.[pathX];
      if (!tile || (tile.type !== 'sand' && tile.type !== 'beach_sand')) return state;
      const pathCost = 1;
      if (state.money < pathCost) return state;

      const newTiles = state.grid.tiles.map(row => row.map(t => ({ ...t })));
      newTiles[pathY][pathX] = { ...newTiles[pathY][pathX], type: 'path' as const };

      return {
        ...state,
        money: state.money - pathCost,
        grid: { ...state.grid, tiles: newTiles },
      };
    }

    case 'REMOVE_PATH': {
      const { x: rpx, y: rpy } = action.payload;
      const rTile = state.grid.tiles[rpy]?.[rpx];
      if (!rTile || rTile.type !== 'path') return state;

      const rTiles = state.grid.tiles.map(row => row.map(t => ({ ...t })));
      // Restore original tile type based on position (beach zone = 2 rows above water)
      const waterStartY = GRID_HEIGHT - WATER_ROWS;
      const isBeachRow = rpy >= waterStartY - BEACH_ROWS && rpy < waterStartY;
      rTiles[rpy][rpx] = { ...rTiles[rpy][rpx], type: isBeachRow ? 'beach_sand' : 'sand' };

      return {
        ...state,
        money: state.money + 2,
        grid: { ...state.grid, tiles: rTiles },
      };
    }

    case 'PLACE_TRASH_BIN': {
      const { x: binX, y: binY } = action.payload;
      const binTile = state.grid.tiles[binY]?.[binX];
      if (!binTile) return state;
      // Can place on path or beach_sand tiles
      if (binTile.type !== 'path' && binTile.type !== 'beach_sand') return state;
      // Check not already a bin here
      if (state.trashBins.some(b => b.x === binX && b.y === binY)) return state;
      const binCost = 15;
      if (state.money < binCost) return state;
      return {
        ...state,
        money: state.money - binCost,
        trashBins: [...state.trashBins, { x: binX, y: binY }],
      };
    }

    case 'REMOVE_TRASH_BIN': {
      const { x: rbx, y: rby } = action.payload;
      const binIdx = state.trashBins.findIndex(b => b.x === rbx && b.y === rby);
      if (binIdx === -1) return state;
      const newBins = [...state.trashBins];
      newBins.splice(binIdx, 1);
      return {
        ...state,
        money: state.money + 5,
        trashBins: newBins,
      };
    }

    case 'BUY_LAND': {
      const { x: lx, y: ly } = action.payload;
      // Snap to parcel grid
      const px = Math.floor(lx / LAND_PARCEL_SIZE) * LAND_PARCEL_SIZE;
      const py = Math.floor(ly / LAND_PARCEL_SIZE) * LAND_PARCEL_SIZE;
      const waterStartY = GRID_HEIGHT - WATER_ROWS;

      // Validate: must be within grid, not water, and not already owned
      if (px < 0 || py < 0 || px + LAND_PARCEL_SIZE > GRID_WIDTH || py + LAND_PARCEL_SIZE > waterStartY) return state;

      // Check all tiles in parcel are unowned
      const parcelTiles: { tx: number; ty: number }[] = [];
      let allUnowned = true;
      for (let dy = 0; dy < LAND_PARCEL_SIZE; dy++) {
        for (let dx = 0; dx < LAND_PARCEL_SIZE; dx++) {
          const tx = px + dx, ty = py + dy;
          if (ty >= waterStartY || tx >= GRID_WIDTH) { allUnowned = false; break; }
          if (state.grid.tiles[ty]?.[tx]?.type !== 'unowned') { allUnowned = false; break; }
          parcelTiles.push({ tx, ty });
        }
        if (!allUnowned) break;
      }
      if (!allUnowned || parcelTiles.length === 0) return state;

      // Price: closer to water = more expensive
      const distToWater = waterStartY - (py + LAND_PARCEL_SIZE);
      let pricePerTile: number;
      if (distToWater <= 0) pricePerTile = 3000;      // beachfront
      else if (distToWater <= 4) pricePerTile = 1500;  // near-beach
      else pricePerTile = 750;                          // inland
      const totalPrice = pricePerTile * parcelTiles.length;

      if (state.money < totalPrice) return state;

      // Update grid tiles (beach zone rows get beach_sand)
      const buyWaterStartY = GRID_HEIGHT - WATER_ROWS;
      const buyBeachStartY = buyWaterStartY - BEACH_ROWS;
      const newTiles = state.grid.tiles.map(row => row.map(t => ({ ...t })));
      for (const { tx, ty } of parcelTiles) {
        const tileType = (ty >= buyBeachStartY && ty < buyWaterStartY) ? 'beach_sand' : 'sand';
        newTiles[ty][tx] = { ...newTiles[ty][tx], type: tileType as any };
      }

      return {
        ...state,
        money: state.money - totalPrice,
        grid: { ...state.grid, tiles: newTiles },
        ownedLand: [...state.ownedLand, { x: px, y: py, w: LAND_PARCEL_SIZE, h: LAND_PARCEL_SIZE }],
      };
    }

    case 'SELL_LAND': {
      const { x: sx, y: sy } = action.payload;
      const spx = Math.floor(sx / LAND_PARCEL_SIZE) * LAND_PARCEL_SIZE;
      const spy = Math.floor(sy / LAND_PARCEL_SIZE) * LAND_PARCEL_SIZE;
      const waterStart = GRID_HEIGHT - WATER_ROWS;

      // Find the parcel
      const parcelIdx = state.ownedLand.findIndex(p => p.x === spx && p.y === spy);
      if (parcelIdx < 0) return state;
      // Can't sell the initial parcel (index 0)
      if (parcelIdx === 0) return state;

      // Can't sell if any building occupies this parcel
      const hasBuilding = state.buildings.some(b => {
        const bDef = getBuildingDef(b.type);
        for (let dy = 0; dy < bDef.height; dy++) {
          for (let dx = 0; dx < bDef.width; dx++) {
            const bx = b.x + dx, by = b.y + dy;
            if (bx >= spx && bx < spx + LAND_PARCEL_SIZE && by >= spy && by < spy + LAND_PARCEL_SIZE) return true;
          }
        }
        return false;
      });
      if (hasBuilding) return state;

      // Refund at 50%
      const distToW = waterStart - (spy + LAND_PARCEL_SIZE);
      let sellPricePerTile: number;
      if (distToW <= 0) sellPricePerTile = 100;
      else if (distToW <= 4) sellPricePerTile = 50;
      else sellPricePerTile = 25;
      const refund = sellPricePerTile * LAND_PARCEL_SIZE * LAND_PARCEL_SIZE;

      // Revert tiles to unowned
      const sellTiles = state.grid.tiles.map(row => row.map(t => ({ ...t })));
      for (let dy = 0; dy < LAND_PARCEL_SIZE; dy++) {
        for (let dx = 0; dx < LAND_PARCEL_SIZE; dx++) {
          const tx = spx + dx, ty = spy + dy;
          if (ty < waterStart && tx < GRID_WIDTH) {
            sellTiles[ty][tx] = { ...sellTiles[ty][tx], type: 'unowned' as const };
          }
        }
      }

      const newOwned = [...state.ownedLand];
      newOwned.splice(parcelIdx, 1);

      return {
        ...state,
        money: state.money + refund,
        grid: { ...state.grid, tiles: sellTiles },
        ownedLand: newOwned,
      };
    }

    case 'PAN_CAMERA': {
      const { dx, dy } = action.payload;
      const zoom = state.camera.zoom || 1;
      const viewW = 1008 / zoom;
      const viewH = 714 / zoom;
      // Isometric world bounds (tile half-w=40, half-h=20)
      const isoMinX = -GRID_HEIGHT * 40 - 80;
      const isoMaxX = GRID_WIDTH * 40 + 80;
      const isoMinY = -40;
      const isoMaxY = (GRID_WIDTH + GRID_HEIGHT) * 20 + 80;
      return {
        ...state,
        camera: {
          ...state.camera,
          x: Math.max(isoMinX, Math.min(state.camera.x + dx, isoMaxX - viewW)),
          y: Math.max(isoMinY, Math.min(state.camera.y + dy, isoMaxY - viewH)),
        },
      };
    }

    case 'SET_ZOOM': {
      const MIN_ZOOM = 0.4;
      const MAX_ZOOM = 2.0;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, action.payload.zoom));
      const oldZoom = state.camera.zoom || 1;

      // Keep the point under the cursor stationary
      const cx = action.payload.centerX ?? 1008 / 2;
      const cy = action.payload.centerY ?? 714 / 2;

      // World point under cursor before zoom
      const worldX = state.camera.x + cx / oldZoom;
      const worldY = state.camera.y + cy / oldZoom;

      // New camera position to keep that world point under the cursor
      let newCamX = worldX - cx / newZoom;
      let newCamY = worldY - cy / newZoom;

      // Clamp to isometric world bounds (tile half-w=40, half-h=20)
      const viewW = 1008 / newZoom;
      const viewH = 714 / newZoom;
      const isoMinX = -GRID_HEIGHT * 40 - 80;
      const isoMaxX = GRID_WIDTH * 40 + 80;
      const isoMinY = -40;
      const isoMaxY = (GRID_WIDTH + GRID_HEIGHT) * 20 + 80;
      newCamX = Math.max(isoMinX, Math.min(newCamX, isoMaxX - viewW));
      newCamY = Math.max(isoMinY, Math.min(newCamY, isoMaxY - viewH));

      return {
        ...state,
        camera: { x: newCamX, y: newCamY, zoom: newZoom },
      };
    }

    case 'SET_SPEED':
      return { ...state, gameSpeed: action.payload };

    case 'TICK_DAY': {
      const dp = action.payload.deltaProgress;
      const newProgress = state.dayProgress + dp;
      if (newProgress >= 1.0) {
        // Simulate remaining day in sub-steps so guests complete multiple
        // visit cycles and generate proper ancillary revenue
        const remaining = 1.0 - state.dayProgress;
        const SUB_STEP = 0.05; // ~20 sub-ticks per full day
        let current = state;
        let left = remaining;
        while (left > 0) {
          const step = Math.min(SUB_STEP, left);
          current = processGuestActivity(current, step);
          left -= step;
        }
        return processDayEnd(current);
      }
      const withActivity = processGuestActivity(state, dp);
      return { ...withActivity, dayProgress: newProgress };
    }

    case 'TUTORIAL_DISMISS':
      return {
        ...state,
        tutorialSeen: { ...state.tutorialSeen, [action.payload]: true },
      };

    case 'RESET_GAME':
      return createFreshState();

    case 'LOAD_STATE':
      return action.payload;

    default:
      return state;
  }
}
