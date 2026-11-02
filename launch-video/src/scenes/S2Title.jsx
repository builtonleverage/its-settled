// 4–7s: the chaos gets swept away, the check draws itself, "It's Settled." lands with confetti.
import React from 'react';
import { random, useCurrentFrame } from 'remotion';
import { FB, FD, T } from '../brand.js';
import { Logo } from '../app-ui.jsx';
import { Fit, boxes, lerp, pop, EI, EIO, useL, Caption } from '../kit.jsx';
import { ChaosVisual } from './S1Chaos.jsx';

const COLORS = [T.accent, T.accentBright, T.accentSoft, '#2f8a6d', '#fbfcfa', '#9fd8bf'];
export function Confetti({ f, at, n = 80, cx, cy, spread = 1, seed = 'c' }) {
  if (f < at) return null;
  const t = (f - at) / 30;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const a = random(seed + 'a' + i) * Math.PI * 2;
        const v = (700 + random(seed + 'v' + i) * 1100) * spread;
        const x = cx + Math.cos(a) * v * t * Math.exp(-t * 1.4);
        const y = cy + Math.sin(a) * v * t * Math.exp(-t * 1.4) + 900 * t * t;
        const r = random(seed + 'r' + i) * 720 * t + i * 30;
        const w = 12 + random(seed + 'w' + i) * 14, round = random(seed + 's' + i) > 0.7;
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: w, height: round ? w : w * 1.8, borderRadius: round ? '50%' : 3,
          background: COLORS[i % COLORS.length], transform: `rotate(${r}deg) rotateX(${r * 1.3}deg)`, opacity: lerp(t, [1.2, 1.9], [1, 0]),
          boxShadow: COLORS[i % COLORS.length] === '#fbfcfa' ? '0 0 0 1px #dde3dc' : undefined }} />;
      })}
    </div>
  );
}

export function S2Title() {
  const f = useCurrentFrame();
  const { tall, W, H } = useL();
  const sweep = lerp(f, [0, 16], [-0.4, 1.4], EIO);
  const pileX = lerp(f, [2, 16], [0, W * 1.3], EI);
  const tile = pop(f, 12, { damping: 10 });
  const word = pop(f, 26, { damping: 7, stiffness: 160 });
  const tag = pop(f, 46, { damping: 14 });
  const S = tall ? 1 : 0.82;
  return (
    <>
      {f < 18 && (
        <div style={{ position: 'absolute', inset: 0, transform: `translateX(${pileX}px) rotate(${pileX / 120}deg)`, opacity: lerp(f, [10, 17], [1, 0]) }}>
          <Fit box={boxes(tall, 'side').vis} w={700} h={1000}><ChaosVisual f={131} /></Fit>
        </div>
      )}
      {f < 20 && <div style={{ position: 'absolute', top: -200, height: H + 400, width: 420, left: sweep * W - 210, background: T.accent, borderRadius: 200, transform: 'rotate(10deg)', boxShadow: '0 0 80px rgba(31,107,85,.4)' }} />}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
        <Confetti f={f} at={30} cx={W / 2} cy={H / 2 - (tall ? 190 : 150) * S} n={90} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: H / 2 - 380 * S, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ transform: `scale(${tile}) rotate(${(1 - tile) * -30}deg)` }}><Logo size={250 * S} draw={lerp(f, [16, 32], [0, 1], EIO)} /></div>
          <div style={{ fontFamily: FD, fontWeight: 700, fontSize: (tall ? 150 : 132) * S, letterSpacing: '-0.03em', lineHeight: 1, color: T.ink, marginTop: 50 * S, whiteSpace: 'nowrap',
            transform: `translateY(${(1 - word) * 160}px) scale(${0.4 + 0.6 * word})`, opacity: f >= 26 ? 1 : 0 }}>
            It's Settled<span style={{ color: T.accent }}>.</span>
          </div>
          <div style={{ fontFamily: FB, fontWeight: 600, fontSize: (tall ? 44 : 40) * S, color: T.muted, marginTop: 28 * S, textAlign: 'center', maxWidth: 860, lineHeight: 1.3,
            transform: `translateY(${(1 - tag) * 30}px)`, opacity: lerp(f, [46, 52], [0, 1]) }}>
            Split rent, maid, cook and every bill<br />with your flatmates.
          </div>
        </div>
      </div>
    </>
  );
}
