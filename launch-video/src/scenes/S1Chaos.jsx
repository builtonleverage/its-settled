// 0–4s: the flat group chat floods in and a split app drowns in ad pop-ups.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FB, FD, T } from '../brand.js';
import { Caption, Fit, boxes, lerp, pop, useL } from '../kit.jsx';

const WHO = { Arjun: T.accent, Aman: T.neg, Rohan: T.warn };
export const MSGS = [
  ['Rohan', 'who paid for milk??', 2], ['Aman', 'rent kab dena hai?', 9], ['You', "I'll pay later 😅", 16], ['Rohan', 'maid ka hisaab??', 23],
  ['Aman', 'bhai total kitna hua', 29], ['Rohan', 'UPI kisne kiya?', 34], ['Aman', '???', 38], ['You', 'check the app na', 43],
];
const BH = 104; // bubble slot height (design px)

// Ads that bury the "other" split app. Reused (and shattered) in scene 9.
export const ADS = [
  { t: 'YOU WON ₹10,000!', s: 'Tap to claim 🎰', bg: T.neg, fg: '#fff', x: 40, y: 330, r: -8 },
  { t: 'Go PRO 💎', s: 'to see who owes you', bg: T.warnSoft, fg: T.warn, x: 330, y: 400, r: 7 },
  { t: 'Watch an ad ▶', s: 'to add an expense', bg: T.ink, fg: '#f3e8cf', x: 60, y: 560, r: 5 },
  { t: 'Rate us ⭐⭐⭐⭐⭐', s: 'Ad closes in 5…', bg: '#fff', fg: T.ink, x: 300, y: 640, r: -6 },
  { t: 'Unlock balance', s: '₹99/month · Ad', bg: T.negSoft, fg: T.neg, x: 140, y: 470, r: -3 },
  { t: 'Sign up first!', s: 'Enter phone + OTP', bg: '#fff', fg: T.neg, x: 210, y: 770, r: 9 },
];
export function AdBox({ a, style }) {
  return (
    <div style={{ position: 'absolute', left: a.x, top: a.y, width: 360, padding: '18px 22px 20px', borderRadius: 18, background: a.bg, color: a.fg, fontFamily: FB,
      boxShadow: '0 16px 40px rgba(20,35,28,.28)', border: `2px solid ${a.bg === '#fff' ? T.line : 'transparent'}`, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, opacity: 0.75, letterSpacing: '.08em' }}><span>AD</span><span>✕</span></div>
      <div style={{ fontFamily: FD, fontWeight: 800, fontSize: 38, lineHeight: 1.05, marginTop: 6 }}>{a.t}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, opacity: 0.85 }}>{a.s}</div>
    </div>
  );
}

// The chat + ad pile, drawn at frame f (scene 2 reuses the last frame and sweeps it away).
export function ChaosVisual({ f }) {
  const shake = lerp(f, [0, 110], [0.6, 3.2]);
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${Math.sin(f * 2.1) * shake * 2.4}px, ${Math.cos(f * 1.7) * shake * 1.6}px)` }}>
      {/* chat window */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 700, height: 1000, borderRadius: 40, background: T.card, border: `1px solid ${T.line}`, boxShadow: T.sh, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 120, background: T.card, borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 20, padding: '0 30px', zIndex: 5 }}>
          <div style={{ width: 72, height: 72, borderRadius: 24, background: T.chip, display: 'grid', placeItems: 'center', fontSize: 38 }}>🏠</div>
          <div style={{ fontFamily: FB }}>
            <div style={{ fontWeight: 800, fontSize: 32, color: T.ink }}>Flat 402 🏠</div>
            <div style={{ fontSize: 22, color: T.muted, fontWeight: 600 }}>Arjun, Aman, Rohan · typing…</div>
          </div>
          <div style={{ marginLeft: 'auto', background: T.neg, color: '#fff', borderRadius: 99, padding: '6px 16px', fontWeight: 800, fontSize: 24, fontFamily: FB }}>
            {Math.round(lerp(f, [0, 60], [12, 99]))}+
          </div>
        </div>
        {MSGS.map(([who, text, at], i) => {
          if (f < at) return null;
          let off = 0; // pushed up by every newer message
          for (let j = i + 1; j < MSGS.length; j++) off += BH * pop(f, MSGS[j][2], { damping: 14 });
          const p = pop(f, at, { damping: 10 });
          const me = who === 'You';
          const rot = Math.sin(f * 0.9 + i * 1.7) * (1 + f / 40);
          return (
            <div key={i} style={{ position: 'absolute', [me ? 'right' : 'left']: 26, bottom: 30 + off, maxWidth: 520, padding: '12px 22px 14px', borderRadius: 26,
              borderBottomRightRadius: me ? 8 : 26, borderBottomLeftRadius: me ? 26 : 8, background: me ? T.accentSoft : T.chip, fontFamily: FB,
              transform: `scale(${p}) rotate(${rot}deg)`, transformOrigin: me ? 'right bottom' : 'left bottom' }}>
              {!me && <div style={{ fontSize: 20, fontWeight: 800, color: WHO[who] }}>{who}</div>}
              <div style={{ fontSize: 32, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap' }}>{text}</div>
            </div>
          );
        })}
      </div>
      {/* the "other" split app, buried */}
      {f >= 48 && (() => {
        const p = pop(f, 48, { damping: 12 });
        return (
          <div style={{ position: 'absolute', left: 150, top: 250, width: 400, height: 560, borderRadius: 34, background: '#d9ddd7', border: '3px solid #c4cac3',
            transform: `scale(${p}) rotate(${-4 * p}deg)`, padding: 28, fontFamily: FB, boxShadow: '0 20px 50px rgba(20,35,28,.25)' }}>
            <div style={{ fontWeight: 800, fontSize: 28, color: T.muted }}>Some split app</div>
            {[0, 1, 2, 3].map(k => <div key={k} style={{ height: 54, borderRadius: 14, background: '#c9cfc8', marginTop: 22 }} />)}
            <div style={{ marginTop: 28, fontSize: 24, color: T.faint, fontWeight: 700 }}>Loading balance…</div>
          </div>
        );
      })()}
      {ADS.map((a, i) => {
        const at = 56 + i * 7;
        if (f < at) return null;
        const p = pop(f, at, { damping: 9, stiffness: 220 });
        const wob = Math.sin(f * 1.3 + i) * 2;
        return <AdBox key={i} a={a} style={{ transform: `scale(${p}) rotate(${a.r + wob}deg)` }} />;
      })}
    </div>
  );
}

export function S1Chaos() {
  const f = useCurrentFrame();
  const { tall } = useL();
  return (
    <>
      <Fit box={boxes(tall, 'side').vis} w={700} h={1000}><ChaosVisual f={f + 12} /></Fit>
      <Caption lines={[{ t: "Splitting flat expenses *shouldn't* feel like this.", at: -12 }]} size={tall ? 80 : 58} />
    </>
  );
}
