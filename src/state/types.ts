// ── Tile & Grid ──────────────────────────────────────────────────────

export type TileType = 'sand' | 'water' | 'occupied' | 'unowned' | 'path' | 'beach_sand' | 'parking';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  buildingId?: number;
}

export interface Grid {
  width: number;
  height: number;
  tiles: Tile[][];
}

// ── Building ─────────────────────────────────────────────────────────

export type BuildingCategory =
  | 'accommodation'
  | 'food_drink'
  | 'entertainment'
  | 'infrastructure';

export type BuildingRole = 'revenue_driver' | 'experience_driver' | 'risk_mitigator';

export type NeedType =
  | 'hunger'
  | 'thirst'
  | 'fun'
  | 'relaxation'
  | 'toilet'
  | 'accommodation'
  | 'beach'
  | 'stroll';

export type BuildingType =
  | 'beach_hut'
  | 'hotel'
  | 'beach_bar'
  | 'barbecue'
  | 'restaurant'
  | 'kiosk'
  | 'arcade'
  | 'main_pool'
  | 'toilet'
  | 'cleaners_shack'
  | 'power_gen'
  | 'spa'
  | 'mini_golf'
  | 'gift_shop'
  // Phase 1 new buildings
  | 'beach_shower'
  | 'equipment_hire'
  | 'baywatch_tower'
  | 'rep_office'
  | 'handyman_shack'
  | 'windsurfing'
  | 'cocktail_bar'
  | 'security_post'
  | 'first_aid'
  | 'casino'
  | 'fun_pool'
  | 'jacuzzi'
  // Economy overhaul — new buildings
  | 'kids_club'
  | 'gym'
  | 'concierge'
  // Phase 3 — new buildings
  | 'coworking'
  | 'event_space';

// ── Service Packages (cruise-ship style tiers) ──────────────────────

export interface ServicePackage {
  id: string;
  name: string;
  pricePerNight: number;
  includesFood: boolean;
  includesEntertainment: boolean;
  includesInfrastructure: boolean;
  enabled: boolean;
  unlockLevel: number;        // building level required to offer this package
  hardRequirements?: { buildingType: BuildingType; level: number }[];  // other buildings needed for this package to work
}

// ── Building Offerings (per-building services unlocked by upgrades) ──

export interface BuildingOffering {
  id: string;
  name: string;
  unlockLevel: number;        // 1 = available from start
  revenueBonus: number;       // added to income per visit
  happinessBonus: number;     // extra happiness on visit
  maintenanceCost: number;    // added to daily maintenance
  capacityBonus: number;      // extra guest slots
  powerBonus?: number;        // extra power production (generators)
  maintenanceReduction?: number; // fractional maintenance reduction (generators)
  segmentAppeal?: Partial<Record<GuestSegment, number>>; // happiness multiplier per segment
  enabled: boolean;
  // Economy overhaul — behavior modifiers per offering level
  stayBonusDays?: number;              // extra stay days chance from this offering
  happinessDecayReduction?: number;    // reduce happiness decay rate (0-1 fraction)
  packageUpgradeChance?: number;       // chance to auto-upgrade guest package (0-1)
  priceSensitivityModifier?: number;   // modifier to guest price sensitivity (-0.1 = -10%)
  needSatisfactionBonus?: number;      // extra need reduction on visit (added to base -45)
  unlockBuildings?: BuildingType[];    // buildings unlocked by this offering
  unlockStories?: string[];            // story IDs unlocked by this offering
  unlockPackages?: string[];           // package IDs unlocked by this offering
}

// ── Building Unlock Requirements ────────────────────────────────────

export interface BuildingUnlockReq {
  buildingType: BuildingType;
  level: number;
}

// ── Guest Segments ──────────────────────────────────────────────────

export type GuestSegment = 'family' | 'couple' | 'nomad' | 'vip' | 'local';

export interface GuestSegmentDef {
  segment: GuestSegment;
  label: string;
  color: string;           // body color for rendering
  preferredPackage: string; // package id they prefer
  priceSensitivity: number; // 0-1 (1=very price sensitive)
  ancillarySpendRate: number; // multiplier for per-visit spending
  reputationWeight: number; // how much their happiness affects reputation
  budgetMin: number;
  budgetMax: number;
  stayMin: number;
  stayMax: number;
  happinessBase: number;
  happinessRange: number;
  needMultipliers: Record<NeedType, number>; // need rise speed multiplier
  spawnWeight: number;      // relative spawn probability
  spendPerDay: number;           // max ancillary spend per day ($)
  maxVisitsPerCategory: number;  // max visits per need category per day
}

// ── Building Definitions ────────────────────────────────────────────

export interface BuildingDef {
  type: BuildingType;
  name: string;
  category: BuildingCategory;
  role: BuildingRole;                  // revenue_driver | experience_driver | risk_mitigator
  width: number;
  height: number;
  cost: number;
  maintenanceCost: number;
  incomePerVisit: number;              // ancillary income per visit (non-included services)
  incomePerGuestPerDay: number;        // DEPRECATED: replaced by package pricing for accommodation
  capacity: number;
  satisfiesNeed: NeedType | null;
  label: string;
  color: string;
  powerConsumption: number;
  powerProduction: number;
  constructionDays: number;
  maxLevel: number;
  upgradeCostMultiplier: number;
  defaultPackages?: ServicePackage[];  // only for accommodation buildings
  defaultOfferings?: BuildingOffering[]; // services unlocked by level
  unlockRequirements?: BuildingUnlockReq[]; // other buildings needed to unlock this one
  terrain?: 'land' | 'beach' | 'any'; // where this building can be placed ('any' = default)
  // Economy overhaul — indirect effects (base values, offerings add on top)
  stayBonusDays: number;               // chance to extend guest stay per visit (experience buildings)
  happinessDecayReduction: number;     // reduce happiness decay while visiting (0-1 fraction)
  packageUpgradeChance: number;        // chance to auto-upgrade guest package per visit (0-1)
  priceSensitivityModifier: number;    // modifier to guest price sensitivity (-0.1 = -10%)
  requiresStaff?: StaffRole;           // staff role required for this building to operate
  requiredStaffCount?: number;         // how many staff needed (default 1)
  requiresPower?: boolean;             // false = operates without power (default true)
}

export interface Building {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  currentGuests: number;
  priceMultiplier: number;       // for non-accommodation: per-visit price mult
  powered: boolean;
  isConstructing: boolean;
  constructionProgress: number;
  damaged: boolean;
  level: number;
  adjacencyBonus: number;
  packages: ServicePackage[];     // configurable tiers (only meaningful for accommodation)
  offerings: BuildingOffering[];  // toggleable services unlocked by level
  activeEventProgram?: EventProgramType | null;  // for event_space: currently scheduled event
}

// ── Guest Thoughts ──────────────────────────────────────────────────

export type ThoughtMood = 'positive' | 'neutral' | 'negative';

export interface GuestThought {
  text: string;
  mood: ThoughtMood;
  repComponent?: ReputationComponent;
  dayProgress: number;
  day: number;
}

// ── Guest ────────────────────────────────────────────────────────────

export interface GuestNeeds {
  hunger: number;
  thirst: number;
  fun: number;
  relaxation: number;
  toilet: number;
  accommodation: number;
  beach: number;
  stroll: number;
}

export interface Guest {
  id: number;
  happiness: number;
  money: number;
  needs: GuestNeeds;
  stayDuration: number;
  originalStayDuration: number;        // initial stay before any bonuses (for reports)
  arrivalDay: number;
  assignedAccommodation: number | null;
  currentVisiting: number | null;
  visitTimeLeft: number;
  isVIP: boolean;
  segment: GuestSegment;
  packageId: string | null;            // which package tier they booked (null for locals)
  visitCounts: Record<string, number>; // visits per NeedType per day
  dailySpendRemaining: number;         // SpendPerDay budget left today
  beachTile: { x: number; y: number } | null;  // current beach visit position (for visuals)
  thoughts: GuestThought[];            // diary of experiences (max 20)
  // Economy overhaul — stay & package tracking
  stayBonusApplied: number;            // total extra days granted (max 2)
  packageUpgraded: boolean;            // whether package was auto-upgraded during stay
  effectivePriceSensitivity: number;   // modified price sensitivity (starts from segment base)
  todayStayBonusAccum: number;         // accumulated stay bonus chance for today (reset daily)
  todayPackageUpgradeAccum: number;    // accumulated package upgrade chance for today (reset daily)
}

// ── Weather ──────────────────────────────────────────────────────────

export type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'storm';

export interface Weather {
  current: WeatherType;
  daysUntilChange: number;
}

// ── Loans ───────────────────────────────────────────────────────────

export interface Loan {
  id: number;
  name: string;
  principal: number;          // original amount borrowed
  remaining: number;          // how much left to repay
  dailyInterest: number;      // flat daily interest amount
  dayTaken: number;
  term?: number;               // total loan duration in days
  dailyPayment?: number;      // fixed daily amortization payment
  daysRemaining?: number;     // days left until fully paid
}

// ── Economy ──────────────────────────────────────────────────────────

export interface DailyBreakdown {
  roomRevenue: number;
  resortFeeRevenue: number;
  ancillaryRevenue: number;
  dayPassRevenue: number;
  otherIncome: number;
  totalIncome: number;
  buildingMaintenance: number;
  staffCost: number;
  loanPayments: number;
  eventCost: number;
  totalExpenses: number;
  netProfit: number;
}

export interface DailyFinances {
  grossIncome: number;
  roomRevenue: number;       // from accommodation packages
  resortFeeRevenue: number;  // from resort fee per guest per day
  ancillaryRevenue: number;  // from per-visit charges (non-included services)
  dayPassRevenue: number;    // from local day-pass guests
  maintenanceCost: number;
  staffCost: number;         // from hired staff (cleaners, animators)
  loanInterest: number;
  netIncome: number;
  revenueByRole: { rooms: number; ancillary: number; amenities: number };  // revenue split tracking
}

// ── Missions ─────────────────────────────────────────────────────────

export type MissionType =
  | 'build_count'
  | 'build_type'
  | 'reach_guests'
  | 'reach_reputation'    // reputation 0-100 scale
  | 'earn_money'
  | 'serve_guests'
  | 'reach_day'
  | 'upgrade_building'
  | 'enable_daypass'
  | 'serve_segment';      // serve N guests of specific segment

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  target: number;
  targetBuildingType?: BuildingType;
  targetSegment?: GuestSegment;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

// ── Events ───────────────────────────────────────────────────────────

export type GameEventType =
  | 'vip_guest'
  | 'inspection'
  | 'festival'
  | 'competitor'
  | 'celebrity'
  | 'heatwave'
  | 'power_surge'
  | 'viral_backlash';

export interface GameEvent {
  type: GameEventType;
  title: string;
  description: string;
  daysRemaining: number;
  day: number;
}

// ── Impact Log (explainability) ──────────────────────────────────────

export interface ImpactLogItem {
  day: number;
  category: 'money' | 'reputation' | 'churn' | 'demand' | 'happiness' | 'stay_extension' | 'package_upgrade' | 'outcome_report';
  label: string;
  delta: number;
  causeId?: string;
  relatedEntityId?: number;
  repComponent?: ReputationComponent;  // which reputation component was affected
}

// ── Reviews & Social Heat ───────────────────────────────────────────

export type ReviewTopic = 'cleanliness' | 'queues' | 'service' | 'noise' | 'value' | 'food' | 'entertainment' | 'safety';

export interface Review {
  id: number;
  day: number;
  guestSegment: GuestSegment;
  sentiment: 'positive' | 'neutral' | 'negative';
  topic: ReviewTopic;
  text: string;
  severity: number;          // 1-5
  handled: boolean;
  responseType?: 'respond' | 'compensate' | 'ignore';
}

// ── Litter ──────────────────────────────────────────────────────────

export type LitterType = 'wrapper' | 'cup' | 'bottle' | 'napkin' | 'plate';

export interface LitterItem {
  id: number;
  x: number;           // tile x
  y: number;           // tile y
  offsetX: number;     // pixel sub-offset within tile (0-1)
  offsetY: number;     // pixel sub-offset within tile (0-1)
  type: LitterType;
  createdDay: number;  // day it appeared
}

export interface LitterState {
  items: LitterItem[];
  nextId: number;
}

// ── Staff ───────────────────────────────────────────────────────────

export type StaffRole = 'cleaners' | 'animators' | 'builders' | 'mechanics' | 'lifeguards' | 'security';

export interface StaffRoleState {
  count: number;
  salary: number;  // per day, adjustable via slider
}

export interface StaffState {
  cleaners: number;
  animators: number;
  builders: number;
  mechanics: number;
  lifeguards: number;
  security: number;
  // Salaries (per day, adjustable)
  cleanerCostPerDay: number;
  animatorCostPerDay: number;
  builderCostPerDay: number;
  mechanicCostPerDay: number;
  lifeguardCostPerDay: number;
  securityCostPerDay: number;
}

// ── Story Cards ─────────────────────────────────────────────────────

export interface OutcomeScenario {
  probability: number;        // 0-1, all scenarios for an option must sum to 1
  label: string;              // e.g. "Blogger went viral!", "Blogger flopped"
  effects: {
    money?: number;
    reputation?: number;
    socialHeat?: number;
    segmentHappiness?: Partial<Record<GuestSegment, number>>;
  };
}

export interface StoryOption {
  id: string;
  label: string;
  // Deterministic effects (simple stories — applied immediately)
  effects?: {
    money?: number;
    reputation?: number;
    socialHeat?: number;
    segmentHappiness?: Partial<Record<GuestSegment, number>>;
    delayedEffect?: { daysLater: number; logEntry: ImpactLogItem };
  };
  // Probabilistic outcomes (risky stories — resolved after delay)
  cost?: number;                       // immediate cost paid on choice
  hint?: string;                       // shown instead of exact effects, e.g. "60% viral, 40% flop"
  outcomes?: OutcomeScenario[];        // possible results (rolled after resolveDays)
  resolveDays?: number;                // days until outcome is known (1-3)
}

export interface StoryCard {
  id: string;
  title: string;
  description: string;
  segment?: GuestSegment;
  options: StoryOption[];
  requiredUnlock?: string;  // if set, story only available when this ID is in state.unlockedStories
}

export interface PendingOutcome {
  storyId: string;
  storyTitle: string;
  optionId: string;
  resolveDay: number;            // state.day when this gets resolved
  outcomes: OutcomeScenario[];   // the scenarios to roll against
}

export interface StoryState {
  activeStory: StoryCard | null;
  cooldownDays: number;
  history: { storyId: string; choiceId: string; day: number }[];
  pendingDelayed: { triggerDay: number; log: ImpactLogItem }[];
  pendingOutcomes: PendingOutcome[];   // waiting for probabilistic resolution
}

// ── Contracts (KPI-conflict missions) ───────────────────────────────

export interface ContractCondition {
  metric: 'reputation' | 'occupancy' | 'happiness' | 'profit' | 'segment_count' | 'no_fines';
  operator: '>=' | '<=' | '>';
  value: number;
  segment?: GuestSegment;
}

export interface Contract {
  id: string;
  title: string;
  description: string;
  conditions: ContractCondition[];
  durationDays: number;
  startDay: number;
  progressDays: number;      // consecutive days conditions met
  reward: { money?: number; reputation?: number };
  penalty: { money?: number; reputation?: number; socialHeat?: number };
  status: 'available' | 'active' | 'completed' | 'failed';
}

// ── Marketing Campaigns ─────────────────────────────────────────────

export interface MarketingCampaign {
  id: string;
  name: string;
  cost: number;
  durationDays: number;
  guestBonus: number;
  revenueMultiplier?: number;
  reputationBonus?: number;
  socialHeatBonus?: number;
  minReputation?: number;
  requiresHotel?: boolean;
  effectivenessRange?: { min: number; max: number };  // daily multiplier on guestBonus (0.0-2.0)
}

export interface ActiveCampaign {
  campaignId: string;
  startDay: number;
  daysRemaining: number;
}

// ── Game Speed ───────────────────────────────────────────────────────

export type GameSpeed = 0 | 1 | 2 | 3;

// ── Build Mode ───────────────────────────────────────────────────────

export type BuildMode = BuildingType | 'path' | 'bin' | null;

// ── Full State ───────────────────────────────────────────────────────

// ── Land Parcel ─────────────────────────────────────────────────────

export interface LandParcel {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Camera ──────────────────────────────────────────────────────────

export interface Camera {
  x: number;
  y: number;
  zoom: number;  // 0.5 to 2.0, default 1.0
}

// ── Reputation Components ──────────────────────────────────────────

export type ReputationComponent = 'beauty' | 'safety' | 'fun' | 'value' | 'nightlife' | 'cleanliness' | 'foodQuality';

export interface ReputationBreakdown {
  beauty: number;       // 0-100: scenery, beach, pool, decorations
  safety: number;       // 0-100: baywatch, security, first aid, no incidents
  fun: number;          // 0-100: entertainment variety, arcade, event space, sports
  value: number;        // 0-100: price fairness, guest spending satisfaction
  nightlife: number;    // 0-100: event space, bars, cocktail bar
  cleanliness: number;  // 0-100: cleaners, toilets, not overcrowded
  foodQuality: number;  // 0-100: restaurants, variety of food/drink options
}

export const REPUTATION_COMPONENT_LABELS: Record<ReputationComponent, string> = {
  beauty: 'Beauty',
  safety: 'Safety',
  fun: 'Fun',
  value: 'Value',
  nightlife: 'Nightlife',
  cleanliness: 'Cleanliness',
  foodQuality: 'Food Quality',
};

export const REPUTATION_COMPONENT_ICONS: Record<ReputationComponent, string> = {
  beauty: '🌴',
  safety: '🛡',
  fun: '🎯',
  value: '💰',
  nightlife: '🌙',
  cleanliness: '✨',
  foodQuality: '🍽',
};

export interface GameState {
  day: number;
  dayProgress: number;
  money: number;
  grid: Grid;
  buildings: Building[];
  nextBuildingId: number;
  guests: Guest[];
  nextGuestId: number;
  weather: Weather;
  reputation: number;          // 0-100, weighted average of components
  reputationBreakdown: ReputationBreakdown;  // 7 individual reputation components
  gameSpeed: GameSpeed;
  buildMode: BuildMode;
  hoveredTile: { x: number; y: number } | null;
  selectedBuilding: number | null;
  selectedGuest: number | null;
  selectedStaff: number | null;
  finances: DailyFinances;
  pendingAncillary: number;   // running ancillary accumulator for the current day
  totalGuestsServed: number;
  totalMoneyEarned: number;
  dayPassPrice: number;        // configurable day-pass entry fee
  dayPassEnabled: boolean;
  loans: Loan[];
  nextLoanId: number;
  missions: Mission[];
  events: GameEvent[];
  eventLog: GameEvent[];
  nextEventDay: number;
  // Impact Log (explainability)
  impactLog: ImpactLogItem[];
  previousDayLog: ImpactLogItem[];
  // Reviews & Social Heat
  reviews: Review[];
  nextReviewId: number;
  socialHeat: number;
  // Staff
  staff: StaffState;
  // Litter
  litter: LitterState;
  trashBins: Array<{ x: number; y: number }>;
  // Story Cards
  stories: StoryState;
  unlockedStories: string[];     // story IDs unlocked via building offerings
  // Contracts
  contracts: Contract[];
  // Land & Camera
  ownedLand: LandParcel[];
  camera: Camera;
  // Marketing
  marketing: ActiveCampaign[];
  // Path system
  entrance: { x: number; y: number };
  dailyBreakdown: DailyBreakdown | null;
  version: number;
  tutorialSeen: Record<string, boolean>;
}

// ── Actions ──────────────────────────────────────────────────────────

export type Action =
  | { type: 'SET_BUILD_MODE'; payload: BuildMode }
  | { type: 'SET_HOVERED_TILE'; payload: { x: number; y: number } | null }
  | { type: 'PLACE_BUILDING'; payload: { buildingType: BuildingType; x: number; y: number } }
  | { type: 'SET_SPEED'; payload: GameSpeed }
  | { type: 'TICK_DAY'; payload: { deltaProgress: number } }
  | { type: 'SELECT_BUILDING'; payload: number | null }
  | { type: 'SELECT_GUEST'; payload: number | null }
  | { type: 'SELECT_STAFF'; payload: number | null }
  | { type: 'SET_PRICE'; payload: { buildingId: number; multiplier: number } }
  | { type: 'SET_PACKAGE_PRICE'; payload: { buildingId: number; packageId: string; price: number } }
  | { type: 'TOGGLE_PACKAGE'; payload: { buildingId: number; packageId: string } }
  | { type: 'SET_DAYPASS_PRICE'; payload: number }
  | { type: 'TOGGLE_DAYPASS' }
  | { type: 'DEMOLISH_BUILDING'; payload: number }
  | { type: 'REPAIR_BUILDING'; payload: number }
  | { type: 'UPGRADE_BUILDING'; payload: number }
  | { type: 'TOGGLE_OFFERING'; payload: { buildingId: number; offeringId: string } }
  | { type: 'TAKE_LOAN'; payload: { name: string; amount: number; interestRate: number; term?: number } }
  | { type: 'REPAY_LOAN'; payload: number }
  | { type: 'CLAIM_MISSION'; payload: string }
  | { type: 'DISMISS_EVENT'; payload: number }
  | { type: 'RESPOND_REVIEW'; payload: { reviewId: number; responseType: 'respond' | 'compensate' | 'ignore' } }
  | { type: 'HIRE_STAFF'; payload: { role: StaffRole } }
  | { type: 'FIRE_STAFF'; payload: { role: StaffRole } }
  | { type: 'SET_SALARY'; payload: { role: StaffRole; salary: number } }
  | { type: 'RESOLVE_STORY'; payload: { optionId: string } }
  | { type: 'ACCEPT_CONTRACT'; payload: string }
  | { type: 'DECLINE_CONTRACT'; payload: string }
  | { type: 'BUY_LAND'; payload: { x: number; y: number } }
  | { type: 'SELL_LAND'; payload: { x: number; y: number } }
  | { type: 'PAN_CAMERA'; payload: { dx: number; dy: number } }
  | { type: 'SET_ZOOM'; payload: { zoom: number; centerX?: number; centerY?: number } }
  | { type: 'START_CAMPAIGN'; payload: string }
  | { type: 'PLACE_PATH'; payload: { x: number; y: number } }
  | { type: 'REMOVE_PATH'; payload: { x: number; y: number } }
  | { type: 'SET_PATH_MODE'; payload: boolean }
  | { type: 'PLACE_TRASH_BIN'; payload: { x: number; y: number } }
  | { type: 'REMOVE_TRASH_BIN'; payload: { x: number; y: number } }
  | { type: 'SET_EVENT_PROGRAM'; payload: { buildingId: number; eventType: EventProgramType | null } }
  | { type: 'TUTORIAL_DISMISS'; payload: string }
  | { type: 'RESET_GAME' }
  | { type: 'LOAD_STATE'; payload: GameState };

// ── Event Space Programming ─────────────────────────────────────────

export type EventProgramType = 'cinema_night' | 'live_band' | 'kids_show' | 'silent_party' | 'dj_night';
