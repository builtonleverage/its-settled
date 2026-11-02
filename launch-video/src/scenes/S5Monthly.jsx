// 16–20s: calendar flips to the 1st; Rent, Maid, Cook drop into the activity list.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FB, FD, T } from '../brand.js';
import { Card, ExpenseRow, Sec } from '../app-ui.jsx';
import { Caption, Fit, Sticker, boxes, lerp, pop, EIO, useL } from '../kit.jsx';

function Page({ mon, day, style }) {
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: 36, overflow: 'hidden', background: T.card, boxShadow: '0 14px 34px rgba(20,35,28,.16)', border: `1px solid ${T.line}`, backfaceVisibility: 'hidden', ...style }}>
      <div style={{ height: 78, background: T.accent, color: '#fff', fontFamily: FB, fontWeight: 800, fontSize: 38, letterSpacing: '.14em', display: 'grid', placeItems: 'center' }}>{mon}</div>
      <div style={{ fontFamily: FD, fontWeight: 800, fontSize: 150, lineHeight: '182px', textAlign: 'center', color: T.ink }}>{day}</div>
    </div>
  );
}
const BILLS = [
  { icon: '🏠', desc: 'Rent · Nov', sub: 'You paid · 1 Nov · monthly', amt: '₹42,000', a2: 'you lent ₹28,000', a2cls: 'pos' },
  { icon: '🧹', desc: 'Maid · Nov', sub: 'Aman paid · 1 Nov · monthly', amt: '₹4,500', a2: 'your share ₹1,500', a2cls: 'neg' },
  { icon: '🍳', desc: 'Cook · Nov', sub: 'Rohan paid · 1 Nov · monthly', amt: '₹9,000', a2: 'your share ₹3,000', a2cls: 'neg' },
];

export function S5Monthly() {
  const f = useCurrentFrame();
  const { tall } = useL();
  const cal = pop(f, 2, { damping: 11 });
  const flip = lerp(f, [12, 28], [0, 1], EIO);
  const at = [34, 46, 58];
  const DW = tall ? 760 : 520, LS = tall ? 1.7 : 1.16; // square: narrower design so the list stays readable
  return (
    <>
      <Fit box={boxes(tall, 'side').vis} w={DW} h={1000}>
        <div style={{ position: 'absolute', left: DW / 2 - 140, top: tall ? 0 : 60, width: 280, height: 260, perspective: 900, transform: `scale(${cal})` }}>
          <Page mon="NOV" day="1" />
          <Page mon="OCT" day="31" style={{ transformOrigin: '50% 0', transform: `rotateX(${flip * 105}deg)`, opacity: flip > 0.92 ? 0 : 1, filter: `brightness(${1 - flip * 0.2})` }} />
          {[70, 210].map(x => <div key={x} style={{ position: 'absolute', left: x - 8, top: -14, width: 16, height: 40, borderRadius: 8, background: T.ink }} />)}
        </div>
        <Sticker f={f} e="⏰" at={26} x={DW / 2 + 200} y={tall ? 80 : 140} size={64} rot={12} />
        <div style={{ position: 'absolute', left: 0, top: tall ? 290 : 380, width: DW / LS, transform: `scale(${LS})`, transformOrigin: '0 0', fontFamily: FB, fontSize: 15, lineHeight: 1.45, color: T.ink }}>
          <Sec title="Activity" right="November 2026" />
          <Card style={{ paddingTop: 5, paddingBottom: 5, minHeight: 200 }}>
            {BILLS.map((b, i) => {
              if (f < at[i]) return null;
              const p = pop(f, at[i], { damping: 10, stiffness: 180 });
              return (
                <div key={i} style={{ transform: `translateY(${(1 - p) * -220}px) rotate(${(1 - p) * (i % 2 ? 8 : -8)}deg)`, opacity: Math.min(1, p * 2) }}>
                  <ExpenseRow first={!i} {...b} />
                </div>
              );
            })}
          </Card>
        </div>
      </Fit>
      <Caption lines={[{ t: 'Rent, maid, cook.', at: 6 }, { t: '*Set once*, added every month.', at: 22 }]} size={tall ? 80 : 56} />
    </>
  );
}
