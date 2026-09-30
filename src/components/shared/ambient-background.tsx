"use client";

/**
 * AmbientBackground (Aurora Glass) — floating luminous particles on a
 * canvas + film-grain veil. The aurora gradient field itself lives in
 * globals.css (body::before/::after); this component paints the layer
 * above it. Mounted once in the root layout.
 *
 * Respects prefers-reduced-motion (renders a single static frame) and
 * pauses when the tab is hidden.
 */

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  r: number;
  /** upward speed (px/s, negative = up) */
  vy: number;
  /** horizontal sway amplitude & phase */
  swayAmp: number;
  swayFreq: number;
  phase: number;
  /** base alpha + twinkle depth */
  alpha: number;
  twinkle: number;
  color: string;
}

const PALETTE = [
  "41, 161, 156", // teal (primary-ish)
  "52, 199, 123", // emerald
  "245, 158, 11", // amber accent
  "56, 152, 224", // sky
];

function buildParticles(w: number, h: number): Particle[] {
  const count = Math.round(Math.min(34, Math.max(14, (w * h) / 45000)));
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const big = Math.random() < 0.22; // soft "bokeh" dots
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: big ? 3 + Math.random() * 3.5 : 0.8 + Math.random() * 1.8,
      vy: -(4 + Math.random() * 10) * (big ? 0.6 : 1),
      swayAmp: 8 + Math.random() * 26,
      swayFreq: 0.08 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
      alpha: big ? 0.05 + Math.random() * 0.08 : 0.22 + Math.random() * 0.3,
      twinkle: 0.3 + Math.random() * 0.7,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    });
  }
  return particles;
}

function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = true;
    let particles: Particle[] = [];
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = buildParticles(w, h);
    };

    const paint = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        const sway = Math.sin(t * 0.001 * p.swayFreq * Math.PI * 2 + p.phase) * p.swayAmp;
        const tw = 1 - p.twinkle / 2 + (Math.sin(t * 0.0012 + p.phase) * p.twinkle) / 2;
        const x = p.x + sway;
        ctx.beginPath();
        ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${(p.alpha * tw).toFixed(3)})`;
        ctx.shadowColor = `rgba(${p.color}, 0.8)`;
        ctx.shadowBlur = p.r * 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const step = (t: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      for (const p of particles) {
        p.y += p.vy * dt;
        if (p.y < -12) {
          p.y = h + 12;
          p.x = Math.random() * w;
        }
      }
      paint(t);
      raf = requestAnimationFrame(step);
    };
    let last = 0;

    resize();
    if (reduced) {
      paint(0); // single static frame — no motion
    } else {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }

    const onResize = () => {
      resize();
      if (reduced) paint(0);
    };
    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0" />;
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <ParticleField />
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay dark:opacity-[0.05]"
        style={{ backgroundImage: GRAIN }}
      />
    </div>
  );
}
