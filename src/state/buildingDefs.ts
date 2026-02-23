import { BuildingDef, BuildingType, BuildingCategory, ServicePackage, BuildingOffering, GuestSegment, GuestSegmentDef, Building } from './types';

// ── Default Service Packages (with unlockLevel) ─────────────────────

export function createDefaultPackages(buildingType: BuildingType): ServicePackage[] {
  if (buildingType === 'beach_hut') {
    return [
      { id: 'basic', name: 'Basic', pricePerNight: 90, includesFood: false, includesEntertainment: false, includesInfrastructure: false, enabled: true, unlockLevel: 1 },
      { id: 'half_board', name: 'Half Board', pricePerNight: 150, includesFood: true, includesEntertainment: false, includesInfrastructure: false, enabled: false, unlockLevel: 2,
        hardRequirements: [{ buildingType: 'beach_bar' as BuildingType, level: 1 }] },
      { id: 'comfort', name: 'Comfort', pricePerNight: 225, includesFood: true, includesEntertainment: true, includesInfrastructure: false, enabled: false, unlockLevel: 3,
        hardRequirements: [{ buildingType: 'beach_bar' as BuildingType, level: 2 }] },
    ];
  }
  if (buildingType === 'hotel') {
    return [
      { id: 'basic', name: 'Basic', pricePerNight: 150, includesFood: false, includesEntertainment: false, includesInfrastructure: false, enabled: true, unlockLevel: 1 },
      { id: 'half_board', name: 'Half Board', pricePerNight: 270, includesFood: true, includesEntertainment: false, includesInfrastructure: false, enabled: true, unlockLevel: 1,
        hardRequirements: [{ buildingType: 'restaurant' as BuildingType, level: 1 }] },
      { id: 'all_inclusive', name: 'All Inclusive', pricePerNight: 450, includesFood: true, includesEntertainment: true, includesInfrastructure: false, enabled: false, unlockLevel: 2,
        hardRequirements: [{ buildingType: 'restaurant' as BuildingType, level: 1 }] },
      { id: 'premium', name: 'Premium', pricePerNight: 675, includesFood: true, includesEntertainment: true, includesInfrastructure: true, enabled: false, unlockLevel: 3,
        hardRequirements: [{ buildingType: 'restaurant' as BuildingType, level: 2 }] },
    ];
  }
  return [];
}

// ── Default Building Offerings ──────────────────────────────────────

export function createDefaultOfferings(buildingType: BuildingType): BuildingOffering[] {
  switch (buildingType) {
    case 'beach_bar': return [
      { id: 'beer_soda', name: 'Beer & Soda', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'cocktails', name: 'Cocktail Menu', unlockLevel: 2, revenueBonus: 15, happinessBonus: 2, maintenanceCost: 10, capacityBonus: 2, segmentAppeal: { couple: 1.5 }, enabled: false },
      { id: 'premium_spirits', name: 'Premium Spirits', unlockLevel: 3, revenueBonus: 25, happinessBonus: 3, maintenanceCost: 15, capacityBonus: 2, segmentAppeal: { vip: 2.0 }, enabled: false },
    ];
    case 'barbecue': return [
      { id: 'basic_grill', name: 'Basic Grill', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'fast_food_mode', name: 'Fast Food Counter', unlockLevel: 2, revenueBonus: 15, happinessBonus: 1, maintenanceCost: 15, capacityBonus: 5, segmentAppeal: { family: 1.5, nomad: 1.2 }, enabled: false },
      { id: 'gourmet', name: 'Gourmet Grill House', unlockLevel: 3, revenueBonus: 30, happinessBonus: 3, maintenanceCost: 20, capacityBonus: 2, segmentAppeal: { vip: 1.5, couple: 1.3 }, enabled: false },
    ];
    case 'restaurant': return [
      { id: 'buffet', name: 'Buffet', unlockLevel: 1, revenueBonus: 0, happinessBonus: 1, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'alacarte', name: 'A-la-Carte Menu', unlockLevel: 2, revenueBonus: 20, happinessBonus: 3, maintenanceCost: 25, capacityBonus: 4, segmentAppeal: { couple: 1.5 }, enabled: false,
        stayBonusDays: 0.3, needSatisfactionBonus: 10, unlockStories: ['date_night'] },
      { id: 'fine_dining', name: 'Fine Dining', unlockLevel: 3, revenueBonus: 30, happinessBonus: 5, maintenanceCost: 40, capacityBonus: 4, segmentAppeal: { vip: 2.0 }, enabled: false,
        stayBonusDays: 0.2, priceSensitivityModifier: -0.15, needSatisfactionBonus: 20, unlockPackages: ['premium'], unlockStories: ['celebrity_visit'] },
    ];
    case 'kiosk': return [
      { id: 'soda_water', name: 'Drinks & Water', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'ice_cream', name: 'Ice Cream & Gelato', unlockLevel: 2, revenueBonus: 10, happinessBonus: 1, maintenanceCost: 5, capacityBonus: 4, segmentAppeal: { family: 1.5 }, enabled: false },
      { id: 'snack_bar', name: 'Snack Bar', unlockLevel: 3, revenueBonus: 15, happinessBonus: 2, maintenanceCost: 10, capacityBonus: 4, segmentAppeal: { family: 1.3, nomad: 1.2 }, enabled: false },
    ];
    case 'arcade': return [
      { id: 'classic_games', name: 'Classic Games', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'bowling', name: 'Bowling Alley', unlockLevel: 2, revenueBonus: 20, happinessBonus: 2, maintenanceCost: 15, capacityBonus: 3, segmentAppeal: { family: 1.5 }, enabled: false },
      { id: 'vr_zone', name: 'VR Gaming Zone', unlockLevel: 3, revenueBonus: 30, happinessBonus: 3, maintenanceCost: 20, capacityBonus: 3, segmentAppeal: { couple: 1.3, nomad: 1.3 }, enabled: false },
    ];
    case 'main_pool': return [
      { id: 'swimming', name: 'Swimming Pool', unlockLevel: 1, revenueBonus: 0, happinessBonus: 1, maintenanceCost: 0, capacityBonus: 0, enabled: true,
        stayBonusDays: 0.15, happinessDecayReduction: 0.1 },
      { id: 'water_slides', name: 'Water Slides & Kids Pool', unlockLevel: 2, revenueBonus: 0, happinessBonus: 3, maintenanceCost: 20, capacityBonus: 5, segmentAppeal: { family: 2.0 }, enabled: false,
        stayBonusDays: 0.2, happinessDecayReduction: 0.1, packageUpgradeChance: 0.05 },
      { id: 'infinity_pool', name: 'Infinity Pool & Jacuzzi', unlockLevel: 3, revenueBonus: 0, happinessBonus: 5, maintenanceCost: 30, capacityBonus: 5, segmentAppeal: { vip: 2.0, couple: 1.5 }, enabled: false,
        stayBonusDays: 0.15, happinessDecayReduction: 0.1, priceSensitivityModifier: -0.1, packageUpgradeChance: 0.08 },
    ];
    case 'toilet': return [
      { id: 'basic_wc', name: 'Basic Facilities', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'showers', name: 'Showers & Baby Changing', unlockLevel: 2, revenueBonus: 0, happinessBonus: 1, maintenanceCost: 10, capacityBonus: 5, segmentAppeal: { family: 1.5 }, enabled: false },
    ];
    case 'power_gen': return [
      { id: 'diesel', name: 'Diesel Generator', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'solar', name: 'Solar Panels', unlockLevel: 2, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, powerBonus: 4, maintenanceReduction: 0.3, enabled: false },
    ];
    case 'spa': return [
      { id: 'massage', name: 'Basic Massage', unlockLevel: 1, revenueBonus: 0, happinessBonus: 1, maintenanceCost: 0, capacityBonus: 0, enabled: true,
        happinessDecayReduction: 0.1 },
      { id: 'hot_stone', name: 'Hot Stone Therapy', unlockLevel: 2, revenueBonus: 20, happinessBonus: 3, maintenanceCost: 20, capacityBonus: 3, segmentAppeal: { vip: 2.0 }, enabled: false,
        stayBonusDays: 0.2, happinessDecayReduction: 0.1, priceSensitivityModifier: -0.05, unlockStories: ['wellness_retreat'] },
      { id: 'wellness', name: 'Wellness Center', unlockLevel: 3, revenueBonus: 30, happinessBonus: 5, maintenanceCost: 30, capacityBonus: 3, segmentAppeal: { vip: 2.0, couple: 1.5 }, enabled: false,
        stayBonusDays: 0.3, happinessDecayReduction: 0.15, priceSensitivityModifier: -0.1, packageUpgradeChance: 0.1 },
    ];
    case 'mini_golf': return [
      { id: 'basic_course', name: 'Basic Course', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'adventure', name: 'Adventure Course', unlockLevel: 2, revenueBonus: 15, happinessBonus: 2, maintenanceCost: 10, capacityBonus: 4, segmentAppeal: { family: 1.5 }, enabled: false },
    ];
    case 'gift_shop': return [
      { id: 'basics', name: 'Postcards & Trinkets', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'souvenirs', name: 'Souvenirs & Local Crafts', unlockLevel: 2, revenueBonus: 15, happinessBonus: 1, maintenanceCost: 10, capacityBonus: 4, segmentAppeal: { family: 1.3 }, enabled: false },
      { id: 'boutique', name: 'Premium Boutique', unlockLevel: 3, revenueBonus: 25, happinessBonus: 2, maintenanceCost: 15, capacityBonus: 4, segmentAppeal: { vip: 1.5, couple: 1.3 }, enabled: false },
    ];
    // Phase 1 new buildings
    case 'equipment_hire': return [
      { id: 'basic_gear', name: 'Beach Gear', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'premium_gear', name: 'Premium Equipment', unlockLevel: 2, revenueBonus: 15, happinessBonus: 2, maintenanceCost: 10, capacityBonus: 3, segmentAppeal: { couple: 1.3 }, enabled: false },
    ];
    case 'windsurfing': return [
      { id: 'basic_surf', name: 'Windsurfing', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'kitesurf', name: 'Kitesurfing', unlockLevel: 2, revenueBonus: 15, happinessBonus: 2, maintenanceCost: 15, capacityBonus: 2, segmentAppeal: { couple: 1.5, nomad: 1.3 }, enabled: false },
    ];
    case 'cocktail_bar': return [
      { id: 'classic', name: 'Classic Cocktails', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'molecular', name: 'Molecular Mixology', unlockLevel: 2, revenueBonus: 20, happinessBonus: 2, maintenanceCost: 15, capacityBonus: 2, segmentAppeal: { vip: 2.0, couple: 1.5 }, enabled: false },
      { id: 'tiki', name: 'Tiki Lounge', unlockLevel: 3, revenueBonus: 25, happinessBonus: 3, maintenanceCost: 20, capacityBonus: 3, segmentAppeal: { couple: 1.5, nomad: 1.3 }, enabled: false },
    ];
    case 'casino': return [
      { id: 'slots', name: 'Slot Machines', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'poker', name: 'Poker Tables', unlockLevel: 2, revenueBonus: 40, happinessBonus: 3, maintenanceCost: 25, capacityBonus: 4, segmentAppeal: { vip: 2.0 }, enabled: false },
      { id: 'roulette', name: 'Roulette & High Rollers', unlockLevel: 3, revenueBonus: 60, happinessBonus: 4, maintenanceCost: 40, capacityBonus: 4, segmentAppeal: { vip: 2.5 }, enabled: false },
    ];
    case 'fun_pool': return [
      { id: 'wave_pool', name: 'Wave Pool', unlockLevel: 1, revenueBonus: 0, happinessBonus: 1, maintenanceCost: 0, capacityBonus: 0, enabled: true,
        stayBonusDays: 0.2, happinessDecayReduction: 0.1 },
      { id: 'lazy_river', name: 'Lazy River', unlockLevel: 2, revenueBonus: 0, happinessBonus: 3, maintenanceCost: 25, capacityBonus: 6, segmentAppeal: { family: 2.0, couple: 1.3 }, enabled: false,
        stayBonusDays: 0.2, happinessDecayReduction: 0.1, packageUpgradeChance: 0.06 },
      { id: 'mega_slides', name: 'Mega Slides', unlockLevel: 3, revenueBonus: 0, happinessBonus: 5, maintenanceCost: 30, capacityBonus: 8, segmentAppeal: { family: 2.0, nomad: 1.5 }, enabled: false,
        stayBonusDays: 0.2, happinessDecayReduction: 0.1, packageUpgradeChance: 0.08 },
    ];
    case 'jacuzzi': return [
      { id: 'hot_tub', name: 'Hot Tub', unlockLevel: 1, revenueBonus: 0, happinessBonus: 1, maintenanceCost: 0, capacityBonus: 0, enabled: true,
        stayBonusDays: 0.1, happinessDecayReduction: 0.1 },
      { id: 'couples_spa', name: 'Couples Spa Pool', unlockLevel: 2, revenueBonus: 0, happinessBonus: 3, maintenanceCost: 15, capacityBonus: 2, segmentAppeal: { vip: 2.0, couple: 2.0 }, enabled: false,
        stayBonusDays: 0.15, happinessDecayReduction: 0.1, priceSensitivityModifier: -0.05 },
    ];
    // Economy overhaul — new buildings
    case 'kids_club': return [
      { id: 'playroom', name: 'Basic Playroom', unlockLevel: 1, revenueBonus: 0, happinessBonus: 1, maintenanceCost: 0, capacityBonus: 0, enabled: true,
        stayBonusDays: 0.3, happinessDecayReduction: 0.15, segmentAppeal: { family: 2.0 } },
      { id: 'creative_workshop', name: 'Creative Workshop', unlockLevel: 2, revenueBonus: 0, happinessBonus: 3, maintenanceCost: 20, capacityBonus: 4, enabled: false,
        stayBonusDays: 0.3, happinessDecayReduction: 0.1, packageUpgradeChance: 0.08, segmentAppeal: { family: 2.5 } },
      { id: 'premium_kids', name: 'Premium Kids Club', unlockLevel: 3, revenueBonus: 0, happinessBonus: 5, maintenanceCost: 30, capacityBonus: 6, enabled: false,
        stayBonusDays: 0.4, happinessDecayReduction: 0.15, packageUpgradeChance: 0.12, priceSensitivityModifier: -0.1, segmentAppeal: { family: 3.0 },
        unlockStories: ['family_loyalty'] },
    ];
    case 'gym': return [
      { id: 'basic_gym', name: 'Basic Gym', unlockLevel: 1, revenueBonus: 0, happinessBonus: 1, maintenanceCost: 0, capacityBonus: 0, enabled: true,
        happinessDecayReduction: 0.1 },
      { id: 'fitness_classes', name: 'Fitness Classes', unlockLevel: 2, revenueBonus: 0, happinessBonus: 2, maintenanceCost: 15, capacityBonus: 4, enabled: false,
        stayBonusDays: 0.15, happinessDecayReduction: 0.1, segmentAppeal: { couple: 1.3, nomad: 1.3 } },
    ];
    case 'concierge': return [
      { id: 'basic_desk', name: 'Guest Services', unlockLevel: 1, revenueBonus: 0, happinessBonus: 0, maintenanceCost: 0, capacityBonus: 0, enabled: true },
      { id: 'premium_concierge', name: 'Premium Concierge', unlockLevel: 2, revenueBonus: 0, happinessBonus: 2, maintenanceCost: 20, capacityBonus: 0, enabled: false,
        happinessDecayReduction: 0.1, packageUpgradeChance: 0.05, segmentAppeal: { vip: 2.0 } },
    ];
    case 'coworking': return [
      { id: 'basic_desks', name: 'Basic Desks & WiFi', unlockLevel: 1, revenueBonus: 0, happinessBonus: 1, maintenanceCost: 0, capacityBonus: 0, enabled: true,
        stayBonusDays: 0.3, segmentAppeal: { nomad: 2.0 } },
      { id: 'fast_wifi', name: 'Fast WiFi & Coffee Bar', unlockLevel: 2, revenueBonus: 10, happinessBonus: 2, maintenanceCost: 20, capacityBonus: 4, enabled: false,
        stayBonusDays: 0.4, happinessDecayReduction: 0.1, priceSensitivityModifier: -0.1, segmentAppeal: { nomad: 2.5, couple: 1.2 },
        unlockStories: ['nomad_community'] },
      { id: 'meeting_rooms', name: 'Meeting Rooms & Podcast Studio', unlockLevel: 3, revenueBonus: 20, happinessBonus: 3, maintenanceCost: 30, capacityBonus: 4, enabled: false,
        stayBonusDays: 0.5, happinessDecayReduction: 0.1, priceSensitivityModifier: -0.15, packageUpgradeChance: 0.08, segmentAppeal: { nomad: 3.0, vip: 1.3 } },
    ];
    case 'event_space': return [
      { id: 'dj_disco', name: 'DJ & Beach Disco', unlockLevel: 1, revenueBonus: 0, happinessBonus: 1, maintenanceCost: 0, capacityBonus: 0, enabled: true,
        stayBonusDays: 0.15, segmentAppeal: { nomad: 1.5 } },
      { id: 'club_nights', name: 'Club Nights & Themed Parties', unlockLevel: 2, revenueBonus: 15, happinessBonus: 3, maintenanceCost: 25, capacityBonus: 8, enabled: false,
        stayBonusDays: 0.2, happinessDecayReduction: 0.1, packageUpgradeChance: 0.05,
        segmentAppeal: { vip: 2.0, couple: 1.5 } },
      { id: 'live_shows', name: 'Live Shows & Concerts', unlockLevel: 3, revenueBonus: 25, happinessBonus: 5, maintenanceCost: 40, capacityBonus: 10, enabled: false,
        stayBonusDays: 0.3, happinessDecayReduction: 0.15, packageUpgradeChance: 0.1, priceSensitivityModifier: -0.1,
        segmentAppeal: { vip: 2.0, couple: 1.5, family: 1.5 },
        unlockStories: ['grand_event'] },
    ];
    default: return [];
  }
}

// ── Guest Segment Definitions ───────────────────────────────────────

export const GUEST_SEGMENT_DEFS: Record<GuestSegment, GuestSegmentDef> = {
  family: {
    segment: 'family',
    label: 'Family',
    color: '#00b894',
    preferredPackage: 'all_inclusive',
    priceSensitivity: 0.5,
    ancillarySpendRate: 1.0,
    reputationWeight: 1.5,
    budgetMin: 600,
    budgetMax: 1500,
    stayMin: 3,
    stayMax: 5,
    happinessBase: 50,
    happinessRange: 15,
    needMultipliers: { hunger: 1.6, thirst: 1.4, fun: 1.7, relaxation: 0.8, toilet: 1.5, accommodation: 1.0, beach: 1.5, stroll: 1.2 },
    spawnWeight: 30,
    spendPerDay: 150,
    maxVisitsPerCategory: 2,
  },
  couple: {
    segment: 'couple',
    label: 'Couple',
    color: '#fd79a8',
    preferredPackage: 'half_board',
    priceSensitivity: 0.4,
    ancillarySpendRate: 1.2,
    reputationWeight: 1.0,
    budgetMin: 750,
    budgetMax: 1800,
    stayMin: 2,
    stayMax: 4,
    happinessBase: 55,
    happinessRange: 15,
    needMultipliers: { hunger: 1.1, thirst: 1.5, fun: 1.1, relaxation: 1.6, toilet: 1.1, accommodation: 1.0, beach: 1.8, stroll: 1.5 },
    spawnWeight: 25,
    spendPerDay: 180,
    maxVisitsPerCategory: 2,
  },
  nomad: {
    segment: 'nomad',
    label: 'Nomad',
    color: '#0984e3',
    preferredPackage: 'basic',
    priceSensitivity: 0.85,
    ancillarySpendRate: 0.5,
    reputationWeight: 0.7,
    budgetMin: 300,
    budgetMax: 825,
    stayMin: 3,
    stayMax: 6,
    happinessBase: 50,
    happinessRange: 15,
    needMultipliers: { hunger: 1.0, thirst: 1.1, fun: 0.8, relaxation: 1.3, toilet: 1.1, accommodation: 1.0, beach: 1.0, stroll: 1.3 },
    spawnWeight: 20,
    spendPerDay: 80,
    maxVisitsPerCategory: 2,
  },
  vip: {
    segment: 'vip',
    label: 'VIP',
    color: '#fdcb6e',
    preferredPackage: 'premium',
    priceSensitivity: 0.1,
    ancillarySpendRate: 2.5,
    reputationWeight: 2.0,
    budgetMin: 1800,
    budgetMax: 3750,
    stayMin: 2,
    stayMax: 3,
    happinessBase: 35,
    happinessRange: 15,
    needMultipliers: { hunger: 1.3, thirst: 1.3, fun: 1.4, relaxation: 1.6, toilet: 1.3, accommodation: 1.0, beach: 0.8, stroll: 0.6 },
    spawnWeight: 10,
    spendPerDay: 400,
    maxVisitsPerCategory: 3,
  },
  local: {
    segment: 'local',
    label: 'Local',
    color: '#b2bec3',
    preferredPackage: '',
    priceSensitivity: 0.7,
    ancillarySpendRate: 0.6,
    reputationWeight: 0.5,
    budgetMin: 150,
    budgetMax: 525,
    stayMin: 0,
    stayMax: 0,
    happinessBase: 60,
    happinessRange: 15,
    needMultipliers: { hunger: 1.3, thirst: 1.5, fun: 1.4, relaxation: 0.6, toilet: 1.3, accommodation: 0, beach: 1.2, stroll: 1.0 },
    spawnWeight: 15,
    spendPerDay: 100,
    maxVisitsPerCategory: 2,
  },
};

// ── Building Definitions ────────────────────────────────────────────

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  // ── Accommodation (Revenue Drivers) ──────────────────────────────
  beach_hut: {
    type: 'beach_hut', name: 'Beach Hut', category: 'accommodation', role: 'revenue_driver',
    width: 2, height: 2, cost: 2250, maintenanceCost: 60,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 2,
    satisfiesNeed: 'accommodation', label: 'HUT', color: '#e17055',
    powerConsumption: 1, powerProduction: 0, constructionDays: 1.0,
    maxLevel: 3, upgradeCostMultiplier: 1.5,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultPackages: createDefaultPackages('beach_hut'),
    requiresPower: false,
  },
  hotel: {
    type: 'hotel', name: 'Hotel', category: 'accommodation', role: 'revenue_driver',
    width: 4, height: 3, cost: 12750, maintenanceCost: 500,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 8,
    satisfiesNeed: 'accommodation', label: 'HTL', color: '#d63031',
    powerConsumption: 3, powerProduction: 0, constructionDays: 2.0,
    maxLevel: 3, upgradeCostMultiplier: 1.8,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultPackages: createDefaultPackages('hotel'),
    terrain: 'land',
  },

  // ── Food & Drink (Revenue Drivers) ───────────────────────────────
  beach_bar: {
    type: 'beach_bar', name: 'Beach Bar', category: 'food_drink', role: 'revenue_driver',
    width: 2, height: 1, cost: 1200, maintenanceCost: 80,
    incomePerVisit: 15, incomePerGuestPerDay: 0, capacity: 6,
    satisfiesNeed: 'thirst', label: 'BAR', color: '#e84393',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 3, upgradeCostMultiplier: 1.4,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('beach_bar'),
  },
  barbecue: {
    type: 'barbecue', name: 'Barbecue', category: 'food_drink', role: 'revenue_driver',
    width: 2, height: 1, cost: 1425, maintenanceCost: 90,
    incomePerVisit: 20, incomePerGuestPerDay: 0, capacity: 4,
    satisfiesNeed: 'hunger', label: 'BBQ', color: '#fdcb6e',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 3, upgradeCostMultiplier: 1.4,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('barbecue'),
  },
  restaurant: {
    type: 'restaurant', name: 'Restaurant', category: 'food_drink', role: 'revenue_driver',
    width: 3, height: 2, cost: 7200, maintenanceCost: 280,
    incomePerVisit: 30, incomePerGuestPerDay: 0, capacity: 10,
    satisfiesNeed: 'hunger', label: 'REST', color: '#e17055',
    powerConsumption: 2, powerProduction: 0, constructionDays: 1.0,
    maxLevel: 3, upgradeCostMultiplier: 1.6,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('restaurant'),
    terrain: 'land',
  },
  kiosk: {
    type: 'kiosk', name: 'Snack & Drinks Kiosk', category: 'food_drink', role: 'revenue_driver',
    width: 2, height: 1, cost: 750, maintenanceCost: 35,
    incomePerVisit: 10, incomePerGuestPerDay: 0, capacity: 8,
    satisfiesNeed: 'thirst', label: 'KIOSK', color: '#74b9ff',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 3, upgradeCostMultiplier: 1.3,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('kiosk'),
  },

  // ── Entertainment ────────────────────────────────────────────────
  arcade: {
    type: 'arcade', name: 'Game Room', category: 'entertainment', role: 'experience_driver',
    width: 2, height: 2, cost: 2700, maintenanceCost: 150,
    incomePerVisit: 5, incomePerGuestPerDay: 0, capacity: 6,
    satisfiesNeed: 'fun', label: 'GAME', color: '#6c5ce7',
    powerConsumption: 2, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 3, upgradeCostMultiplier: 1.5,
    stayBonusDays: 0.15, happinessDecayReduction: 0.1, packageUpgradeChance: 0.03, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('arcade'),
    terrain: 'land',
  },
  main_pool: {
    type: 'main_pool', name: 'Main Pool', category: 'entertainment', role: 'experience_driver',
    width: 3, height: 3, cost: 9000, maintenanceCost: 350,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 15,
    satisfiesNeed: 'relaxation', label: 'POOL', color: '#00cec9',
    powerConsumption: 3, powerProduction: 0, constructionDays: 2.0,
    maxLevel: 3, upgradeCostMultiplier: 1.8,
    stayBonusDays: 0.3, happinessDecayReduction: 0.15, packageUpgradeChance: 0.03, priceSensitivityModifier: -0.05,
    defaultOfferings: createDefaultOfferings('main_pool'),
    terrain: 'land',
  },

  // ── Infrastructure (Risk Mitigators) ─────────────────────────────
  toilet: {
    type: 'toilet', name: 'Toilet Block', category: 'infrastructure', role: 'risk_mitigator',
    width: 1, height: 1, cost: 900, maintenanceCost: 30,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 10,
    satisfiesNeed: 'toilet', label: 'WC', color: '#dfe6e9',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 2, upgradeCostMultiplier: 1.3,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('toilet'),
  },
  cleaners_shack: {
    type: 'cleaners_shack', name: 'Cleaners Shack', category: 'infrastructure', role: 'risk_mitigator',
    width: 1, height: 1, cost: 1350, maintenanceCost: 40,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 0,
    satisfiesNeed: null, label: 'CLN', color: '#b2bec3',
    powerConsumption: 0, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 1, upgradeCostMultiplier: 1.0,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
  },
  power_gen: {
    type: 'power_gen', name: 'Power Generator', category: 'infrastructure', role: 'risk_mitigator',
    width: 1, height: 1, cost: 2250, maintenanceCost: 80,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 0,
    satisfiesNeed: null, label: 'PWR', color: '#636e72',
    powerConsumption: 0, powerProduction: 8, constructionDays: 0.5,
    maxLevel: 2, upgradeCostMultiplier: 2.0,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('power_gen'),
    terrain: 'land',
  },

  // ── Phase 1: New Buildings ──────────────────────────────────────

  beach_shower: {
    type: 'beach_shower', name: 'Beach Shower', category: 'infrastructure', role: 'risk_mitigator',
    width: 1, height: 1, cost: 600, maintenanceCost: 20,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 4,
    satisfiesNeed: null, label: 'SHW', color: '#81ecec',
    powerConsumption: 0, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 1, upgradeCostMultiplier: 1.0,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    terrain: 'beach',
  },
  equipment_hire: {
    type: 'equipment_hire', name: 'Equipment Hire', category: 'entertainment', role: 'experience_driver',
    width: 2, height: 1, cost: 1200, maintenanceCost: 55,
    incomePerVisit: 15, incomePerGuestPerDay: 0, capacity: 6,
    satisfiesNeed: 'fun', label: 'EQPT', color: '#00cec9',
    powerConsumption: 0, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 2, upgradeCostMultiplier: 1.4,
    stayBonusDays: 0.1, happinessDecayReduction: 0.05, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('equipment_hire'),
    terrain: 'beach',
  },
  baywatch_tower: {
    type: 'baywatch_tower', name: 'Baywatch Tower', category: 'infrastructure', role: 'risk_mitigator',
    width: 1, height: 1, cost: 1500, maintenanceCost: 60,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 0,
    satisfiesNeed: null, label: 'LIFE', color: '#ff7675',
    powerConsumption: 0, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 1, upgradeCostMultiplier: 1.0,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    terrain: 'beach',
  },

  // Tier 2 — Star 2+
  rep_office: {
    type: 'rep_office', name: 'Rep Office', category: 'infrastructure', role: 'risk_mitigator',
    width: 2, height: 1, cost: 1800, maintenanceCost: 80,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 0,
    satisfiesNeed: null, label: 'REP', color: '#a29bfe',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 2, upgradeCostMultiplier: 1.5,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    unlockRequirements: [{ buildingType: 'hotel', level: 1 }],
  },

  // Tier 3 — Star 3+
  handyman_shack: {
    type: 'handyman_shack', name: 'Handyman Shack', category: 'infrastructure', role: 'risk_mitigator',
    width: 1, height: 1, cost: 1650, maintenanceCost: 55,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 0,
    satisfiesNeed: null, label: 'FIX', color: '#636e72',
    powerConsumption: 0, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 1, upgradeCostMultiplier: 1.0,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    unlockRequirements: [{ buildingType: 'power_gen', level: 2 }],
    terrain: 'land',
  },
  windsurfing: {
    type: 'windsurfing', name: 'Windsurfing Hire', category: 'entertainment', role: 'experience_driver',
    width: 2, height: 1, cost: 1350, maintenanceCost: 60,
    incomePerVisit: 15, incomePerGuestPerDay: 0, capacity: 4,
    satisfiesNeed: 'fun', label: 'SURF', color: '#0984e3',
    powerConsumption: 0, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 2, upgradeCostMultiplier: 1.4,
    stayBonusDays: 0.1, happinessDecayReduction: 0.05, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('windsurfing'),
    unlockRequirements: [{ buildingType: 'equipment_hire', level: 2 }],
    terrain: 'beach',
  },
  cocktail_bar: {
    type: 'cocktail_bar', name: 'Cocktail Bar', category: 'food_drink', role: 'revenue_driver',
    width: 2, height: 1, cost: 1950, maintenanceCost: 100,
    incomePerVisit: 25, incomePerGuestPerDay: 0, capacity: 6,
    satisfiesNeed: 'thirst', label: 'CKTL', color: '#fd79a8',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 3, upgradeCostMultiplier: 1.5,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('cocktail_bar'),
    unlockRequirements: [{ buildingType: 'beach_bar', level: 2 }],
  },

  // Tier 4 — Star 4+
  security_post: {
    type: 'security_post', name: 'Security Post', category: 'infrastructure', role: 'risk_mitigator',
    width: 1, height: 1, cost: 2250, maintenanceCost: 80,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 0,
    satisfiesNeed: null, label: 'SEC', color: '#2d3436',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 2, upgradeCostMultiplier: 1.5,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    unlockRequirements: [{ buildingType: 'hotel', level: 2 }],
    terrain: 'land',
  },
  first_aid: {
    type: 'first_aid', name: 'First Aid Station', category: 'infrastructure', role: 'risk_mitigator',
    width: 1, height: 1, cost: 1350, maintenanceCost: 55,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 4,
    satisfiesNeed: null, label: 'AID', color: '#ff6b6b',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 1, upgradeCostMultiplier: 1.0,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    unlockRequirements: [{ buildingType: 'baywatch_tower', level: 1 }],
  },

  // Tier 5 — Star 5
  casino: {
    type: 'casino', name: 'Casino', category: 'entertainment', role: 'revenue_driver',
    width: 3, height: 3, cost: 10200, maintenanceCost: 350,
    incomePerVisit: 50, incomePerGuestPerDay: 0, capacity: 12,
    satisfiesNeed: 'fun', label: 'CASN', color: '#d4a017',
    powerConsumption: 4, powerProduction: 0, constructionDays: 2.0,
    maxLevel: 3, upgradeCostMultiplier: 1.8,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('casino'),
    unlockRequirements: [{ buildingType: 'event_space', level: 2 }],
    terrain: 'land',
    requiresStaff: 'security',
    requiredStaffCount: 1,
  },
  fun_pool: {
    type: 'fun_pool', name: 'Fun Pool', category: 'entertainment', role: 'experience_driver',
    width: 3, height: 3, cost: 8400, maintenanceCost: 260,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 18,
    satisfiesNeed: 'fun', label: 'FPOOL', color: '#00b894',
    powerConsumption: 3, powerProduction: 0, constructionDays: 2.0,
    maxLevel: 3, upgradeCostMultiplier: 1.7,
    stayBonusDays: 0.4, happinessDecayReduction: 0.2, packageUpgradeChance: 0.05, priceSensitivityModifier: -0.05,
    defaultOfferings: createDefaultOfferings('fun_pool'),
    unlockRequirements: [{ buildingType: 'main_pool', level: 3 }],
    terrain: 'land',
  },
  jacuzzi: {
    type: 'jacuzzi', name: 'Jacuzzi', category: 'entertainment', role: 'experience_driver',
    width: 2, height: 2, cost: 3300, maintenanceCost: 120,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 4,
    satisfiesNeed: 'relaxation', label: 'JAC', color: '#74b9ff',
    powerConsumption: 2, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 2, upgradeCostMultiplier: 1.4,
    stayBonusDays: 0.2, happinessDecayReduction: 0.1, packageUpgradeChance: 0.03, priceSensitivityModifier: -0.03,
    defaultOfferings: createDefaultOfferings('jacuzzi'),
    unlockRequirements: [{ buildingType: 'spa', level: 2 }],
  },

  // ── Unlockable Buildings (existing) ────────────────────────────────
  spa: {
    type: 'spa', name: 'Spa', category: 'entertainment', role: 'revenue_driver',
    width: 3, height: 2, cost: 8400, maintenanceCost: 260,
    incomePerVisit: 30, incomePerGuestPerDay: 0, capacity: 6,
    satisfiesNeed: 'relaxation', label: 'SPA', color: '#fab1a0',
    powerConsumption: 2, powerProduction: 0, constructionDays: 1.5,
    maxLevel: 3, upgradeCostMultiplier: 1.6,
    stayBonusDays: 0.15, happinessDecayReduction: 0.1, packageUpgradeChance: 0.05, priceSensitivityModifier: -0.05,
    defaultOfferings: createDefaultOfferings('spa'),
    unlockRequirements: [{ buildingType: 'main_pool', level: 2 }],
    terrain: 'land',
    requiresStaff: 'mechanics',
    requiredStaffCount: 1,
  },
  mini_golf: {
    type: 'mini_golf', name: 'Mini Golf', category: 'entertainment', role: 'experience_driver',
    width: 3, height: 2, cost: 3600, maintenanceCost: 140,
    incomePerVisit: 15, incomePerGuestPerDay: 0, capacity: 8,
    satisfiesNeed: 'fun', label: 'GOLF', color: '#55efc4',
    powerConsumption: 1, powerProduction: 0, constructionDays: 1.0,
    maxLevel: 2, upgradeCostMultiplier: 1.4,
    stayBonusDays: 0.1, happinessDecayReduction: 0.05, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('mini_golf'),
    unlockRequirements: [{ buildingType: 'kids_club', level: 2 }],
    terrain: 'land',
  },
  gift_shop: {
    type: 'gift_shop', name: 'Gift & Souvenir Shop', category: 'food_drink', role: 'revenue_driver',
    width: 2, height: 1, cost: 1800, maintenanceCost: 60,
    incomePerVisit: 15, incomePerGuestPerDay: 0, capacity: 8,
    satisfiesNeed: 'fun', label: 'GIFT', color: '#ffeaa7',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 3, upgradeCostMultiplier: 1.3,
    stayBonusDays: 0, happinessDecayReduction: 0, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('gift_shop'),
    unlockRequirements: [{ buildingType: 'hotel', level: 2 }],
  },

  // ── Economy Overhaul: New Buildings ─────────────────────────────
  kids_club: {
    type: 'kids_club', name: 'Kids Club', category: 'entertainment', role: 'experience_driver',
    width: 3, height: 2, cost: 5100, maintenanceCost: 190,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 10,
    satisfiesNeed: 'fun', label: 'KIDS', color: '#fdcb6e',
    powerConsumption: 1, powerProduction: 0, constructionDays: 1.0,
    maxLevel: 3, upgradeCostMultiplier: 1.5,
    stayBonusDays: 0.5, happinessDecayReduction: 0.2, packageUpgradeChance: 0.08, priceSensitivityModifier: -0.05,
    defaultOfferings: createDefaultOfferings('kids_club'),
    unlockRequirements: [{ buildingType: 'hotel', level: 1 }],
    terrain: 'land',
    requiresStaff: 'animators',
    requiredStaffCount: 1,
  },
  gym: {
    type: 'gym', name: 'Gym & Wellness', category: 'entertainment', role: 'experience_driver',
    width: 2, height: 2, cost: 3000, maintenanceCost: 110,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 8,
    satisfiesNeed: 'relaxation', label: 'GYM', color: '#00b894',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 2, upgradeCostMultiplier: 1.4,
    stayBonusDays: 0.1, happinessDecayReduction: 0.1, packageUpgradeChance: 0, priceSensitivityModifier: 0,
    defaultOfferings: createDefaultOfferings('gym'),
    unlockRequirements: [{ buildingType: 'hotel', level: 1 }],
    terrain: 'land',
  },
  concierge: {
    type: 'concierge', name: 'Concierge Desk', category: 'infrastructure', role: 'risk_mitigator',
    width: 2, height: 1, cost: 3450, maintenanceCost: 100,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 0,
    satisfiesNeed: null, label: 'CONC', color: '#a29bfe',
    powerConsumption: 1, powerProduction: 0, constructionDays: 0.5,
    maxLevel: 2, upgradeCostMultiplier: 1.5,
    stayBonusDays: 0, happinessDecayReduction: 0.1, packageUpgradeChance: 0.03, priceSensitivityModifier: -0.05,
    defaultOfferings: createDefaultOfferings('concierge'),
    unlockRequirements: [{ buildingType: 'hotel', level: 3 }],
    terrain: 'land',
  },

  // ── Phase 3: New Buildings ──────────────────────────────────────────
  coworking: {
    type: 'coworking', name: 'Coworking Space', category: 'entertainment', role: 'experience_driver',
    width: 2, height: 2, cost: 5100, maintenanceCost: 150,
    incomePerVisit: 10, incomePerGuestPerDay: 0, capacity: 8,
    satisfiesNeed: 'relaxation', label: 'COWK', color: '#0984e3',
    powerConsumption: 2, powerProduction: 0, constructionDays: 1.0,
    maxLevel: 3, upgradeCostMultiplier: 1.5,
    stayBonusDays: 0.6, happinessDecayReduction: 0.05, packageUpgradeChance: 0, priceSensitivityModifier: -0.15,
    defaultOfferings: createDefaultOfferings('coworking'),
    unlockRequirements: [{ buildingType: 'hotel', level: 2 }],
    terrain: 'land',
  },
  event_space: {
    type: 'event_space', name: 'Event Space', category: 'entertainment', role: 'experience_driver',
    width: 3, height: 3, cost: 8400, maintenanceCost: 260,
    incomePerVisit: 0, incomePerGuestPerDay: 0, capacity: 20,
    satisfiesNeed: 'fun', label: 'EVNT', color: '#e84393',
    powerConsumption: 3, powerProduction: 0, constructionDays: 1.5,
    maxLevel: 3, upgradeCostMultiplier: 1.6,
    stayBonusDays: 0.3, happinessDecayReduction: 0.1, packageUpgradeChance: 0.05, priceSensitivityModifier: -0.05,
    defaultOfferings: createDefaultOfferings('event_space'),
    unlockRequirements: [{ buildingType: 'hotel', level: 2 }],
    terrain: 'land',
    requiresStaff: 'animators',
    requiredStaffCount: 1,
  },
};

// ── Offering-Aware Effective Stats ──────────────────────────────────

function sumActiveOfferings(building: Building): { revenue: number; happiness: number; maintenance: number; capacity: number; power: number; maintReduction: number } {
  let revenue = 0, happiness = 0, maintenance = 0, capacity = 0, power = 0, maintReduction = 0;
  for (const o of building.offerings) {
    if (!o.enabled || o.unlockLevel > building.level) continue;
    revenue += o.revenueBonus;
    happiness += o.happinessBonus;
    maintenance += o.maintenanceCost;
    capacity += o.capacityBonus;
    if (o.powerBonus) power += o.powerBonus;
    if (o.maintenanceReduction) maintReduction = Math.max(maintReduction, o.maintenanceReduction);
  }
  return { revenue, happiness, maintenance, capacity, power, maintReduction };
}

export function getOfferingHappinessForGuest(building: Building, segment: GuestSegment): number {
  let total = 0;
  for (const o of building.offerings) {
    if (!o.enabled || o.unlockLevel > building.level) continue;
    const appeal = o.segmentAppeal?.[segment] ?? 1.0;
    total += o.happinessBonus * appeal;
  }
  return total;
}

export function getEffectiveCapacity(type: BuildingType, _level: number, building?: Building): number {
  const def = BUILDING_DEFS[type];
  const base = def.capacity;
  const offeringCap = building ? sumActiveOfferings(building).capacity : 0;
  return base + offeringCap;
}

export function getEffectiveIncome(type: BuildingType, _level: number, building?: Building): { perVisit: number; perGuestPerDay: number } {
  const def = BUILDING_DEFS[type];
  const offeringRev = building ? sumActiveOfferings(building).revenue : 0;
  return {
    perVisit: def.incomePerVisit + offeringRev,
    perGuestPerDay: def.incomePerGuestPerDay,
  };
}

export function getEffectiveMaintenance(type: BuildingType, _level: number, building?: Building): number {
  const def = BUILDING_DEFS[type];
  const sums = building ? sumActiveOfferings(building) : { maintenance: 0, maintReduction: 0 };
  const baseMaint = def.maintenanceCost + sums.maintenance;
  return Math.round(baseMaint * (1 - sums.maintReduction));
}

export function getEffectivePower(building: Building): number {
  const def = BUILDING_DEFS[building.type];
  const offeringPower = sumActiveOfferings(building).power;
  return def.powerProduction + offeringPower;
}

// ── Effective Behavior Modifiers (base + active offerings) ──────────

export interface EffectiveBehaviorModifiers {
  stayBonusDays: number;
  happinessDecayReduction: number;
  packageUpgradeChance: number;
  priceSensitivityModifier: number;
  needSatisfactionBonus: number;
}

export function getEffectiveBehaviorModifiers(building: Building): EffectiveBehaviorModifiers {
  const def = BUILDING_DEFS[building.type];
  let stayBonusDays = def.stayBonusDays;
  let happinessDecayReduction = def.happinessDecayReduction;
  let packageUpgradeChance = def.packageUpgradeChance;
  let priceSensitivityModifier = def.priceSensitivityModifier;
  let needSatisfactionBonus = 0;
  for (const o of building.offerings) {
    if (!o.enabled || o.unlockLevel > building.level) continue;
    if (o.stayBonusDays) stayBonusDays += o.stayBonusDays;
    if (o.happinessDecayReduction) happinessDecayReduction += o.happinessDecayReduction;
    if (o.packageUpgradeChance) packageUpgradeChance += o.packageUpgradeChance;
    if (o.priceSensitivityModifier) priceSensitivityModifier += o.priceSensitivityModifier;
    if (o.needSatisfactionBonus) needSatisfactionBonus += o.needSatisfactionBonus;
  }
  return { stayBonusDays, happinessDecayReduction, packageUpgradeChance, priceSensitivityModifier, needSatisfactionBonus };
}

export function getUpgradeCost(type: BuildingType, currentLevel: number): number {
  const def = BUILDING_DEFS[type];
  return Math.round(def.cost * def.upgradeCostMultiplier * currentLevel);
}

export function getEffectivePackagePrice(pkg: ServicePackage, _level: number): number {
  return pkg.pricePerNight;
}

export const ALL_BUILDING_TYPES = Object.keys(BUILDING_DEFS) as BuildingType[];

export function getBuildingDef(type: BuildingType): BuildingDef {
  return BUILDING_DEFS[type];
}

export function getBuildingsByCategory(category: BuildingCategory): BuildingDef[] {
  return ALL_BUILDING_TYPES
    .map(t => BUILDING_DEFS[t])
    .filter(d => d.category === category);
}

export const CATEGORIES: { key: BuildingCategory; label: string }[] = [
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'food_drink', label: 'Food & Drink' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'infrastructure', label: 'Infrastructure' },
];

// ── Building Unlock Check ───────────────────────────────────────────

export function isBuildingUnlocked(type: BuildingType, allBuildings: Building[]): boolean {
  const def = BUILDING_DEFS[type];
  if (!def.unlockRequirements || def.unlockRequirements.length === 0) return true;
  return def.unlockRequirements.every(req =>
    allBuildings.some(b => b.type === req.buildingType && b.level >= req.level && !b.isConstructing)
  );
}

export function getUnlockRequirementsText(type: BuildingType): string | null {
  const def = BUILDING_DEFS[type];
  if (!def.unlockRequirements || def.unlockRequirements.length === 0) return null;
  return def.unlockRequirements
    .map(req => `${BUILDING_DEFS[req.buildingType].name} Lv.${req.level}`)
    .join(' + ');
}

// ── Adjacency Synergy Rules ──────────────────────────────────────────
export const ADJACENCY_SYNERGIES: Partial<Record<BuildingType, BuildingType[]>> = {
  beach_bar:    ['main_pool', 'event_space', 'beach_hut'],
  barbecue:     ['beach_bar', 'main_pool', 'beach_hut'],
  restaurant:   ['hotel', 'event_space', 'spa'],
  arcade:       ['kiosk', 'barbecue', 'kids_club', 'event_space'],
  kids_club:    ['main_pool', 'hotel', 'kiosk', 'mini_golf'],
  gym:          ['hotel', 'spa', 'main_pool'],
  concierge:    ['hotel', 'restaurant', 'spa'],
  main_pool:    ['beach_bar', 'kiosk', 'beach_hut', 'hotel', 'spa'],
  beach_hut:    ['beach_bar', 'barbecue', 'main_pool'],
  hotel:        ['restaurant', 'main_pool', 'arcade', 'spa', 'gift_shop'],
  kiosk:        ['main_pool', 'arcade', 'beach_bar'],
  spa:          ['main_pool', 'hotel', 'restaurant', 'jacuzzi'],
  mini_golf:    ['arcade', 'beach_bar', 'kiosk'],
  gift_shop:    ['hotel', 'restaurant'],
  // Beach & water buildings
  equipment_hire: ['beach_bar', 'beach_hut', 'baywatch_tower'],
  baywatch_tower: ['equipment_hire', 'beach_shower', 'windsurfing'],
  cocktail_bar: ['beach_bar', 'event_space', 'restaurant'],
  windsurfing:  ['equipment_hire', 'baywatch_tower', 'beach_bar'],
  casino:       ['event_space', 'cocktail_bar', 'hotel'],
  fun_pool:     ['main_pool', 'beach_bar', 'kiosk'],
  jacuzzi:      ['spa', 'hotel', 'cocktail_bar'],
  coworking:    ['hotel', 'restaurant', 'cocktail_bar'],
  event_space:  ['cocktail_bar', 'hotel', 'beach_bar'],
};

export const ADJACENCY_PENALTIES: Partial<Record<BuildingType, BuildingType[]>> = {
  beach_hut:    ['power_gen'],
  hotel:        ['power_gen'],
  main_pool:    ['power_gen'],
  spa:          ['power_gen'],
  event_space:  ['beach_hut', 'hotel'],
};

// Helper: check if a building category is included in a guest's package
export function isServiceIncluded(pkg: ServicePackage | null, buildingCategory: BuildingCategory): boolean {
  if (!pkg) return false;
  switch (buildingCategory) {
    case 'food_drink': return pkg.includesFood;
    case 'entertainment': return pkg.includesEntertainment;
    case 'infrastructure': return pkg.includesInfrastructure;
    case 'accommodation': return true;
  }
}
