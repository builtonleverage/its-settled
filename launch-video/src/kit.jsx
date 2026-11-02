// Shared motion + layout helpers.
import React, { createContext, useContext } from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FD, T } from './brand.js';

export const FPS = 30;
export const Layout = createContext({ tall: true, W: 1080, H: 1920 });
export const useL = () => useContext(Layout);

// Linear map with clamping on both sides (the default we want almost everywhere).
export const lerp = (f, inR, outR, ease) =>
  interpolate(f, inR, outR, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
export const EO = Easing.out(Easing.cubic);
export const EI = Easing.in(Easing.cubic);
export const EIO = Easing.inOut(Easing.cubic);

// Spring that starts at frame `at`. bouncy by default.
export const pop = (f, at, cfg = {}) => spring({ frame: f - at, fps: FPS, config: { damping: 11, stiffness: 170, mass: 0.7, ...cfg } });
export const snap = (f, at, cfg = {}) => spring({ frame: f - at, fps: FPS, config: { damping: 18, stiffness: 220, mass: 0.6, ...cfg } });

// Where captions and visuals live. Tall: no text in the top or bottom 250px.
//   tall:        caption band on top, visual below
//   square side: caption left, visual right (phone scenes)
//   square top:  caption band on top, wide visual below (diagram scenes)
export function boxes(tall, mode = 'side') {
  if (tall) return { cap: { x: 60, y: 262, w: 960, h: 330 }, vis: { x: 40, y: 612, w: 1000, h: 1048 } };
  if (mode === 'top') return { cap: { x: 70, y: 52, w: 940, h: 250 }, vis: { x: 40, y: 312, w: 1000, h: 728 } };
  return { cap: { x: 60, y: 70, w: 450, h: 940 }, vis: { x: 520, y: 36, w: 530, h: 1008 } };
}
export const abs = b => ({ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h });

// Scales a fixed-size design to fit a box, centered. Children draw in design pixels.
export function Fit({ box, w, h, children, max = 10, align = 'center' }) {
  const s = Math.min(box.w / w, box.h / h, max);
  const left = box.x + (box.w - w * s) / 2;
  const top = align === 'top' ? box.y : box.y + (box.h - h * s) / 2;
  return <div style={{ position: 'absolute', left, top, width: w, height: h, transform: `scale(${s})`, transformOrigin: '0 0' }}>{children}</div>;
}

// "*word*" marks a highlighted word in captions.
function Rich({ text }) {
  return text.split(/(\*[^*]+\*)/).map((p, i) => p.startsWith('*')
    ? <span key={i} style={{ color: T.accent, position: 'relative', whiteSpace: 'nowrap' }}>{p.slice(1, -1)}</span>
    : <React.Fragment key={i}>{p}</React.Fragment>);
}

// Big bold burned-in caption. lines: [{t, at}] ; each line pops in at its own frame.
export function Caption({ lines, size, mode = 'side', out }) {
  const f = useCurrentFrame();
  const { tall } = useL();
  const b = boxes(tall, mode).cap;
  const left = !tall && mode === 'side';
  const fs = size ?? (tall ? 84 : mode === 'top' ? 64 : 66);
  const o = out ? lerp(f, [out, out + 5], [1, 0]) : 1;
  return (
    <div style={{ ...abs(b), display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: left ? 'flex-start' : 'center', textAlign: left ? 'left' : 'center', opacity: o }}>
      {lines.map((l, i) => {
        const p = pop(f, l.at ?? 6 + i * 4, { damping: 13 });
        return (
          <div key={i} style={{ fontFamily: FD, fontWeight: 800, fontSize: l.size ?? fs, lineHeight: 1.04, letterSpacing: '-0.025em', color: T.ink, textWrap: 'balance',
            transform: `translateY(${(1 - p) * 50}px) scale(${0.85 + 0.15 * p})`, opacity: lerp(f, [l.at ?? 6 + i * 4, (l.at ?? 6 + i * 4) + 4], [0, 1]), marginTop: i ? fs * 0.18 : 0, maxWidth: b.w }}>
            <Rich text={l.t} />
          </div>
        );
      })}
    </div>
  );
}

// Whip transition: fast skewed slide + blur in, and out to the left.
export function Whip({ dur, inF = 8, outF = 6, noIn, noOut, children }) {
  const f = useCurrentFrame();
  const { W } = useL();
  let x = 0, sk = 0, bl = 0;
  if (!noIn && f < inF) { const p = lerp(f, [0, inF], [1, 0], EO); x = p * W * 0.7; sk = -p * 14; bl = p * 14; }
  if (!noOut && f > dur - outF) { const p = lerp(f, [dur - outF, dur], [0, 1], EI); x = -p * W * 0.7; sk = p * 14; bl = p * 14; }
  return <div style={{ position: 'absolute', inset: 0, transform: `translateX(${x}px) skewX(${sk}deg)`, filter: bl > 0.3 ? `blur(${bl}px)` : undefined }}>{children}</div>;
}

// Emoji sticker with a white outline, popping in.
export function Sticker({ e, at, x, y, size = 90, rot = -10, f: fo }) {
  const f0 = useCurrentFrame(); const f = fo ?? f0;
  const p = pop(f, at, { damping: 9 });
  if (f < at) return null;
  return <div style={{ position: 'absolute', left: x, top: y, width: size * 1.35, height: size * 1.35, marginLeft: -size * 0.675, marginTop: -size * 0.675, borderRadius: '50%',
    background: '#fff', display: 'grid', placeItems: 'center', fontSize: size, boxShadow: '0 10px 30px rgba(20,35,28,.18)',
    transform: `scale(${p}) rotate(${rot * p + (1 - p) * -40}deg)`, zIndex: 50 }}>{e}</div>;
}

// A finger tap: dot that presses in, ring that expands. Place inside a position:relative element.
export function TapRing({ f, at, size = 54 }) {
  if (f < at - 6 || f > at + 14) return null;
  const inP = lerp(f, [at - 6, at], [0, 1], EO);
  const ring = lerp(f, [at, at + 12], [0, 1], EO);
  const fade = lerp(f, [at + 6, at + 14], [1, 0]);
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none', zIndex: 30 }}>
      <div style={{ position: 'absolute', width: size, height: size, left: -size / 2, top: -size / 2, borderRadius: '50%', background: 'rgba(24,32,28,.28)',
        transform: `scale(${0.6 + 0.4 * inP - (f > at ? 0.1 : 0)})`, opacity: inP * fade }} />
      <div style={{ position: 'absolute', width: size, height: size, left: -size / 2, top: -size / 2, borderRadius: '50%', border: '3px solid rgba(24,32,28,.45)',
        transform: `scale(${1 + ring * 1.4})`, opacity: f >= at ? (1 - ring) * fade : 0 }} />
    </div>
  );
}

// Button press scale.
export const press = (f, at) => (f >= at - 3 && f <= at + 5 ? 1 - 0.08 * Math.sin(lerp(f, [at - 3, at + 5], [0, Math.PI])) : 1);

// Soft drifting background blobs, shared by every scene so cuts feel continuous.
export function Backdrop() {
  const f = useCurrentFrame();
  const { W, H } = useL();
  const blob = (cx, cy, r, c, ph) => (
    <div style={{ position: 'absolute', left: cx + Math.sin(f / 40 + ph) * 40 - r, top: cy + Math.cos(f / 50 + ph) * 40 - r, width: r * 2, height: r * 2, borderRadius: '50%', background: c, filter: 'blur(60px)', opacity: 0.55 }} />
  );
  return (
    <div style={{ position: 'absolute', inset: 0, background: T.bg, overflow: 'hidden' }}>
      {blob(W * 0.1, H * 0.12, 260, T.accentSoft, 0)}
      {blob(W * 0.95, H * 0.55, 300, T.accentSoft, 2)}
      {blob(W * 0.2, H * 0.95, 240, '#e6ebe4', 4)}
    </div>
  );
}

export const useDur = () => useVideoConfig().durationInFrames;
