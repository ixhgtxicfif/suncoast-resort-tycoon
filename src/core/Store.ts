import { GameState, Action } from '../state/types';
import { reducer } from '../state/reducer';

type Listener = () => void;

// Actions that should NOT trigger subscriber notifications (handled by render loop)
const SILENT_ACTIONS = new Set(['SET_HOVERED_TILE', 'TICK_DAY']);

export class Store {
  private state: GameState;
  private listeners: Listener[] = [];

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  getState(): GameState {
    return this.state;
  }

  dispatch(action: Action): void {
    this.state = reducer(this.state, action);

    // Only notify listeners for meaningful state changes (not hover/tick)
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
