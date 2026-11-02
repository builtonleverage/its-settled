// 7–11s: tap +, type 450, tap Milk, Save. "Added" toast, balance counts up.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { rs } from '../brand.js';
import { Btn, Chip, Chips, Input, Label, Nav, Phone, Sheet, Toast } from '../app-ui.jsx';
import { Caption, Fit, TapRing, boxes, lerp, pop, press, snap, EIO, useL } from '../kit.jsx';
import { HomeScreen } from './Home.jsx';

export const ROWS = [
  { icon: '💡', desc: 'Electricity', sub: 'You paid · 28 Oct', amt: '₹3,240', a2: 'you lent ₹2,160', a2cls: 'pos' },
  { icon: '📶', desc: 'Wifi recharge', sub: 'Rohan paid · 25 Oct', amt: '₹900', a2: 'your share ₹300', a2cls: 'neg' },
];
const TAP_FAB = 12, TAP_MILK = 52, TAP_SAVE = 66, CLOSE = 70;

export function S3Add() {
  const f = useCurrentFrame();
  const { tall } = useL();
  const open = f < CLOSE ? snap(f, 15) : 1 - snap(f, CLOSE, { damping: 22 });
  const amount = f >= 40 ? '450' : f >= 34 ? '45' : f >= 28 ? '4' : '';
  const toast = f < 72 ? 0 : f < 108 ? pop(f, 72, { damping: 10 }) : lerp(f, [108, 114], [1, 0]);
  const added = f >= 74;
  const k = lerp(f, [76, 98], [0, 1], EIO);
  const bump = f >= 76 && f < 104 ? Math.sin(lerp(f, [76, 104], [0, Math.PI])) : 0;
  const quick = ['Groceries', 'Milk', 'Electricity', 'Wifi', 'Gas', 'Water'];
  return (
    <>
      <Fit box={boxes(tall, 'side').vis} w={384} h={724}>
        <Phone h={700}>
          <HomeScreen
            hero={{ label: 'Overall, you get back', amount: rs(1250 + 300 * k), sub: `3 flatmates · ${added ? 13 : 12} entries`, bump }}
            settle={[{ from: 'Rohan', to: 'You', who: 'You receive', whoCls: 'pos', amt: rs(750 + 150 * k) }, { from: 'Aman', to: 'You', who: 'You receive', whoCls: 'pos', amt: rs(500 + 150 * k) }]}
            newRow={added ? { icon: '🛒', desc: 'Milk', sub: 'You paid · 2 Nov', amt: '₹450', a2: 'you lent ₹300', a2cls: 'pos' } : null}
            newP={added ? pop(f, 74, { damping: 14 }) : 0}
            rows={ROWS} />
          <Nav f={f} tapAt={TAP_FAB} fabPress={press(f, TAP_FAB)} />
          {f >= 14 && (
            <Sheet p={open}>
              <div style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Add expense</div>
              <Label>Amount</Label>
              <Input huge value={amount} placeholder="₹0" focus={f < TAP_MILK} caret={f < TAP_MILK && Math.floor(f / 8) % 2 === 0} />
              <Label>What for</Label>
              <Input value={f >= TAP_MILK + 1 ? 'Milk' : ''} placeholder="Groceries" focus={f >= TAP_MILK + 1} />
              <Chips style={{ marginTop: 8 }}>{quick.map(q => <Chip key={q} f={f} tapAt={q === 'Milk' ? TAP_MILK : -99}>{q}</Chip>)}</Chips>
              <Label>Paid by</Label>
              <Chips>{['You', 'Aman', 'Rohan'].map((n, i) => <Chip key={n} on={!i}>{n}</Chip>)}</Chips>
              <Label>Split equally between</Label>
              <Chips>{['You', 'Aman', 'Rohan'].map(n => <Chip key={n} on>{n}</Chip>)}</Chips>
              <div style={{ marginTop: 20, transform: `scale(${press(f, TAP_SAVE)})` }}>
                <Btn block>Save<TapRing f={f} at={TAP_SAVE} /></Btn>
              </div>
            </Sheet>
          )}
          <Toast text="Added" p={toast} />
        </Phone>
      </Fit>
      <Caption lines={[{ t: 'Add an expense in *two taps*.', at: 6 }]} />
    </>
  );
}
