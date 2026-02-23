import { Mission } from './types';

export function createInitialMissions(): Mission[] {
  return [
    // ── Tutorial / Early Game ──────────────────────────────────────
    {
      id: 'first_building',
      title: 'First Steps',
      description: 'Build your first building',
      type: 'build_count', target: 1,
      reward: 300, completed: false, claimed: false,
    },
    {
      id: 'first_accommodation',
      title: 'Open for Business',
      description: 'Build a Beach Hut or Hotel',
      type: 'build_type', target: 1, targetBuildingType: 'beach_hut',
      reward: 500, completed: false, claimed: false,
    },
    {
      id: 'first_food',
      title: 'Feed the Masses',
      description: 'Build a food building (BBQ, Restaurant, or Bar)',
      type: 'build_count', target: 3,
      reward: 500, completed: false, claimed: false,
    },
    {
      id: 'reach_5_guests',
      title: 'Getting Popular',
      description: 'Have 5 guests staying at once',
      type: 'reach_guests', target: 5,
      reward: 750, completed: false, claimed: false,
    },

    // ── Mid Game ───────────────────────────────────────────────────
    {
      id: 'reach_rep_30',
      title: 'Rising Reputation',
      description: 'Reach 30 reputation',
      type: 'reach_reputation', target: 30,
      reward: 1000, completed: false, claimed: false,
    },
    {
      id: 'enable_daypass',
      title: 'Open to Locals',
      description: 'Enable the Day Pass for local visitors',
      type: 'enable_daypass', target: 1,
      reward: 500, completed: false, claimed: false,
    },
    {
      id: 'build_8',
      title: 'Resort Builder',
      description: 'Have 8 buildings total',
      type: 'build_count', target: 8,
      reward: 1200, completed: false, claimed: false,
    },
    {
      id: 'earn_7500',
      title: 'Money Maker',
      description: 'Earn $7,500 in total net income',
      type: 'earn_money', target: 7500,
      reward: 1000, completed: false, claimed: false,
    },
    {
      id: 'reach_10_guests',
      title: 'Crowded Beach',
      description: 'Have 10 guests at once',
      type: 'reach_guests', target: 10,
      reward: 1500, completed: false, claimed: false,
    },
    {
      id: 'survive_10',
      title: 'Survivor',
      description: 'Reach day 10',
      type: 'reach_day', target: 10,
      reward: 750, completed: false, claimed: false,
    },
    {
      id: 'serve_5_families',
      title: 'Family Friendly',
      description: 'Serve 5 family guests (departed)',
      type: 'serve_segment', target: 5, targetSegment: 'family',
      reward: 1100, completed: false, claimed: false,
    },

    // ── Late Game ──────────────────────────────────────────────────
    {
      id: 'reach_rep_60',
      title: 'Well Known',
      description: 'Reach 60 reputation',
      type: 'reach_reputation', target: 60,
      reward: 1800, completed: false, claimed: false,
    },
    {
      id: 'serve_20',
      title: 'Hospitality Pro',
      description: 'Serve 20 guests total',
      type: 'serve_guests', target: 20,
      reward: 1500, completed: false, claimed: false,
    },
    {
      id: 'upgrade_lvl2',
      title: 'Upgrader',
      description: 'Upgrade any building to level 2',
      type: 'upgrade_building', target: 2,
      reward: 1000, completed: false, claimed: false,
    },
    {
      id: 'earn_30000',
      title: 'Tycoon',
      description: 'Earn $30,000 in total net income',
      type: 'earn_money', target: 30000,
      reward: 2500, completed: false, claimed: false,
    },
    {
      id: 'reach_rep_80',
      title: 'Premium Resort',
      description: 'Reach 80 reputation',
      type: 'reach_reputation', target: 80,
      reward: 3000, completed: false, claimed: false,
    },
    {
      id: 'upgrade_lvl3',
      title: 'Master Builder',
      description: 'Upgrade any building to level 3',
      type: 'upgrade_building', target: 3,
      reward: 2000, completed: false, claimed: false,
    },
    {
      id: 'survive_30',
      title: 'Veteran',
      description: 'Reach day 30',
      type: 'reach_day', target: 30,
      reward: 2000, completed: false, claimed: false,
    },
    {
      id: 'reach_20_guests',
      title: 'Full House',
      description: 'Have 20 guests at once',
      type: 'reach_guests', target: 20,
      reward: 3000, completed: false, claimed: false,
    },
    {
      id: 'vip_satisfaction',
      title: 'VIP Treatment',
      description: 'A VIP guest departs with happiness > 80',
      type: 'serve_segment', target: 1, targetSegment: 'vip',
      reward: 1500, completed: false, claimed: false,
    },

    // ── Upgrade & Unlock Missions ──────────────────────────────────
    {
      id: 'unlock_spa',
      title: 'Wellness Pioneer',
      description: 'Unlock the Spa (upgrade Pool to Lv.2)',
      type: 'build_type', target: 1, targetBuildingType: 'spa',
      reward: 1500, completed: false, claimed: false,
    },
    {
      id: 'unlock_mini_golf',
      title: 'Fun for Everyone',
      description: 'Unlock Mini Golf (upgrade Arcade to Lv.2)',
      type: 'build_type', target: 1, targetBuildingType: 'mini_golf',
      reward: 1200, completed: false, claimed: false,
    },
    {
      id: 'unlock_gift_shop',
      title: 'Retail Mogul',
      description: 'Unlock the Gift Shop (upgrade Hotel to Lv.2)',
      type: 'build_type', target: 1, targetBuildingType: 'gift_shop',
      reward: 1000, completed: false, claimed: false,
    },

    // ── New Building Missions ────────────────────────────────────────
    {
      id: 'build_kids_club',
      title: 'Family Zone',
      description: 'Build a Kids Club to attract families',
      type: 'build_type', target: 1, targetBuildingType: 'kids_club',
      reward: 1200, completed: false, claimed: false,
    },
    {
      id: 'build_event_space',
      title: 'Night Life',
      description: 'Build an Event Space for entertainment programs',
      type: 'build_type', target: 1, targetBuildingType: 'event_space',
      reward: 1500, completed: false, claimed: false,
    },
    {
      id: 'build_coworking',
      title: 'Digital Nomads',
      description: 'Build a Coworking Space to attract long-stay nomads',
      type: 'build_type', target: 1, targetBuildingType: 'coworking',
      reward: 1200, completed: false, claimed: false,
    },
    {
      id: 'build_concierge',
      title: 'Guest Relations',
      description: 'Build a Concierge Desk to manage guest satisfaction',
      type: 'build_type', target: 1, targetBuildingType: 'concierge',
      reward: 1000, completed: false, claimed: false,
    },
  ];
}
