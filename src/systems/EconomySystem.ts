// Economy logic now lives in the reducer's processDayTick().
// This system is a thin wrapper for the UI to trigger manual day advance.

import { Store } from '../core/Store';
import { tickDay } from '../state/actions';

export class EconomySystem {
  constructor(private store: Store) {}

  // Force an immediate full day tick (skip remaining day progress)
  advanceDay(): void {
    const state = this.store.getState();
    const remaining = 1.0 - state.dayProgress;
    this.store.dispatch(tickDay(remaining));
  }
}
