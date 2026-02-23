/**
 * Sprite asset loading & caching.
 * Loads PNG images with a two-tier lookup:
 *   1. assets/buildings/new design/{key}.png  (preferred — new art)
 *   2. assets/buildings/{key}.png             (fallback — old art)
 * Automatically removes white backgrounds for clean compositing.
 * Falls back to procedural drawing if both paths are missing.
 */

const NEW_DESIGN_PATH = 'assets/buildings/new design';
const LEGACY_PATH = 'assets/buildings';

const ALL_BUILDING_KEYS = [
  'beach_hut', 'hotel',
  'beach_bar', 'barbecue', 'restaurant', 'kiosk', 'cocktail_bar', 'gift_shop',
  'arcade', 'main_pool', 'fun_pool', 'jacuzzi', 'spa', 'mini_golf',
  'equipment_hire', 'windsurfing', 'casino', 'kids_club', 'gym', 'coworking', 'event_space',
  'toilet', 'cleaners_shack', 'power_gen', 'beach_shower', 'baywatch_tower',
  'rep_office', 'handyman_shack', 'security_post', 'first_aid', 'concierge',
];

const TERRAIN_KEYS = ['road', 'grass'];

export class SpriteManager {
  private cache = new Map<string, HTMLImageElement>();
  private loading = new Set<string>();
  private failed = new Set<string>();

  constructor() {
    // PNG sprites disabled — using procedural rendering for now.
    // To re-enable, uncomment: this.preloadAll();
  }

  /** Attempt to load a sprite by key. Returns null while sprites are disabled. */
  get(_key: string): HTMLImageElement | null {
    // PNG disabled — always fall back to procedural rendering.
    // Original logic preserved below for future re-enable.
    return null;
    /*
    if (this.cache.has(key)) return this.cache.get(key)!;
    if (this.failed.has(key)) return null;
    if (!this.loading.has(key)) this.loadSprite(key);
    return null;
    */
  }

  /** Preload all building and terrain sprites on startup. */
  preloadAll(): void {
    this.preload(ALL_BUILDING_KEYS);
    this.preloadTerrain(TERRAIN_KEYS);
  }

  /** Preload a list of sprite keys. */
  preload(keys: string[]): void {
    for (const key of keys) {
      if (!this.cache.has(key) && !this.loading.has(key) && !this.failed.has(key)) {
        this.loadSprite(key);
      }
    }
  }

  /** Check if all sprites are loaded (or failed). */
  isReady(): boolean {
    return this.loading.size === 0;
  }

  /** Preload terrain sprite keys (road, etc.). */
  private preloadTerrain(keys: string[]): void {
    for (const key of keys) {
      if (!this.cache.has(key) && !this.loading.has(key) && !this.failed.has(key)) {
        this.loadTerrainSprite(key);
      }
    }
  }

  /** Load a terrain sprite from the new design folder.
   *  Priority: road-as.png → road.png → road..png */
  private loadTerrainSprite(key: string): void {
    this.loading.add(key);

    const tryLoad = (src: string, next: (() => void) | null): void => {
      const img = new Image();
      img.onload = () => {
        const processed = this.removeWhiteBackground(img);
        this.cache.set(key, processed);
        this.loading.delete(key);
      };
      img.onerror = () => {
        if (next) next();
        else {
          this.failed.add(key);
          this.loading.delete(key);
        }
      };
      img.src = src;
    };

    tryLoad(`${NEW_DESIGN_PATH}/${key}-as.png`, () => {
      tryLoad(`${NEW_DESIGN_PATH}/${key}.png`, () => {
        tryLoad(`${NEW_DESIGN_PATH}/${key}..png`, null);
      });
    });
  }

  /**
   * Try loading from "new design" folder first.
   * On failure, fall back to the legacy folder.
   * If both fail, mark as failed (procedural fallback will be used).
   */
  private loadSprite(key: string): void {
    this.loading.add(key);

    const newImg = new Image();
    newImg.onload = () => {
      const processed = this.removeWhiteBackground(newImg);
      this.cache.set(key, processed);
      this.loading.delete(key);
    };
    newImg.onerror = () => {
      // New design not found — try legacy path
      const legacyImg = new Image();
      legacyImg.onload = () => {
        const processed = this.removeWhiteBackground(legacyImg);
        this.cache.set(key, processed);
        this.loading.delete(key);
      };
      legacyImg.onerror = () => {
        this.failed.add(key);
        this.loading.delete(key);
      };
      legacyImg.src = `${LEGACY_PATH}/${key}.png`;
    };
    newImg.src = `${NEW_DESIGN_PATH}/${key}.png`;
  }

  /**
   * Remove white/near-white background pixels, making them transparent,
   * then auto-crop to the visible content bounding box.
   */
  private removeWhiteBackground(img: HTMLImageElement): HTMLImageElement {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return img;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const threshold = 245;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r > threshold && g > threshold && b > threshold) {
        data[i + 3] = 0;
      } else if (r > 230 && g > 230 && b > 230) {
        const brightness = (r + g + b) / 3;
        const alpha = Math.max(0, ((255 - brightness) / (255 - 230)) * 255);
        data[i + 3] = Math.min(data[i + 3], Math.round(alpha));
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Auto-crop: find bounding box of non-transparent pixels
    const w = canvas.width;
    const h = canvas.height;
    let minX = w, minY = h, maxX = 0, maxY = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Crop to content bounds (with 1px safety margin)
    if (maxX > minX && maxY > minY) {
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
        const result = new Image();
        result.src = cropCanvas.toDataURL();
        return result;
      }
    }

    const result = new Image();
    result.src = canvas.toDataURL();
    return result;
  }
}
