// The real app's screens, rebuilt from the CSS in src/app.html (same sizes, radii, colors, copy).
import React from 'react';
import { FB, FD, T } from './brand.js';
import { TapRing, press } from './kit.jsx';

const ic = d => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
export const I = {
  home: ic(<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />),
  bills: ic(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  flat: ic(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.6c2.6.1 4.4 1.9 5 5.4" /></>),
  settle: ic(<path d="M4 8h13l-3-3M20 16H7l3 3" />),
  plus: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
};

// The app icon: green rounded square with a white check (same path as /icon.svg). draw: 0..1
export function Logo({ size = 200, draw = 1 }) {
  const len = 330;
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} style={{ display: 'block', filter: 'drop-shadow(0 18px 30px rgba(31,107,85,.35))' }}>
      <rect width="512" height="512" rx="112" fill={T.accent} />
      <path d="M146 268l74 74 146-170" fill="none" stroke="#fff" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
    </svg>
  );
}

export function SignalBars({ level = 4, color = T.ink }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 12, position: 'relative' }}>
      {[0, 1, 2, 3].map(i => {
        const on = Math.max(0, Math.min(1, level - i));
        return <div key={i} style={{ width: 3.5, height: 4 + i * 2.7, borderRadius: 1, background: color, opacity: 0.22 + 0.78 * on }} />;
      })}
    </div>
  );
}
function StatusBar({ signal = 4 }) {
  return (
    <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px 0 30px', fontFamily: FB, fontWeight: 700, fontSize: 14, position: 'relative' }}>
      <span>9:41</span>
      <div style={{ position: 'absolute', left: '50%', top: 9, width: 92, height: 26, marginLeft: -46, borderRadius: 20, background: '#0b0f0d' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SignalBars level={signal} />
        {signal < 0.5 && <span style={{ fontSize: 11, fontWeight: 700, color: T.neg }}>✕</span>}
        <div style={{ width: 23, height: 11, borderRadius: 3, border: `1.4px solid ${T.ink}`, padding: 1, opacity: 0.9 }}><div style={{ width: '72%', height: '100%', borderRadius: 1.5, background: T.ink }} /></div>
      </div>
    </div>
  );
}

// Phone frame. Screen is 360 x h logical px (the app's phone viewport).
export function Phone({ children, h = 700, signal = 4, fadeBottom = false }) {
  return (
    <div style={{ width: 384, height: h + 24, borderRadius: 58, background: '#141a17', padding: 12, boxShadow: '0 40px 90px rgba(20,35,28,.28), 0 8px 22px rgba(20,35,28,.18), inset 0 0 0 2px #2b3530' }}>
      <div style={{ width: 360, height: h, borderRadius: 46, background: T.bg, overflow: 'hidden', position: 'relative', fontFamily: FB, color: T.ink, fontSize: 15, lineHeight: 1.45 }}>
        <StatusBar signal={signal} />
        {children}
        {fadeBottom && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, background: `linear-gradient(to bottom, rgba(238,241,236,0), ${T.bg})` }} />}
      </div>
    </div>
  );
}
export const Wrap = ({ children }) => <div style={{ padding: '0 16px' }}>{children}</div>;

export function Spin({ s = 10 }) {
  return <span style={{ width: s, height: s, border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />;
}
// .pill / .pill.off
export function Pill({ kind = 'ok', text, spinRot = 0 }) {
  const off = kind === 'off';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 99, whiteSpace: 'nowrap',
      background: off ? T.warnSoft : T.chip, color: off ? T.warn : T.muted }}>
      {kind === 'sync' ? <span style={{ display: 'inline-flex', transform: `rotate(${spinRot}deg)` }}><Spin /></span>
        : <i style={{ width: 7, height: 7, borderRadius: '50%', background: off ? T.warn : T.accent, display: 'inline-block' }} />}
      {text}
    </span>
  );
}
export function TopBar({ name = 'Flat 402', pill }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0 14px' }}>
      <h1 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>{name}</h1>
      {pill ?? <Pill text="Up to date" />}
    </div>
  );
}
export const Card = ({ children, style }) => (
  <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, boxShadow: T.sh, marginBottom: 12, ...style }}>{children}</div>
);
export function Hero({ label, amount, cls = 'pos', sub, bump = 0 }) {
  return (
    <Card style={{ padding: '20px 18px' }}>
      <div style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: FD, fontSize: 40, fontWeight: 700, lineHeight: 1.1, margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em',
        color: cls === 'pos' ? T.accent : cls === 'neg' ? T.neg : T.ink, transform: `scale(${1 + bump * 0.08})`, transformOrigin: 'left center' }}>{amount}</div>
      <div style={{ fontSize: 13, color: T.muted }}>{sub}</div>
    </Card>
  );
}
export const Sec = ({ title, right }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, margin: '20px 2px 8px' }}>
    <h2 style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>{right && <span style={{ fontSize: 13, color: T.muted }}>{right}</span>}
  </div>
);
export const Ico = ({ children }) => (
  <div style={{ width: 38, height: 38, borderRadius: 12, background: T.chip, display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700, flex: 'none' }}>{children}</div>
);
const ell = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
// expenseRow(): icon, description, "X paid · date", amount, your share/you lent.
export function ExpenseRow({ icon, desc, sub, tag, amt, a2, a2cls = 'faint', first, style }) {
  const c = a2cls === 'pos' ? T.accent : a2cls === 'neg' ? T.neg : T.faint;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: first ? 0 : `1px solid ${T.line}`, ...style }}>
      <Ico>{icon}</Ico>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, ...ell }}>{desc}</div>
        <div style={{ fontSize: 13, color: T.muted, ...ell }}>{sub}{tag}</div>
      </div>
      <div style={{ textAlign: 'right', flex: 'none' }}>
        <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{amt}</div>
        <div style={{ fontSize: 12, color: c }}>{a2}</div>
      </div>
    </div>
  );
}
export const Btn = ({ children, ghost, sm, block, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: sm ? 34 : 46, padding: sm ? '0 12px' : '0 18px', borderRadius: sm ? 10 : 14,
    fontSize: sm ? 13 : 15, fontWeight: 600, background: ghost ? T.chip : T.accent, color: ghost ? T.ink : T.accentInk, whiteSpace: 'nowrap', width: block ? '100%' : undefined, position: 'relative', ...style }}>{children}</div>
);
// Settle up row: "A → B", who line, amount, Paid button.
export function SettleRow({ from, to, who, whoCls, amt, first }) {
  const c = whoCls === 'pos' ? T.accent : whoCls === 'neg' ? T.neg : T.muted;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: first ? 0 : `1px solid ${T.line}` }}>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{from} → {to}</div><div style={{ fontSize: 13, color: c }}>{who}</div></div>
      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{amt}</div>
      <Btn sm ghost>Paid</Btn>
    </div>
  );
}
export function Banner({ children }) {
  return <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: T.accentSoft, color: T.ink, borderRadius: 14, padding: '10px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{children}</div>;
}
// Bottom tab bar with the green + in the middle.
export function Nav({ guest, f = 0, tapAt = -99, fabPress = 1 }) {
  const b = (label, icon, on) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: on ? T.ink : T.faint }}>{icon}{label}</div>
  );
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: T.card, borderTop: `1px solid ${T.line}`, height: 76, paddingBottom: 12, zIndex: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 76px 1fr 1fr', alignItems: 'center', height: 64 }}>
        {b('Home', I.home, true)}{guest ? <span /> : b('Monthly', I.bills)}
        <div style={{ width: 56, height: 56, borderRadius: 18, background: T.accent, color: T.accentInk, margin: '-26px auto 0', boxShadow: '0 6px 18px rgba(31,107,85,.35)',
          display: 'grid', placeItems: 'center', position: 'relative', transform: `scale(${fabPress})` }}>{I.plus}<TapRing f={f} at={tapAt} /></div>
        {b('Settle', I.settle)}{b(guest ? 'You' : 'Flat', I.flat)}
      </div>
    </div>
  );
}
export function Chip({ children, on, f = 0, tapAt = -99 }) {
  return (
    <div style={{ height: 36, padding: '0 13px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 500, position: 'relative',
      background: on ? T.accentSoft : T.chip, border: `1.5px solid ${on ? T.accent : 'transparent'}`, transform: `scale(${press(f, tapAt)})` }}>{children}<TapRing f={f} at={tapAt} size={44} /></div>
  );
}
export const Chips = ({ children, style }) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', ...style }}>{children}</div>;
export const Label = ({ children }) => <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, margin: '14px 0 6px' }}>{children}</div>;
export function Input({ value, placeholder, huge, focus, caret }) {
  return (
    <div style={{ width: '100%', height: huge ? 68 : 48, borderRadius: 13, border: `1px solid ${focus ? T.accent : T.line}`, background: T.bg, padding: '0 14px', display: 'flex', alignItems: 'center',
      fontSize: huge ? 34 : 16, fontFamily: huge ? FD : FB, fontWeight: huge ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ color: value ? T.ink : T.faint }}>{value || placeholder}</span>
      {caret && <span style={{ width: 2, height: huge ? 38 : 22, background: T.accent, marginLeft: 2 }} />}
    </div>
  );
}
// Bottom sheet with scrim. p: 0 hidden .. 1 open
export function Sheet({ p, children }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,14,11,.45)', opacity: Math.min(1, p), zIndex: 20 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: T.card, borderRadius: '22px 22px 0 0', padding: '10px 18px 22px', zIndex: 21, transform: `translateY(${(1 - p) * 105}%)` }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: T.line, margin: '0 auto 12px' }} />
        {children}
      </div>
    </>
  );
}
export function Toast({ text, p }) {
  if (p <= 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: 96, transform: `translateX(-50%) scale(${0.6 + 0.4 * p}) translateY(${(1 - p) * 20}px)`, opacity: Math.min(1, p * 1.5),
      background: T.ink, color: T.bg, padding: '11px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, zIndex: 40, whiteSpace: 'nowrap' }}>{text}</div>
  );
}
