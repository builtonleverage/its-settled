// 20–24s: Neha rolls in with a suitcase, gets a link, and her phone shows only her dinner.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FB, FD, T } from '../brand.js';
import { Banner, Card, ExpenseRow, Hero, Nav, Phone, Sec, SettleRow, TopBar, Wrap } from '../app-ui.jsx';
import { Caption, Fit, boxes, lerp, pop, snap, EIO, EO, useL } from '../kit.jsx';

const W = 640, H = 1050;

export function S6Guests() {
  const f = useCurrentFrame();
  const { tall } = useL();
  const roll = lerp(f, [6, 26], [1, 0], EO);
  const tag = pop(f, 24, { damping: 8 });
  const link = pop(f, 34, { damping: 11 });
  const shrink = lerp(f, [58, 72], [0, 1], EIO);
  const phone = snap(f, 60, { damping: 16 });
  // Phase A group, then it shrinks into the top strip when the phone rises.
  const gS = 1 - shrink * 0.45, gY = lerp(shrink, [0, 1], [170, -4]), gX = lerp(shrink, [0, 1], [0, 90]);
  return (
    <>
      <Fit box={boxes(tall, 'side').vis} w={W} h={H}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: 560, transform: `translate(${gX}px, ${gY}px) scale(${gS})`, transformOrigin: '0 0' }}>
          {/* Neha + suitcase rolling in */}
          <div style={{ position: 'absolute', left: 40 + roll * 700, top: 20, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ width: 190, height: 190, borderRadius: '50%', background: T.warnSoft, display: 'grid', placeItems: 'center', fontFamily: FD, fontWeight: 700, fontSize: 100,
              color: T.ink, border: `4px solid ${T.card}`, boxShadow: '0 14px 30px rgba(20,35,28,.14)', transform: `rotate(${-roll * 400}deg)` }}>N</div>
            <div style={{ fontSize: 120, lineHeight: 1, transform: `rotate(${-roll * 300}deg) translateY(${Math.abs(Math.sin(f / 2)) * -6 * (roll > 0 ? 1 : 0)}px)` }}>🧳</div>
          </div>
          <div style={{ position: 'absolute', left: 40, top: 222, fontFamily: FB, fontWeight: 800, fontSize: 46, color: T.ink, opacity: lerp(f, [18, 24], [0, 1]) }}>
            Neha <span style={{ fontSize: 24, fontWeight: 700, padding: '4px 12px', borderRadius: 10, background: T.chip, color: T.muted, verticalAlign: 8 }}>guest</span>
          </div>
          {f >= 24 && (
            <div style={{ position: 'absolute', left: 300, top: 24, transform: `scale(${tag}) rotate(${-10 + (1 - tag) * 30}deg)`, transformOrigin: '0 50%' }}>
              <div style={{ position: 'relative', padding: '16px 28px 16px 52px', borderRadius: '16px 22px 22px 16px', background: T.accent, color: '#fff', fontFamily: FD, fontWeight: 800, fontSize: 38, whiteSpace: 'nowrap', boxShadow: '0 10px 24px rgba(31,107,85,.35)' }}>
                <span style={{ position: 'absolute', left: 18, top: '50%', marginTop: -9, width: 18, height: 18, borderRadius: '50%', background: T.bg }} />until Sunday
              </div>
            </div>
          )}
          {/* WhatsApp-style message with the login link */}
          {f >= 34 && (
            <div style={{ position: 'absolute', left: 40, top: 300, width: 560, transform: `scale(${link * (1 - shrink)})`, opacity: 1 - shrink, transformOrigin: '0 0', background: T.accentSoft, borderRadius: '30px 30px 30px 8px',
              padding: 14, boxShadow: '0 12px 30px rgba(20,35,28,.12)', fontFamily: FB }}>
              <div style={{ background: T.card, borderRadius: 20, padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 66, height: 66, borderRadius: 16, background: T.accent, display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <svg viewBox="0 0 512 512" width="44" height="44"><path d="M146 268l74 74 146-170" fill="none" stroke="#fff" strokeWidth="60" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div><div style={{ fontWeight: 800, fontSize: 28, color: T.ink }}>It's Settled</div><div style={{ fontSize: 22, color: T.muted, fontWeight: 600 }}>Tap to open · no sign-up</div></div>
              </div>
              <div style={{ fontSize: 27, fontWeight: 600, color: T.ink, padding: '12px 8px 4px', lineHeight: 1.3 }}>Hi Neha! Track what we spend while you're here 🔗</div>
            </div>
          )}
        </div>
        {/* Neha's own phone: only her entry */}
        {f >= 58 && (
          <div style={{ position: 'absolute', left: (W - 384 * 1.2) / 2, top: 180, transform: `translateY(${(1 - phone) * 900}px) scale(1.2)`, transformOrigin: '0 0' }}>
            <Phone h={700}>
              <Wrap>
                <TopBar />
                <Banner><span>Guest of Aman until Sun, 8 Nov. You see only entries you're part of.</span></Banner>
                <Hero label="Overall, you get back" amount="₹1,200" sub="1 shared entry" />
                <Sec title="Settle up" right="directly" />
                <Card>
                  <SettleRow first from="Arjun" to="You" who="You receive" whoCls="pos" amt="₹600" />
                  <SettleRow from="Aman" to="You" who="You receive" whoCls="pos" amt="₹600" />
                </Card>
                <Sec title="Activity" />
                <Card style={{ paddingTop: 5, paddingBottom: 5 }}>
                  <ExpenseRow first icon="🍽️" desc="Dinner at Paradise" sub="You paid · 31 Oct" amt="₹1,800" a2="you lent ₹1,200" a2cls="pos" />
                </Card>
              </Wrap>
              <Nav guest />
            </Phone>
          </div>
        )}
      </Fit>
      <Caption lines={[{ t: 'Friends staying over?', at: 6 }, { t: 'They see *only their share*.', at: 30 }]} size={tall ? 80 : 56} />
    </>
  );
}
