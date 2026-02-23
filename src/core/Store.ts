import { GameState, Action } from '../state/types';
import { reducer } from '../state/reducer';
import type { ActionTracker } from '../systems/ActionTracker';

type Listener = () => void;

const SILENT_ACTIONS = new Set(['SET_HOVERED_TILE', 'TICK_DAY']);

export class Store {
  private state: GameState;
  private listeners: Listener[] = [];
  private tracker: ActionTracker | null = null;

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  setTracker(tracker: ActionTracker): void {
    this.tracker = tracker;
  }

  getState(): GameState {
    return this.state;
  }

  dispatch(action: Action): void {
    if (this.tracker) {
      this.tracker.track(action, this.state);
    }

    this.state = reducer(this.state, action);

    if (!SILENT_ACTIONS.has(action.type)) {
      this.notifyListeners();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}
