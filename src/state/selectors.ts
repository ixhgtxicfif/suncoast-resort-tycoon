import { GameState, Building, BuildingType, NeedType, WeatherType, GuestSegment, ReputationBreakdown, ReputationComponent } from './types';
import { getBuildingDef, getEffectiveCapacity, getEffectiveMaintenance, getEffectivePower } from './buildingDefs';

// ── Power ────────────────────────────────────────────────────────────

const BASE_POWER_SUPPLY = 2;

export const getPowerSupply = (state: GameState): number =>
  BASE_POWER_SUPPLY + state.buildings
    .filter(b => !b.isConstructing && !b.damaged)
    .reduce((sum, b) => sum + getEffectivePower(b), 0);

export const getPowerDemand = (state: GameState): number =>
  state.buildings
    .filter(b => !b.isConstructing && getBuildingDef(b.type).requiresPower !== false)
    .reduce((sum, b) => sum + getBuildingDef(b.type).powerConsumption, 0);

// ── Economy ──────────────────────────────────────────────────────────

export const getTotalMaintenanceCost = (state: GameState): number =>
  state.buildings.reduce((sum, b) => sum + getEffectiveMaintenance(b.type, b.level, b), 0);

export const getTotalCapacity = (state: GameState, need: NeedType): number => {
  let cap = 0;
  for (const b of state.buildings) {
    if (b.isConstructing || !b.powered || b.damaged) continue;
    const def = getBuildingDef(b.type);
    if (def.satisfiesNeed === need) cap += getEffectiveCapacity(b.type, b.level, b);
  }
  return cap;
};

export const getAccommodationCapacity = (state: GameState): number =>
  getTotalCapacity(state, 'accommodation');

export const getGuestCount = (state: GameState): number =>
  state.guests.length;

export const getOccupancy = (state: GameState): number => {
  const cap = getAccommodationCapacity(state);
  if (cap === 0) return 0;
  const housed = state.guests.filter(g => g.assignedAccommodation !== null).length;
  return Math.min(1, housed / cap);
};

export const getOccupancyPercent = (state: GameState): number =>
  Math.round(getOccupancy(state) * 100);

// ── Guest Experience ────────────────────────────────────────────────

export const getGuestExperience = (state: GameState): number => {
  const lodgingGuests = state.guests.filter(g => g.segment !== 'local');
  if (lodgingGuests.length === 0) return 50;
  return Math.round(lodgingGuests.reduce((s, g) => s + g.happiness, 0) / lodgingGuests.length);
};

// ── Reputation Components (7-component breakdown) ───────────────────

export function calculateReputationBreakdown(state: GameState): ReputationBreakdown {
  const completed = state.buildings.filter(b => !b.isConstructing);
  const operational = completed.filter(b => !b.damaged && b.powered);
  const avgHappiness = getGuestExperience(state);
  const occ = getOccupancy(state);

  // ── Beauty (beach, pools, scenery, variety, paths) ──
  let beauty = 20; // base
  const hasPool = operational.some(b => b.type === 'main_pool');
  const hasFunPool = operational.some(b => b.type === 'fun_pool');
  const hasJacuzzi = operational.some(b => b.type === 'jacuzzi');
  const hasPaths = state.grid.tiles.some(row => row.some(t => t.type === 'path'));
  const hasBeachSand = state.grid.tiles.some(row => row.some(t => t.type === 'beach_sand'));
  const uniqueTypes = new Set(completed.map(b => b.type)).size;
  const hasGymForBeauty = completed.some(b => b.type === 'gym');
  if (hasPool) beauty += 12;
  if (hasFunPool) beauty += 10;
  if (hasJacuzzi) beauty += 8;
  if (hasGymForBeauty) beauty += 4;
  if (hasPaths) beauty += 10;
  if (hasBeachSand) beauty += 10;
  beauty += Math.min(20, uniqueTypes * 2);
  const damagedRatio = completed.length > 0 ? completed.filter(b => b.damaged).length / completed.length : 0;
  beauty -= Math.round(damagedRatio * 30);
  // Litter reduces beauty significantly — trash on beach/paths kills the scenery
  const litterTotal = state.litter ? state.litter.items.length : 0;
  if (litterTotal > 3) beauty -= Math.min(40, Math.round((litterTotal - 3) * 1.0));

  // ── Safety (baywatch, security, first aid, no storms/incidents) ──
  let safety = 30; // base
  const hasBaywatch = operational.some(b => b.type === 'baywatch_tower');
  const hasSecurity = operational.some(b => b.type === 'security_post');
  const hasFirstAid = operational.some(b => b.type === 'first_aid');
  const hasConciergeForSafety = operational.some(b => b.type === 'concierge');
  if (hasBaywatch) safety += 20;
  if (hasSecurity) safety += 18;
  if (hasFirstAid) safety += 15;
  if (hasConciergeForSafety) safety += 8;
  const hasCasino = operational.some(b => b.type === 'casino');
  if (hasCasino) safety -= 5;
  const nightlifeEventSpaces = operational.filter(b => b.type === 'event_space' && b.activeEventProgram).length;
  if (nightlifeEventSpaces > 0) safety -= Math.min(8, nightlifeEventSpaces * 3);
  // Staff-based safety boosts
  if (state.staff.lifeguards > 0) safety += Math.min(15, state.staff.lifeguards * 6);
  if (state.staff.security > 0) safety += Math.min(12, state.staff.security * 4);
  const safetyReviews = state.reviews.filter(r => r.topic === 'safety' && r.sentiment === 'negative' && r.day >= state.day - 5);
  safety -= safetyReviews.length * 8;

  // ── Fun (entertainment variety, arcade, disco, sports, casino, stage, kids_club) ──
  let fun = 15;
  const funBuildings: BuildingType[] = ['arcade', 'main_pool', 'fun_pool', 'casino', 'mini_golf', 'equipment_hire', 'windsurfing', 'kids_club', 'event_space'];
  const funCount = funBuildings.filter(t => operational.some(b => b.type === t)).length;
  fun += Math.min(50, funCount * 10);
  if (state.staff.animators > 0) fun += Math.min(15, state.staff.animators * 5);
  const funOfferingBonus = operational.reduce((sum, b) => {
    return sum + b.offerings.filter(o => o.enabled && o.happinessBonus > 0).length * 2;
  }, 0);
  fun += Math.min(15, funOfferingBonus);

  // ── Value (price fairness, happiness vs spend, experience buildings) ──
  let value = 40; // baseline - "fair"
  const avgPriceMult = completed.length > 0
    ? completed.reduce((s, b) => s + b.priceMultiplier, 0) / completed.length
    : 1.0;
  if (avgPriceMult > 1.4) value -= 15;
  else if (avgPriceMult > 1.2) value -= 8;
  else if (avgPriceMult < 0.9) value += 10;
  if (avgHappiness > 60) value += 15;
  else if (avgHappiness < 35) value -= 15;
  // Experience drivers add perceived value (free amenities = better value)
  const hasGym = operational.some(b => b.type === 'gym');
  const hasConcierge = operational.some(b => b.type === 'concierge');
  const hasKidsClub = operational.some(b => b.type === 'kids_club');
  const freeAmenityCount = operational.filter(b => {
    const def = getBuildingDef(b.type);
    return def.role === 'experience_driver' && def.incomePerVisit === 0;
  }).length;
  value += Math.min(15, freeAmenityCount * 3);
  const hasCoworking = operational.some(b => b.type === 'coworking');
  const hasEventSpace = operational.some(b => b.type === 'event_space');
  if (hasGym) value += 5;
  if (hasConcierge) value += 8;
  if (hasKidsClub) value += 5;
  if (hasCoworking) value += 6;
  if (hasEventSpace) value += 4;
  // Stay extensions indicate high perceived value
  const extendedGuests = state.guests.filter(g => g.stayBonusApplied > 0).length;
  if (extendedGuests > 0) value += Math.min(10, extendedGuests * 3);
  const valueReviews = state.reviews.filter(r => r.topic === 'value' && r.sentiment === 'negative' && r.day >= state.day - 5);
  value -= valueReviews.length * 6;
  const posValueReviews = state.reviews.filter(r => r.topic === 'value' && r.sentiment === 'positive' && r.day >= state.day - 5);
  value += posValueReviews.length * 4;

  // ── Nightlife (clubs, disco, bars, cocktail bar, stage) ──
  let nightlife = 10;
  const nightlifeBuildings: BuildingType[] = ['event_space', 'beach_bar', 'cocktail_bar', 'casino'];
  const nightCount = nightlifeBuildings.filter(t => operational.some(b => b.type === t)).length;
  nightlife += Math.min(50, nightCount * 12);
  // Premium drink/entertainment offerings boost nightlife
  const nightlifeOfferings = operational.reduce((sum, b) => {
    return sum + b.offerings.filter(o => o.enabled && (o.id === 'cocktails' || o.id === 'premium_spirits' || o.id === 'club_nights' || o.id === 'live_shows')).length * 8;
  }, 0);
  nightlife += Math.min(20, nightlifeOfferings);
  const noiseReviews = state.reviews.filter(r => r.topic === 'noise' && r.sentiment === 'negative' && r.day >= state.day - 5);
  nightlife += noiseReviews.length * 3; // noise = nightlife is active

  // ── Cleanliness (cleaners, toilets, litter, not overcrowded) ──
  let cleanliness = 30;
  const hasCleanerShack = operational.some(b => b.type === 'cleaners_shack');
  const hasToilet = operational.some(b => b.type === 'toilet');
  const hasShower = operational.some(b => b.type === 'beach_shower');
  const trashBinCount = state.trashBins ? state.trashBins.length : 0;
  if (hasCleanerShack) cleanliness += 10;
  if (hasToilet) cleanliness += 15;
  if (hasShower) cleanliness += 8;
  if (trashBinCount > 0) cleanliness += Math.min(12, trashBinCount * 4);
  if (state.staff.cleaners > 0) cleanliness += Math.min(20, state.staff.cleaners * 8);
  // Litter penalty: each piece of litter reduces cleanliness
  const litterCount = state.litter ? state.litter.items.length : 0;
  if (litterCount > 0) {
    cleanliness -= Math.min(40, Math.round(litterCount * 0.8));
  }
  if (occ > 0.9 && state.staff.cleaners < 2) cleanliness -= 15;
  const cleanReviews = state.reviews.filter(r => r.topic === 'cleanliness' && r.sentiment === 'negative' && r.day >= state.day - 5);
  cleanliness -= cleanReviews.length * 8;
  const posCleanReviews = state.reviews.filter(r => r.topic === 'cleanliness' && r.sentiment === 'positive' && r.day >= state.day - 5);
  cleanliness += posCleanReviews.length * 5;

  // ── Food Quality (restaurants, variety, offerings) ──
  let foodQuality = 15;
  const foodBuildings: BuildingType[] = ['barbecue', 'restaurant', 'kiosk', 'beach_bar', 'cocktail_bar'];
  const foodCount = foodBuildings.filter(t => operational.some(b => b.type === t)).length;
  foodQuality += Math.min(40, foodCount * 8);
  const foodOfferings = operational.reduce((sum, b) => {
    const def = getBuildingDef(b.type);
    if (def.satisfiesNeed === 'hunger' || def.satisfiesNeed === 'thirst') {
      return sum + b.offerings.filter(o => o.enabled && o.unlockLevel >= 2).length * 6;
    }
    return sum;
  }, 0);
  foodQuality += Math.min(25, foodOfferings);
  const foodReviews = state.reviews.filter(r => r.topic === 'food' && r.sentiment === 'negative' && r.day >= state.day - 5);
  foodQuality -= foodReviews.length * 7;
  const posFoodReviews = state.reviews.filter(r => r.topic === 'food' && r.sentiment === 'positive' && r.day >= state.day - 5);
  foodQuality += posFoodReviews.length * 5;

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return {
    beauty: clamp(beauty),
    safety: clamp(safety),
    fun: clamp(fun),
    value: clamp(value),
    nightlife: clamp(nightlife),
    cleanliness: clamp(cleanliness),
    foodQuality: clamp(foodQuality),
  };
}

// Weighted average of all components => overall reputation
export const calculateReputation = (state: GameState): number => {
  const b = state.reputationBreakdown ?? calculateReputationBreakdown(state);
  const weights: Record<ReputationComponent, number> = {
    beauty: 0.12,
    safety: 0.15,
    fun: 0.18,
    value: 0.18,
    nightlife: 0.07,
    cleanliness: 0.15,
    foodQuality: 0.15,
  };
  let total = 0;
  let weightSum = 0;
  for (const key of Object.keys(weights) as ReputationComponent[]) {
    total += b[key] * weights[key];
    weightSum += weights[key];
  }
  return Math.max(0, Math.min(100, Math.round(total / weightSum)));
};

// ── Star Tier (derived from reputation) ──────────────────────────────

export const getStarTier = (reputation: number): number => {
  if (reputation >= 81) return 5;
  if (reputation >= 61) return 4;
  if (reputation >= 41) return 3;
  if (reputation >= 21) return 2;
  return 1;
};

/** Owner-labor concept: even at 1 star, buildings have real running costs */
export const getMaintenanceMult = (reputation: number): number => {
  const tier = getStarTier(reputation);
  switch (tier) {
    case 1: return 0.50;
    case 2: return 0.65;
    case 3: return 0.80;
    case 4: return 0.90;
    case 5: return 1.00;
    default: return 1.00;
  }
};

/** Market-rate room price multiplier: scales modestly with star tier */
export const getRoomPriceMult = (reputation: number): number => {
  const tier = getStarTier(reputation);
  switch (tier) {
    case 1: return 1.0;
    case 2: return 1.2;
    case 3: return 1.5;
    case 4: return 2.0;
    case 5: return 3.0;
    default: return 1.0;
  }
};

// ── Loans ───────────────────────────────────────────────────────────

export const getTotalDebt = (state: GameState): number =>
  state.loans.reduce((sum, l) => sum + l.remaining, 0);

export const getDailyInterest = (state: GameState): number =>
  state.loans.reduce((sum, l) => sum + l.dailyInterest, 0);

// ── Runway ──────────────────────────────────────────────────────────

export const getRunwayDays = (state: GameState): number => {
  const net = state.finances.netIncome;
  if (net >= 0 && state.money >= 0) return Infinity;
  if (net >= 0) return Infinity; // recovering
  return Math.max(0, Math.floor(Math.max(0, state.money) / Math.abs(net)));
};

// ── Room Revenue (for display) ──────────────────────────────────────

export const getRoomRevenue = (state: GameState): number => {
  return state.finances.roomRevenue;
};

// ── Building helpers ─────────────────────────────────────────────────

export const getBuildingCost = (type: BuildingType): number =>
  getBuildingDef(type).cost;

export const getBuildingSize = (type: BuildingType) => {
  const def = getBuildingDef(type);
  return { width: def.width, height: def.height };
};

export const canAffordBuilding = (state: GameState, type: BuildingType): boolean =>
  state.money >= getBuildingCost(type);

export const getBuildingsOfType = (state: GameState, type: BuildingType): Building[] =>
  state.buildings.filter(b => b.type === type);

export const getBuildingsSatisfyingNeed = (state: GameState, need: NeedType): Building[] =>
  state.buildings.filter(b => {
    if (b.isConstructing || !b.powered || b.damaged) return false;
    return getBuildingDef(b.type).satisfiesNeed === need;
  });

// ── Segment Attractiveness ──────────────────────────────────────────

export function getSegmentAttractiveness(state: GameState, segment: GuestSegment): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const b = state.reputationBreakdown ?? calculateReputationBreakdown(state);

  // Each segment cares about specific reputation components
  // Score = weighted average of the components they care about, normalized to 0-1
  let weightedSum = 0;
  let weightTotal = 0;

  const add = (component: ReputationComponent, weight: number, minThreshold: number, label: string) => {
    const val = b[component];
    weightedSum += val * weight;
    weightTotal += weight;
    if (val < minThreshold) reasons.push(`low ${label} (${val})`);
  };

  switch (segment) {
    case 'family':
      add('safety', 3, 40, 'Safety');
      add('cleanliness', 2.5, 40, 'Cleanliness');
      add('value', 2, 30, 'Value');
      add('fun', 1.5, 25, 'Fun');
      add('foodQuality', 1, 20, 'Food');
      if (b.nightlife > 60) { reasons.push('too noisy'); weightedSum -= 10; }
      break;

    case 'couple':
      add('beauty', 2.5, 35, 'Beauty');
      add('foodQuality', 2.5, 35, 'Food');
      add('nightlife', 1.5, 20, 'Nightlife');
      add('cleanliness', 1.5, 30, 'Cleanliness');
      add('value', 1, 25, 'Value');
      break;

    case 'vip':
      add('value', 1, 30, 'Value');
      add('safety', 2.5, 50, 'Safety');
      add('foodQuality', 2.5, 45, 'Food');
      add('beauty', 2, 40, 'Beauty');
      add('cleanliness', 2, 45, 'Cleanliness');
      break;

    case 'nomad':
      add('value', 3, 30, 'Value');
      add('fun', 2, 20, 'Fun');
      add('nightlife', 1, 10, 'Nightlife');
      add('safety', 1, 20, 'Safety');
      break;

    case 'local':
      add('fun', 2.5, 25, 'Fun');
      add('nightlife', 2, 15, 'Nightlife');
      add('value', 2, 30, 'Value');
      add('foodQuality', 1, 15, 'Food');
      if (state.dayPassPrice > 10) reasons.push('day-pass expensive');
      break;
  }

  const raw = weightTotal > 0 ? (weightedSum / weightTotal) / 100 : 0.3;
  const occ = getOccupancy(state);
  let overcrowdPenalty = 0;
  if (occ > 0.9) { overcrowdPenalty = 0.15; reasons.push('overcrowded'); }

  const score = Math.max(0.1, Math.min(1, raw - overcrowdPenalty));
  return { score, reasons };
}

// ── Weather ──────────────────────────────────────────────────────────

export const getWeatherArrivalModifier = (weather: WeatherType): number => {
  switch (weather) {
    case 'sunny':  return 1.0;
    case 'cloudy': return 0.8;
    case 'rain':   return 0.5;
    case 'storm':  return 0.2;
  }
};

export const getWeatherHappinessModifier = (weather: WeatherType): number => {
  switch (weather) {
    case 'sunny':  return 0;
    case 'cloudy': return -1;
    case 'rain':   return -3;
    case 'storm':  return -6;
  }
};
