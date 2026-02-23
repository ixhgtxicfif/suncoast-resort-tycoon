import type { Action, GameState } from '../state/types';

interface ActionContext {
  day: number;
  money: number;
  reputation: number;
  guestCount: number;
  buildingCount: number;
  staffCount: number;
  loanDebt: number;
  netIncome: number;
  weather: string;
}

interface ActionLogEntry {
  action: string;
  payload: any;
  ts: number;
  ctx: ActionContext;
}

const SKIP_ACTIONS = new Set([
  'SET_HOVERED_TILE',
  'PAN_CAMERA',
  'SET_ZOOM',
  'TICK_DAY',
]);

const FLUSH_INTERVAL = 30_000;
const MAX_BUFFER = 500;

export class ActionTracker {
  private buffer: ActionLogEntry[] = [];
  private sessionId: string;
  private jwt: string;
  private flushTimer: ReturnType<typeof setInterval>;

  constructor(_userId: string, jwt: string) {
    this.jwt = jwt;
    this.sessionId = crypto.randomUUID();

    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);

    window.addEventListener('beforeunload', () => this.flushSync());
  }

  track(action: Action, stateBefore: GameState): void {
    if (SKIP_ACTIONS.has(action.type)) return;

    const entry: ActionLogEntry = {
      action: action.type,
      payload: 'payload' in action ? action.payload : undefined,
      ts: Date.now(),
      ctx: this.snapshot(stateBefore),
    };

    if (action.type === 'LOAD_STATE') {
      entry.payload = '(state omitted)';
    }

    this.buffer.push(entry);

    if (this.buffer.length >= MAX_BUFFER) {
      this.flush();
    }
  }

  private snapshot(s: GameState): ActionContext {
    return {
      day: s.day,
      money: Math.round(s.money),
      reputation: Math.round(s.reputation),
      guestCount: s.guests.length,
      buildingCount: s.buildings.filter(b => !b.isConstructing).length,
      staffCount: Object.values(s.staff).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0),
      loanDebt: s.loans.reduce((sum, l) => sum + l.remaining, 0),
      netIncome: Math.round(s.finances.netIncome),
      weather: s.weather.current,
    };
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);

    try {
      await fetch('/api/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.jwt}`,
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          entries: batch,
        }),
      });
    } catch {
      this.buffer.unshift(...batch);
    }
  }

  private flushSync(): void {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    const body = JSON.stringify({
      sessionId: this.sessionId,
      entries: batch,
    });

    navigator.sendBeacon(
      '/api/actions?token=' + encodeURIComponent(this.jwt),
      new Blob([body], { type: 'application/json' }),
    );
  }

  destroy(): void {
    clearInterval(this.flushTimer);
    this.flushSync();
  }
}
