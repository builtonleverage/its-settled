// 30–33s: the ads come back and shatter. "No ads." "No sign-up." "Free." slam in.
import React from 'react';
import { random, useCurrentFrame } from 'remotion';
import { FD, T } from '../brand.js';
import { Fit, lerp, pop, useL } from '../kit.jsx';
import { ADS, AdBox } from './S1Chaos.jsx';

// Shards: a 3x2 grid of jagged polygons over each ad.
const SHARDS = [
  '0% 0%, 38% 0%, 30% 55%, 0% 48%', '38% 0%, 70% 0%, 62% 50%, 30% 55%', '70% 0%, 100% 0%, 100% 45%, 62% 50%',
  '0% 48%, 30% 55%, 34% 100%, 0% 100%', '30% 55%, 62% 50%, 72% 100%, 34% 100%', '62% 50%, 100% 45%, 100% 100%, 72% 100%',
];
const TAGS = [
  { t: 'No ads.', at: 34, bg: T.ink, fg: T.bg, r: -5 },
  { t: 'No sign-up.', at: 45, bg: T.accent, fg: '#fff', r: 3 },
  { t: 'Free.', at: 56, bg: T.card, fg: T.accent, r: -3, border: true },
];

export function S9Promise() {
  const f = useCurrentFrame();
  const { tall, W, H } = useL();
  const BREAK = 16;
  // camera shake on each slam
  let sx = 0, sy = 0;
  for (const g of [{ at: BREAK, a: 14 }, ...TAGS.map(t => ({ at: t.at + 4, a: 18 }))]) {
    const k = f - g.at; if (k >= 0 && k < 10) { const d = g.a * Math.exp(-k / 3); sx += Math.sin(k * 3.1) * d; sy += Math.cos(k * 2.3) * d; }
  }
  const box = tall ? { x: 40, y: 380, w: 1000, h: 1160 } : { x: 40, y: 40, w: 1000, h: 1000 };
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px)` }}>
      <Fit box={box} w={760} h={1000}>
        {ADS.map((a, i) => {
          const p = pop(f, i * 2, { damping: 10, stiffness: 240 });
          if (f < BREAK) return <AdBox key={i} a={a} style={{ transform: `scale(${p}) rotate(${a.r}deg)`, filter: f > BREAK - 3 ? 'brightness(1.15)' : undefined }} />;
          const t = (f - BREAK) / 30;
          if (t > 0.9) return null;
          return SHARDS.map((poly, k) => {
            const ang = random(`s${i}${k}`) * Math.PI * 2, v = 600 + random(`v${i}${k}`) * 900;
            const dx = Math.cos(ang) * v * t + ((k % 3) - 1) * 120 * t, dy = Math.sin(ang) * v * t + 1400 * t * t;
            return <AdBox key={i + '-' + k} a={a} style={{ clipPath: `polygon(${poly})`, transform: `translate(${dx}px, ${dy}px) rotate(${a.r + (random(`r${i}${k}`) - 0.5) * 900 * t}deg)`, opacity: lerp(t, [0.5, 0.9], [1, 0]) }} />;
          });
        })}
      </Fit>
      {f >= BREAK && f < BREAK + 4 && <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: lerp(f, [BREAK, BREAK + 4], [0.7, 0]) }} />}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: tall ? 44 : 30 }}>
        {TAGS.map((g, i) => {
          if (f < g.at) return <div key={i} style={{ height: tall ? 190 : 170 }} />;
          const p = pop(f, g.at, { damping: 12, stiffness: 300, mass: 0.6 });
          return (
            <div key={i} style={{ height: tall ? 190 : 170, display: 'flex', alignItems: 'center' }}>
              <div style={{ padding: tall ? '18px 64px 26px' : '14px 54px 22px', borderRadius: 44, background: g.bg, color: g.fg, fontFamily: FD, fontWeight: 800, fontSize: tall ? 150 : 128,
                letterSpacing: '-0.03em', lineHeight: 1, whiteSpace: 'nowrap', border: g.border ? `6px solid ${T.accent}` : undefined,
                boxShadow: '0 22px 50px rgba(20,35,28,.22)', transform: `scale(${3 - 2 * p}) rotate(${g.r}deg)`, opacity: lerp(f, [g.at, g.at + 3], [0, 1]) }}>{g.t}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
