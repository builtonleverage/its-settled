// 27–30s: "450 milk" to the Telegram bot, bot replies "split 3 ways".
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FB, FD, T } from '../brand.js';
import { Caption, Fit, Sticker, boxes, lerp, pop, useL } from '../kit.jsx';

const TG = '#2aabee'; // Telegram's blue, only for its small plane badge

export function S8Telegram() {
  const f = useCurrentFrame();
  const { tall } = useL();
  const typed = '450 milk'.slice(0, Math.max(0, Math.floor((f - 4) / 1.6)));
  const sent = f >= 20;
  const me = pop(f, 20, { damping: 10 });
  const typing = f >= 26 && f < 40;
  const bot = pop(f, 40, { damping: 10 });
  const win = pop(f, 0, { damping: 14 });
  return (
    <>
      <Fit box={boxes(tall, 'side').vis} w={720} h={900}>
        <div style={{ position: 'absolute', left: 0, top: 40, width: 720, height: 820, borderRadius: 44, background: T.card, border: `1px solid ${T.line}`, boxShadow: '0 30px 70px rgba(20,35,28,.18)', overflow: 'hidden',
          fontFamily: FB, transform: `scale(${0.9 + 0.1 * win})` }}>
          <div style={{ height: 130, display: 'flex', alignItems: 'center', gap: 22, padding: '0 32px', borderBottom: `1px solid ${T.line}` }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 82, height: 82, borderRadius: '50%', background: T.accent, display: 'grid', placeItems: 'center' }}>
                <svg viewBox="0 0 512 512" width="52" height="52"><path d="M146 268l74 74 146-170" fill="none" stroke="#fff" strokeWidth="60" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div style={{ position: 'absolute', right: -6, bottom: -6, width: 38, height: 38, borderRadius: '50%', background: TG, border: `3px solid ${T.card}`, display: 'grid', placeItems: 'center' }}>
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M21 4 3 11l6 2 2 6 3-4 5 4z" fill="#fff" /></svg>
              </div>
            </div>
            <div><div style={{ fontWeight: 800, fontSize: 34, color: T.ink }}>It's Settled bot</div><div style={{ fontSize: 24, color: T.muted, fontWeight: 600 }}>{typing ? 'typing…' : 'bot · Telegram'}</div></div>
          </div>
          {sent && (
            <div style={{ position: 'absolute', right: 30, top: 180, padding: '18px 28px', borderRadius: '30px 30px 8px 30px', background: T.accentSoft, fontSize: 44, fontWeight: 700, color: T.ink,
              transform: `scale(${me})`, transformOrigin: 'right bottom' }}>450 milk<span style={{ fontSize: 22, color: T.accent, marginLeft: 14, fontWeight: 700 }}>✓✓</span></div>
          )}
          {typing && (
            <div style={{ position: 'absolute', left: 30, top: 320, padding: '22px 28px', borderRadius: '30px 30px 30px 8px', background: T.chip, display: 'flex', gap: 10 }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: T.muted, transform: `translateY(${Math.sin(f / 2 + i) * 5}px)` }} />)}
            </div>
          )}
          {f >= 40 && (
            <div style={{ position: 'absolute', left: 30, top: 320, width: 600, padding: '22px 28px', borderRadius: '30px 30px 30px 8px', background: T.chip, color: T.ink,
              transform: `scale(${bot})`, transformOrigin: 'left top' }}>
              <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.3 }}>✅ ₹450 · milk — <span style={{ color: T.accent, fontWeight: 800 }}>split 3 ways</span> (₹150 each).</div>
              <div style={{ fontSize: 24, color: T.muted, marginTop: 10, fontWeight: 600 }}>/undo to remove · /bal for balances</div>
            </div>
          )}
          <div style={{ position: 'absolute', left: 24, right: 24, bottom: 24, height: 86, borderRadius: 43, background: T.bg, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', padding: '0 32px', fontSize: 34, fontWeight: 600 }}>
            <span style={{ color: sent ? T.faint : T.ink }}>{sent ? 'Message' : typed || 'Message'}</span>
            {!sent && <span style={{ width: 3, height: 40, background: T.accent, marginLeft: 3, opacity: Math.floor(f / 6) % 2 ? 0.2 : 1 }} />}
            <div style={{ marginLeft: 'auto', width: 62, height: 62, borderRadius: '50%', background: T.accent, display: 'grid', placeItems: 'center', transform: `scale(${f >= 16 && f <= 22 ? 0.85 : 1})` }}>
              <svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        </div>
        <Sticker f={f} e="🥛" at={48} x={640} y={640} size={74} rot={14} />
      </Fit>
      <Caption lines={[{ t: 'Or just *text it*.', at: 6 }]} size={tall ? 96 : 66} />
    </>
  );
}
