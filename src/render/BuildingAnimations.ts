/**
 * Per-building animation configurations.
 * Maps building types to particle emitters, glow effects, and ambient animations.
 */

import { BuildingType, GameState } from '../state/types';
import { cartToIso, HALF_W, HALF_H } from './IsoEngine';
import { ParticleSystem, EmitterConfig } from './ParticleSystem';
import { getEffectiveCapacity } from '../state/buildingDefs';

// ── Emitter presets ─────────────────────────────────────────────────

const SMOKE_GRAY: EmitterConfig = {
  rate: 3,
  lifetime: [1.5, 3.0],
  speed: [8, 18],
  angle: [-100, -80],
  size: [2, 5],
  colors: ['rgba(120,120,120,0.6)', 'rgba(160,160,160,0.5)', 'rgba(180,180,180,0.4)'],
  type: 'circle',
  gravity: -12,
  fadeOut: true,
  sizeDecay: 0.3,
};

const STEAM_WHITE: EmitterConfig = {
  rate: 2.5,
  lifetime: [1.0, 2.5],
  speed: [5, 12],
  angle: [-100, -80],
  size: [2, 4],
  colors: ['rgba(255,255,255,0.5)', 'rgba(220,240,255,0.4)'],
  type: 'circle',
  gravity: -15,
  fadeOut: true,
  sizeDecay: 0.5,
};

const WATER_SPARKLE: EmitterConfig = {
  rate: 4,
  lifetime: [0.5, 1.5],
  speed: [2, 8],
  angle: [0, 360],
  size: [1, 3],
  colors: ['rgba(116,185,255,0.7)', 'rgba(0,206,209,0.6)', 'rgba(255,255,255,0.5)'],
  type: 'circle',
  fadeOut: true,
  spread: 20,
};

const WATER_RIPPLE: EmitterConfig = {
  rate: 1.5,
  lifetime: [1.0, 2.0],
  speed: [0, 2],
  angle: [0, 360],
  size: [3, 8],
  colors: ['rgba(116,185,255,0.4)', 'rgba(0,206,209,0.3)'],
  type: 'ring',
  fadeOut: true,
  sizeDecay: -3,
  spread: 15,
};

const MUSIC_NOTES: EmitterConfig = {
  rate: 1.5,
  lifetime: [1.5, 3.0],
  speed: [10, 20],
  angle: [-120, -60],
  size: [8, 12],
  colors: ['#fff'],
  type: 'text',
  text: '♪',
  fadeOut: true,
};

const SPARKLE_GOLD: EmitterConfig = {
  rate: 3,
  lifetime: [0.5, 1.5],
  speed: [5, 15],
  angle: [0, 360],
  size: [6, 10],
  colors: ['#ffd700', '#ffaa00', '#fff5cc'],
  type: 'text',
  text: '✦',
  fadeOut: true,
  spread: 10,
};

const ELECTRIC_SPARK: EmitterConfig = {
  rate: 2,
  lifetime: [0.2, 0.6],
  speed: [15, 35],
  angle: [0, 360],
  size: [1, 2],
  colors: ['#fff176', '#ffeb3b', '#ffffff'],
  type: 'circle',
  fadeOut: true,
};

const WATER_DRIP: EmitterConfig = {
  rate: 2,
  lifetime: [0.5, 1.0],
  speed: [5, 12],
  angle: [70, 110],
  size: [1, 2],
  colors: ['rgba(116,185,255,0.8)', 'rgba(129,236,236,0.7)'],
  type: 'circle',
  gravity: 30,
  fadeOut: true,
};

const CONFETTI: EmitterConfig = {
  rate: 4,
  lifetime: [1.0, 2.5],
  speed: [10, 25],
  angle: [-150, -30],
  size: [6, 9],
  colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'],
  type: 'text',
  text: '✿',
  fadeOut: true,
};

const HEART: EmitterConfig = {
  rate: 0.8,
  lifetime: [1.5, 3.0],
  speed: [5, 12],
  angle: [-120, -60],
  size: [8, 11],
  colors: ['#ff6b6b', '#ee5a24'],
  type: 'text',
  text: '♥',
  fadeOut: true,
};

const WARNING_PARTICLE: EmitterConfig = {
  rate: 3,
  lifetime: [0.5, 1.2],
  speed: [8, 20],
  angle: [0, 360],
  size: [1, 3],
  colors: ['rgba(255,71,87,0.7)', 'rgba(255,107,107,0.6)'],
  type: 'circle',
  fadeOut: true,
  spread: 8,
};

const CROWD_HAPPY: EmitterConfig = {
  rate: 2,
  lifetime: [0.8, 1.5],
  speed: [8, 16],
  angle: [-130, -50],
  size: [7, 10],
  colors: ['#ffeaa7', '#55efc4'],
  type: 'text',
  text: '★',
  fadeOut: true,
  spread: 12,
};

// ── Building type → animation mapping ───────────────────────────────

interface BuildingAnimConfig {
  emitters?: { offset: { dx: number; dy: number }; config: EmitterConfig }[];
  glow?: { color: string; radius: number; nightOnly?: boolean };
}

const BUILDING_ANIM_MAP: Partial<Record<BuildingType, BuildingAnimConfig>> = {
  barbecue: {
    emitters: [{ offset: { dx: 0.3, dy: 0.3 }, config: SMOKE_GRAY }],
    glow: { color: 'rgba(255,120,50,0.3)', radius: 15, nightOnly: true },
  },
  restaurant: {
    emitters: [{ offset: { dx: 0.4, dy: 0.2 }, config: STEAM_WHITE }],
    glow: { color: 'rgba(255,200,100,0.25)', radius: 20, nightOnly: true },
  },
  spa: {
    emitters: [{ offset: { dx: 0.5, dy: 0.3 }, config: STEAM_WHITE }],
    glow: { color: 'rgba(250,177,160,0.2)', radius: 18 },
  },
  main_pool: {
    emitters: [
      { offset: { dx: 0.5, dy: 0.5 }, config: WATER_SPARKLE },
      { offset: { dx: 0.5, dy: 0.5 }, config: WATER_RIPPLE },
    ],
  },
  fun_pool: {
    emitters: [
      { offset: { dx: 0.5, dy: 0.5 }, config: WATER_SPARKLE },
      { offset: { dx: 0.3, dy: 0.7 }, config: WATER_RIPPLE },
    ],
  },
  jacuzzi: {
    emitters: [
      { offset: { dx: 0.5, dy: 0.5 }, config: WATER_SPARKLE },
      { offset: { dx: 0.5, dy: 0.5 }, config: { ...STEAM_WHITE, rate: 1.5 } },
    ],
  },
  arcade: {
    emitters: [{ offset: { dx: 0.5, dy: 0.3 }, config: MUSIC_NOTES }],
    glow: { color: 'rgba(108,92,231,0.3)', radius: 15, nightOnly: true },
  },
  casino: {
    emitters: [{ offset: { dx: 0.5, dy: 0.5 }, config: SPARKLE_GOLD }],
    glow: { color: 'rgba(212,160,23,0.35)', radius: 25, nightOnly: true },
  },
  event_space: {
    emitters: [
      { offset: { dx: 0.5, dy: 0.3 }, config: MUSIC_NOTES },
      { offset: { dx: 0.5, dy: 0.5 }, config: CONFETTI },
    ],
    glow: { color: 'rgba(232,67,147,0.3)', radius: 22, nightOnly: true },
  },
  cocktail_bar: {
    glow: { color: 'rgba(253,121,168,0.35)', radius: 18, nightOnly: true },
  },
  beach_bar: {
    glow: { color: 'rgba(232,67,147,0.25)', radius: 15, nightOnly: true },
  },
  power_gen: {
    emitters: [{ offset: { dx: 0.5, dy: 0.3 }, config: ELECTRIC_SPARK }],
  },
  beach_shower: {
    emitters: [{ offset: { dx: 0.5, dy: 0.5 }, config: WATER_DRIP }],
  },
  windsurfing: {
    emitters: [{ offset: { dx: 0.7, dy: 0.5 }, config: { ...WATER_SPARKLE, rate: 2 } }],
  },
  kids_club: {
    emitters: [{ offset: { dx: 0.5, dy: 0.3 }, config: { ...CONFETTI, rate: 1.5 } }],
    glow: { color: 'rgba(253,203,110,0.2)', radius: 15, nightOnly: true },
  },
  hotel: {
    glow: { color: 'rgba(255,220,150,0.3)', radius: 25, nightOnly: true },
  },
  beach_hut: {
    glow: { color: 'rgba(255,180,100,0.25)', radius: 12, nightOnly: true },
  },
  gym: {
    glow: { color: 'rgba(0,184,148,0.2)', radius: 12, nightOnly: true },
  },
  coworking: {
    glow: { color: 'rgba(9,132,227,0.25)', radius: 15, nightOnly: true },
  },
};

// ── Animation Controller ────────────────────────────────────────────

export class BuildingAnimationSystem {
  private activeEmitterIds = new Set<string>();

  /**
   * Update building animations: manage emitters based on building state,
   * draw glow effects, and handle state-based animations.
   */
  update(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    particles: ParticleSystem,
    time: number,
  ): void {
    const isNight = state.dayProgress > 0.7;
    const newEmitterIds = new Set<string>();

    for (const b of state.buildings) {
      if (b.isConstructing) continue;
      const operational = b.powered && !b.damaged;

      // Get building center in iso coordinates
      const center = cartToIso(b.x + b.width / 2, b.y + b.height / 2);
      const cx = center.x + HALF_W;
      const cy = center.y + HALF_H;
      const wallH = this.getWallHeight(b.width, b.height);

      // Per-type animations (only when operational)
      if (operational) {
        const animConfig = BUILDING_ANIM_MAP[b.type];
        if (animConfig) {
          // Particle emitters
          if (animConfig.emitters) {
            for (let ei = 0; ei < animConfig.emitters.length; ei++) {
              const emDef = animConfig.emitters[ei];
              const emId = `bld_${b.id}_${ei}`;
              newEmitterIds.add(emId);

              const emIso = cartToIso(
                b.x + b.width * emDef.offset.dx,
                b.y + b.height * emDef.offset.dy,
              );
              particles.addEmitter(
                emId,
                emIso.x + HALF_W,
                emIso.y + HALF_H - wallH,
                emDef.config,
              );
            }
          }

          // Glow effects
          if (animConfig.glow) {
            const shouldGlow = !animConfig.glow.nightOnly || isNight;
            if (shouldGlow) {
              this.drawGlow(ctx, cx, cy - wallH / 2, animConfig.glow, time);
            }
          }
        }
      }

      // State-based animations
      if (b.damaged) {
        const emId = `dmg_${b.id}`;
        newEmitterIds.add(emId);
        particles.addEmitter(emId, cx, cy - wallH, WARNING_PARTICLE);
      }

      if (!b.powered && !b.damaged && !b.isConstructing) {
        // Flickering effect for unpowered buildings
        const flicker = Math.sin(time / 200 + b.id) * 0.5 + 0.5;
        if (flicker > 0.7) {
          ctx.save();
          ctx.fillStyle = 'rgba(255,165,2,0.15)';
          ctx.beginPath();
          ctx.arc(cx, cy - wallH / 2, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // High occupancy sparkles (>80% capacity)
      if (operational) {
        const cap = getEffectiveCapacity(b.type, b.level, b);
        if (cap > 0 && b.currentGuests / cap > 0.8) {
          const emId = `crowd_${b.id}`;
          newEmitterIds.add(emId);
          particles.addEmitter(emId, cx, cy - wallH - 5, {
            ...CROWD_HAPPY,
            rate: 1 + (b.currentGuests / cap) * 1.5,
          });
        }

        // Love hearts for accommodation with high satisfaction
        if (b.type === 'hotel' || b.type === 'beach_hut') {
          if (b.currentGuests > 0 && cap > 0 && b.currentGuests / cap > 0.5) {
            const emId = `love_${b.id}`;
            newEmitterIds.add(emId);
            particles.addEmitter(emId, cx, cy - wallH - 5, {
              ...HEART,
              rate: 0.4,
            });
          }
        }
      }
    }

    // Remove emitters for buildings that no longer need them
    for (const oldId of this.activeEmitterIds) {
      if (!newEmitterIds.has(oldId)) {
        particles.removeEmitter(oldId);
      }
    }
    this.activeEmitterIds = newEmitterIds;
  }

  private drawGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    glow: { color: string; radius: number },
    time: number,
  ): void {
    const pulse = Math.sin(time / 800) * 0.15 + 0.85;
    const r = glow.radius * pulse;

    ctx.save();
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, glow.color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private getWallHeight(w: number, h: number): number {
    const area = w * h;
    if (area >= 12) return 38;
    if (area >= 9) return 30;
    if (area >= 6) return 24;
    if (area >= 4) return 18;
    if (w >= 2 || h >= 2) return 14;
    return 10;
  }
}
