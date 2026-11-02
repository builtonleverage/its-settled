// 11–16s: Arjun → Aman → Rohan folds into Arjun → Rohan.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FB, FD, T } from '../brand.js';
import { Card, Sec, SettleRow } from '../app-ui.jsx';
import { Caption, Fit, boxes, lerp, pop, snap, EIO, EO, useL } from '../kit.jsx';

const Y = 330, R = 92;
const P = [{ n: 'Arjun', x: 160, bg: T.accentSoft }, { n: 'Aman', x: 500, bg: T.warnSoft }, { n: 'Rohan', x: 840, bg: '#e3e8e2' }];

function Head({ x, y, ang, color, s = 1 }) {
  return <polygon points="0,-17 30,0 0,17" fill={color} transform={`translate(${x} ${y}) rotate(${ang}) scale(${s})`} />;
}
function Avatar({ p, f, at, dim = 0, badge }) {
  const s = pop(f, at, { damping: 9 });
  return (
    <div style={{ position: 'absolute', left: p.x - R, top: Y - R, width: R * 2, transform: `scale(${s * (1 - dim * 0.16)}) translateY(${dim * 30}px)`, opacity: 1 - dim * 0.35, textAlign: 'center' }}>
      <div style={{ width: R * 2, height: R * 2, borderRadius: 56, background: p.bg, display: 'grid', placeItems: 'center', fontFamily: FD, fontWeight: 700, fontSize: 92, color: T.ink,
        boxShadow: '0 12px 30px rgba(20,35,28,.12)', border: `3px solid ${T.card}` }}>{p.n[0]}</div>
      <div style={{ fontFamily: FB, fontWeight: 800, fontSize: 40, color: T.ink, marginTop: 14 }}>{p.n}</div>
      {badge}
    </div>
  );
}

export function S4Simplify() {
  const f = useCurrentFrame();
  const { tall } = useL();
  const d1 = lerp(f, [14, 28], [0, 1], EO), d2 = lerp(f, [24, 38], [0, 1], EO);
  const fold = lerp(f, [62, 76], [0, 1], EIO);
  const arc = lerp(f, [72, 92], [0, 1], EIO);
  const arcLbl = pop(f, 88, { damping: 9 });
  const card = snap(f, 100);
  const stamp = pop(f, 112, { damping: 8 });
  const settled = pop(f, 80, { damping: 9 });
  const lbl = (x, p) => (
    <div style={{ position: 'absolute', left: x - 110, top: Y - 128, width: 220, textAlign: 'center', fontFamily: FB, fontWeight: 800, fontSize: 34, color: T.neg,
      transform: `scale(${p * (1 - fold)})`, opacity: 1 - fold }}>owes ₹500</div>
  );
  return (
    <>
      <Fit box={boxes(tall, 'top').vis} w={1000} h={tall ? 960 : 900}>
        <svg width="1000" height="600" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          <g style={{ transformOrigin: `500px ${Y}px`, transform: `scaleX(${1 - fold})`, opacity: 1 - fold * 0.8 }}>
            <line x1={P[0].x + R + 14} y1={Y} x2={P[0].x + R + 14 + (P[1].x - P[0].x - 2 * R - 58) * d1} y2={Y} stroke={T.neg} strokeWidth="12" strokeLinecap="round" />
            {d1 > 0.95 && <Head x={P[1].x - R - 36} y={Y} ang={0} color={T.neg} />}
            <line x1={P[1].x + R + 14} y1={Y} x2={P[1].x + R + 14 + (P[2].x - P[1].x - 2 * R - 58) * d2} y2={Y} stroke={T.neg} strokeWidth="12" strokeLinecap="round" />
            {d2 > 0.95 && <Head x={P[2].x - R - 36} y={Y} ang={0} color={T.neg} />}
          </g>
          {arc > 0 && <>
            <path d={`M ${P[0].x + 20} ${Y - R - 18} Q 500 ${Y - 330} ${P[2].x - 30} ${Y - R - 22}`} fill="none" stroke={T.accent} strokeWidth="14" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - arc} />
            {arc > 0.97 && <Head x={P[2].x - 30} y={Y - R - 22} ang={38} color={T.accent} s={1.2} />}
          </>}
        </svg>
        {lbl(330, pop(f, 22)) }{lbl(670, pop(f, 32))}
        <Avatar p={P[0]} f={f} at={4} />
        <Avatar p={P[1]} f={f} at={8} dim={fold} badge={f >= 80 && (
          <div style={{ display: 'inline-block', marginTop: 8, padding: '6px 16px', borderRadius: 99, background: T.accentSoft, color: T.accent, fontFamily: FB, fontWeight: 800, fontSize: 28,
            transform: `scale(${settled})`, whiteSpace: 'nowrap' }}>✓ nothing to pay</div>)} />
        <Avatar p={P[2]} f={f} at={12} />
        {f >= 86 && (
          <div style={{ position: 'absolute', left: 500 - 150, top: Y - 250, width: 300, textAlign: 'center', transform: `scale(${arcLbl})` }}>
            <span style={{ display: 'inline-block', padding: '10px 26px', borderRadius: 99, background: T.accent, color: '#fff', fontFamily: FD, fontWeight: 800, fontSize: 44, boxShadow: '0 10px 24px rgba(31,107,85,.35)' }}>pays ₹500</span>
          </div>
        )}
        {f >= 100 && (
          <div style={{ position: 'absolute', left: 120, top: 590, width: 447, transform: `scale(1.7) translateY(${(1 - card) * 60}px)`, transformOrigin: '0 0', opacity: card }}>
            <div style={{ fontFamily: FB, fontSize: 15, lineHeight: 1.45, color: T.ink }}>
              <Sec title="Settle up" right="simplified" />
              <Card><SettleRow first from="Arjun" to="Rohan" who="Between them" amt="₹500" /></Card>
            </div>
          </div>
        )}
        {f >= 112 && (
          <div style={{ position: 'absolute', left: 560, top: 830, transform: `scale(${stamp}) rotate(-4deg)`, padding: '12px 22px', borderRadius: 18, background: T.ink, color: T.bg,
            fontFamily: FD, fontWeight: 800, fontSize: 34, whiteSpace: 'nowrap', boxShadow: '0 12px 26px rgba(20,35,28,.3)' }}>2 payments → 1</div>
        )}
      </Fit>
      <Caption mode="top" lines={[{ t: 'A owes B, B owes C?', at: 6 }, { t: '*A pays C.* Fewer payments, same totals.', at: 66 }]} size={tall ? 76 : 56} />
    </>
  );
}
