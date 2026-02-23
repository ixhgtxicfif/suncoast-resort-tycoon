import { Store } from './core/Store';
import { GameLoop } from './core/GameLoop';
import { initialState } from './state/initialState';
import { IsoRenderer } from './render/IsoRenderer';
import { UIManager } from './ui/UIManager';
import { EconomySystem } from './systems/EconomySystem';
import { SaveSystem } from './systems/SaveSystem';
import { ActionTracker } from './systems/ActionTracker';

interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

async function checkAuth(): Promise<AuthUser | null> {
  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get('token');
  if (tokenFromUrl) {
    localStorage.setItem('suncoast_jwt', tokenFromUrl);
    window.history.replaceState({}, '', '/');
  }

  const jwt = localStorage.getItem('suncoast_jwt');
  if (!jwt) return null;

  try {
    const resp = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!resp.ok) {
      localStorage.removeItem('suncoast_jwt');
      return null;
    }
    return await resp.json();
  } catch {
    return null;
  }
}

function showAuthScreen() {
  const authScreen = document.getElementById('auth-screen')!;
  const app = document.getElementById('app')!;
  authScreen.style.display = 'flex';
  app.style.display = 'none';
}

function hideAuthScreen() {
  const authScreen = document.getElementById('auth-screen')!;
  const app = document.getElementById('app')!;
  authScreen.style.display = 'none';
  app.style.display = '';
}

async function boot() {
  const statusEl = document.getElementById('auth-status')!;
  statusEl.textContent = 'Checking session...';

  const user = await checkAuth();

  if (!user) {
    statusEl.textContent = '';
    showAuthScreen();
    return;
  }

  statusEl.textContent = `Welcome, ${user.name}!`;
  await new Promise(r => setTimeout(r, 600));
  hideAuthScreen();

  startGame(user);
}

function startGame(user: AuthUser) {
  const store = new Store(initialState);
  const jwt = localStorage.getItem('suncoast_jwt')!;

  const actionTracker = new ActionTracker(user.sub, jwt);
  store.setTracker(actionTracker);

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas not found');

  const renderer = new IsoRenderer(canvas);
  const economySystem = new EconomySystem(store);
  const saveSystem = new SaveSystem(store);

  const uiManager = new UIManager(store, renderer, economySystem, saveSystem, canvas);
  (window as any).__suncoast_user = user;

  const loaded = saveSystem.load();
  if (loaded) {
    uiManager.showToast(`Welcome back, ${user.name}!`, 'success');
  } else {
    uiManager.showTutorial('welcome');
  }

  saveSystem.startAutoSave();

  let lastUIUpdate = 0;
  const UI_UPDATE_INTERVAL = 250;

  const gameLoop = new GameLoop(store, () => {
    renderer.render(store.getState());

    const now = performance.now();
    if (now - lastUIUpdate > UI_UPDATE_INTERVAL) {
      uiManager.updateUI();
      lastUIUpdate = now;
    }
  });

  gameLoop.start();
}

boot();
