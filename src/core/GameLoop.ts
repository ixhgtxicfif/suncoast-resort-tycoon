import { Store } from './Store';
import { tickDay } from '../state/actions';

const SECONDS_PER_DAY = 30; // At 1x speed, 1 game day = 30 real seconds

export class GameLoop {
  private isRunning = false;
  private lastTime = 0;
  private animationFrameId: number | null = null;

  constructor(
    private store: Store,
    private renderCallback: () => void,
  ) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    const deltaSeconds = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    const state = this.store.getState();

    // Advance day progress based on game speed
    if (state.gameSpeed > 0) {
      const speedMultiplier = state.gameSpeed; // 1, 2, or 3
      const dayDelta = (deltaSeconds * speedMultiplier) / SECONDS_PER_DAY;
      this.store.dispatch(tickDay(dayDelta));
    }

    // Always render
    this.renderCallback();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}
