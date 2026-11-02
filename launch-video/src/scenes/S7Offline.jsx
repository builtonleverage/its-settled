// 24–27s: signal drops, "Offline · 1 queued", signal returns, "Up to date".
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { rs } from '../brand.js';
import { Phone, Pill } from '../app-ui.jsx';
import { Caption, Fit, Sticker, boxes, lerp, pop, useL } from '../kit.jsx';
import { HomeScreen } from './Home.jsx';
import { ROWS } from './S3Add.jsx';

export function S7Offline() {
  const f = useCurrentFrame();
  const { tall } = useL();
  const signal = f < 44 ? lerp(f, [6, 20], [4, 0]) : lerp(f, [44, 54], [0, 4]);
  const state = f < 18 ? 'ok' : f < 54 ? 'off' : f < 62 ? 'sync' : 'done';
  const pill = state === 'off' ? <Pill kind="off" text={f >= 26 ? 'Offline · 1 queued' : 'Offline'} />
    : state === 'sync' ? <Pill kind="sync" text="Syncing" spinRot={f * 24} /> : <Pill text="Up to date" />;
  const pillPop = state === 'off' ? pop(f, 18, { damping: 8 }) : state === 'done' ? pop(f, 62, { damping: 8 }) : 1;
  const queued = f >= 26;
  const zoom = 2.05;
  return (
    <>
      <Fit box={boxes(tall, 'side').vis} w={384 * zoom} h={470 * zoom}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', position: 'relative' }}>
          <Phone h={446} signal={signal} fadeBottom>
            <div style={{ position: 'relative' }}>
              <HomeScreen
                pill={<span style={{ display: 'inline-block', transform: `scale(${pillPop})`, transformOrigin: 'right center' }}>{pill}</span>}
                hero={{ label: 'Overall, you get back', amount: rs(queued ? 2150 : 1550), sub: `3 flatmates · ${queued ? 14 : 13} entries` }}
                newRow={queued ? { icon: '🛒', desc: 'Groceries', sub: 'You paid · 2 Nov', tag: state === 'done' ? null : <> · <b style={{ color: '#865b0d' }}>waiting to sync</b></>, amt: '₹900', a2: 'you lent ₹600', a2cls: 'pos' } : null}
                newP={queued ? pop(f, 26, { damping: 14 }) : 0}
                rows={[{ icon: '🛒', desc: 'Milk', sub: 'You paid · 2 Nov', amt: '₹450', a2: 'you lent ₹300', a2cls: 'pos' }, ...ROWS]} />
            </div>
          </Phone>
        </div>
        <Sticker f={f} e="📵" at={16} x={330 * 2.05} y={26 * 2.05} size={52} rot={10} />
        <Sticker f={f} e="✅" at={63} x={60 * 2.05} y={20 * 2.05} size={52} rot={-12} />
      </Fit>
      <Caption lines={[{ t: 'No signal?', at: 6 }, { t: "It *syncs* when you're back.", at: 20 }]} size={tall ? 84 : 58} />
    </>
  );
}
