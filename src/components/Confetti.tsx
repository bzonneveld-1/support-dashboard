'use client';

import { useEffect, useRef } from 'react';

const COLORS = ['#1CF84C', '#007AFF', '#FFD60A', '#FF375F', '#FFFFFF'];
const PIECES = 140;
const LIFETIME_MS = 3200;

interface Piece {
  x: number; y: number; vx: number; vy: number;
  rot: number; vrot: number; w: number; h: number;
  color: string; born: number;
}

/** Confetti-burst zodra `trigger` verandert. Canvas, geen externe library. */
export default function Confetti({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const piecesRef = useRef<Piece[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (trigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width ?? window.innerWidth;
    const height = rect?.height ?? window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const now = performance.now();
    for (let i = 0; i < PIECES; i++) {
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 1.9;
      const speed = 6 + Math.random() * 9;
      piecesRef.current.push({
        x: width / 2 + (Math.random() - 0.5) * width * 0.25,
        y: height * 0.55,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.35,
        w: 6 + Math.random() * 7,
        h: 9 + Math.random() * 9,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        born: now,
      });
    }

    if (rafRef.current) return;   // er loopt al een animatielus

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      const alive: Piece[] = [];

      for (const p of piecesRef.current) {
        const age = t - p.born;
        if (age > LIFETIME_MS) continue;
        p.vy += 0.22;              // zwaartekracht
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        if (p.y > height + 40) continue;

        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / LIFETIME_MS);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        alive.push(p);
      }

      piecesRef.current = alive;
      if (alive.length > 0) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        rafRef.current = 0;
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafRef.current = requestAnimationFrame(draw);
  }, [trigger]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-30 pointer-events-none"
      aria-hidden="true"
    />
  );
}
