// 33–36s: logo, name, invite button, "Open source on GitHub".
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FB, FD, T } from '../brand.js';
import { Logo } from '../app-ui.jsx';
import { lerp, pop, useL } from '../kit.jsx';
import { Confetti } from './S2Title.jsx';

export function S10End({ inviteLink }) {
  const f = useCurrentFrame();
  const { tall, W, H } = useL();
  const S = tall ? 1 : 0.8;
  const logo = pop(f, 4, { damping: 9 });
  const name = pop(f, 10, { damping: 9 });
  const btn = pop(f, 20, { damping: 10 });
  const pulse = f > 40 ? 1 + 0.03 * Math.sin((f - 40) / 4) : 1;
  // Long links shrink to fit; very long ones wrap.
  const link = String(inviteLink);
  const linkSize = Math.max(30, Math.min(58, 1500 / Math.max(1, link.length))) * S;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
      <Confetti f={f} at={20} cx={W / 2} cy={H / 2 + 120 * S} n={50} spread={0.8} seed="end" />
      <div style={{ position: 'absolute', left: 60, right: 60, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ transform: `scale(${logo}) rotate(${(1 - logo) * 25}deg)` }}><Logo size={200 * S} /></div>
        <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 130 * S, letterSpacing: '-0.03em', lineHeight: 1, color: T.ink, marginTop: 40 * S, whiteSpace: 'nowrap',
          transform: `translateY(${(1 - name) * 80}px) scale(${0.6 + 0.4 * name})`, opacity: f >= 10 ? 1 : 0 }}>
          It's Settled<span style={{ color: T.accent }}>.</span>
        </div>
        <div style={{ marginTop: 64 * S, maxWidth: 940, padding: `${30 * S}px ${54 * S}px ${34 * S}px`, borderRadius: 46 * S, background: T.accent, color: '#fff',
          boxShadow: '0 22px 50px rgba(31,107,85,.4)', transform: `scale(${btn * pulse})`, opacity: f >= 20 ? 1 : 0 }}>
          <div style={{ fontFamily: FD, fontWeight: 800, fontSize: 60 * S, lineHeight: 1.05 }}>Join our flat:</div>
          <div style={{ fontFamily: FB, fontWeight: 700, fontSize: linkSize, lineHeight: 1.2, marginTop: 10 * S, overflowWrap: 'anywhere' }}>{link}</div>
        </div>
        <div style={{ marginTop: 40 * S, fontFamily: FB, fontWeight: 700, fontSize: 38 * S, color: T.muted, opacity: lerp(f, [34, 42], [0, 1]) }}>Open source on GitHub</div>
      </div>
    </div>
  );
}
