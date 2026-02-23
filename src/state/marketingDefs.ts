import { MarketingCampaign } from './types';

export const MARKETING_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: 'flyers',
    name: 'Flyers',
    cost: 15,
    durationDays: 3,
    guestBonus: 1,
    effectivenessRange: { min: 0.7, max: 1.3 },  // low variance — reliable
  },
  {
    id: 'online_listing',
    name: 'Online Listing',
    cost: 40,
    durationDays: 5,
    guestBonus: 2,
    effectivenessRange: { min: 0.5, max: 1.5 },  // moderate variance
  },
  {
    id: 'discount_promo',
    name: 'Discount Promo',
    cost: 25,
    durationDays: 3,
    guestBonus: 2,
    revenueMultiplier: 0.7,
    effectivenessRange: { min: 0.6, max: 1.4 },  // moderate variance
  },
  {
    id: 'influencer',
    name: 'Influencer Invite',
    cost: 80,
    durationDays: 2,
    guestBonus: 3,
    socialHeatBonus: 5,
    minReputation: 30,
    effectivenessRange: { min: 0.0, max: 2.0 },  // high variance — can flop or go viral
  },
  {
    id: 'billboard',
    name: 'Billboard Ad',
    cost: 120,
    durationDays: 7,
    guestBonus: 2,
    reputationBonus: 1,
    minReputation: 40,
    effectivenessRange: { min: 0.8, max: 1.2 },  // very reliable
  },
  {
    id: 'agency_deal',
    name: 'Travel Agency Deal',
    cost: 60,
    durationDays: 5,
    guestBonus: 3,
    requiresHotel: true,
    effectivenessRange: { min: 0.4, max: 1.6 },  // moderate-high variance
  },
];

export function getCampaignDef(id: string): MarketingCampaign | undefined {
  return MARKETING_CAMPAIGNS.find(c => c.id === id);
}
