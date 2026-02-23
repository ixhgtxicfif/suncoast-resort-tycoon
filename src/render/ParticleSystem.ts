/**
 * Lightweight particle system for building animations.
 * Supports circle, text/emoji, and ring particle types.
 * Uses object pooling to minimize GC pressure.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  sizeDecay: number;
  color: string;
  alpha: number;
  alphaDecay: number;
  type: 'circle' | 'text' | 'ring';
  text?: string;
  active: boolean;
}

export interface EmitterConfig {
  rate: number;
  lifetime: [number, number];
  speed: [number, number];
  angle: [number, number];
  size: [number, number];
  colors: string[];
  type: 'circle' | 'text' | 'ring';
  text?: string;
  gravity?: number;
  fadeOut?: boolean;
  sizeDecay?: number;
  spread?: number;
}

export interface Emitter {
  id: string;
  x: number;
  y: number;
  config: EmitterConfig;
  accumulator: number;
  active: boolean;
}

const MAX_PARTICLES = 600;

function lerp(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private emitters: Emitter[] = [];
  private lastTime = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 1, sizeDecay: 0,
        color: '#fff', alpha: 1, alphaDecay: 0,
        type: 'circle', active: false,
      });
    }
  }

  addEmitter(id: string, x: number, y: number, config: EmitterConfig): void {
    const existing = this.emitters.find(e => e.id === id);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.config = config;
      existing.active = true;
      return;
    }
    this.emitters.push({ id, x, y, config, accumulator: 0, active: true });
  }

  removeEmitter(id: string): void {
    const idx = this.emitters.findIndex(e => e.id === id);
    if (idx >= 0) this.emitters[idx].active = false;
  }

  clearEmitters(): void {
    this.emitters.length = 0;
  }

  /** Emit a single burst of particles (not continuous). */
  burst(x: number, y: number, config: EmitterConfig, count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnParticle(x, y, config);
    }
  }

  update(time: number): void {
    if (this.lastTime === 0) {
      this.lastTime = time;
      return;
    }
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    // Update emitters
    for (const emitter of this.emitters) {
      if (!emitter.active) continue;
      emitter.accumulator += dt * emitter.config.rate;
      while (emitter.accumulator >= 1) {
        emitter.accumulator -= 1;
        const spread = emitter.config.spread || 0;
        const sx = emitter.x + (Math.random() - 0.5) * spread;
        const sy = emitter.y + (Math.random() - 0.5) * spread;
        this.spawnParticle(sx, sy, emitter.config);
      }
    }

    // Update particles
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.alphaDecay > 0) {
        p.alpha = Math.max(0, (p.life / p.maxLife));
      }
      if (p.sizeDecay > 0) {
        p.size = Math.max(0.5, p.size - p.sizeDecay * dt);
      }
    }

    // Clean up inactive emitters
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      if (!this.emitters[i].active) {
        this.emitters.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      if (!p.active) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;

      switch (p.type) {
        case 'circle':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'text':
          ctx.font = `${Math.round(p.size)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.text || '✦', p.x, p.y);
          break;

        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }

      ctx.restore();
    }
  }

  get activeCount(): number {
    return this.particles.filter(p => p.active).length;
  }

  private spawnParticle(x: number, y: number, config: EmitterConfig): void {
    const p = this.particles.find(p => !p.active);
    if (!p) return;

    const angle = lerp(config.angle[0], config.angle[1]) * (Math.PI / 180);
    const speed = lerp(config.speed[0], config.speed[1]);

    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed + (config.gravity || 0);
    p.life = lerp(config.lifetime[0], config.lifetime[1]);
    p.maxLife = p.life;
    p.size = lerp(config.size[0], config.size[1]);
    p.sizeDecay = config.sizeDecay || 0;
    p.color = config.colors[Math.floor(Math.random() * config.colors.length)];
    p.alpha = 1;
    p.alphaDecay = config.fadeOut !== false ? 1 : 0;
    p.type = config.type;
    p.text = config.text;
    p.active = true;
  }
}
