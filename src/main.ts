import { Store } from './core/Store';
import { GameLoop } from './core/GameLoop';
import { initialState } from './state/initialState';
import { IsoRenderer } from './render/IsoRenderer';
import { UIManager } from './ui/UIManager';
import { EconomySystem } from './systems/EconomySystem';
import { SaveSystem } from './systems/SaveSystem';

// Initialize store
const store = new Store(initialState);

// Canvas
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

// Systems
const renderer = new IsoRenderer(canvas);
const economySystem = new EconomySystem(store);
const saveSystem = new SaveSystem(store);

// UI
const uiManager = new UIManager(store, renderer, economySystem, saveSystem, canvas);

// Load saved game
const loaded = saveSystem.load();
if (loaded) {
  uiManager.showToast('Welcome back! Save loaded.', 'success');
} else {
  uiManager.showTutorial('welcome');
}

// Start auto-save
saveSystem.startAutoSave();

// Game loop: render every frame, update DOM UI 4 times per second
let lastUIUpdate = 0;
const UI_UPDATE_INTERVAL = 250; // ms

const gameLoop = new GameLoop(store, () => {
  renderer.render(store.getState());

  const now = performance.now();
  if (now - lastUIUpdate > UI_UPDATE_INTERVAL) {
    uiManager.updateUI();
    lastUIUpdate = now;
  }
});

gameLoop.start();
