// Guest logic is driven entirely inside the reducer's processDayTick().
// This file exposes utility functions used by UI to query guest info.

import { GameState, Guest, NeedType } from '../state/types';

export function getGuestSummary(state: GameState) {
  const guests = state.guests;
  const count = guests.length;
  if (count === 0) {
    return { count: 0, avgHappiness: 0, happyCount: 0, unhappyCount: 0, visitingCount: 0, topNeed: null as NeedType | null };
  }

  const avgHappiness = Math.round(guests.reduce((s, g) => s + g.happiness, 0) / count);
  const happyCount = guests.filter(g => g.happiness >= 60).length;
  const unhappyCount = guests.filter(g => g.happiness < 40).length;

  // Find the most common unmet need
  const needCounts: Record<NeedType, number> = {
    hunger: 0, thirst: 0, fun: 0, relaxation: 0, toilet: 0, accommodation: 0, beach: 0, stroll: 0,
  };
  const needKeys: NeedType[] = ['hunger', 'thirst', 'fun', 'relaxation', 'toilet', 'accommodation', 'beach', 'stroll'];
  for (const g of guests) {
    for (const n of needKeys) {
      if (g.needs[n] >= 60) needCounts[n]++;
    }
  }
  let topNeed: NeedType | null = null;
  let topCount = 0;
  for (const n of needKeys) {
    if (needCounts[n] > topCount) {
      topCount = needCounts[n];
      topNeed = n;
    }
  }

  const visitingCount = guests.filter(g => g.currentVisiting !== null).length;
  return { count, avgHappiness, happyCount, unhappyCount, visitingCount, topNeed };
}

export function getGuestHappinessEmoji(guest: Guest): string {
  if (guest.happiness >= 80) return '😄';
  if (guest.happiness >= 60) return '🙂';
  if (guest.happiness >= 40) return '😐';
  if (guest.happiness >= 20) return '😟';
  return '😠';
}
