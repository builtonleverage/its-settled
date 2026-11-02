// The Home tab as the app renders it: top bar, balance card, settle up, activity.
import React from 'react';
import { Card, ExpenseRow, Hero, Sec, SettleRow, TopBar, Wrap } from '../app-ui.jsx';

export function HomeScreen({ pill, hero, settle = [], rows = [], settleNote = 'simplified', newRow, newP = 1 }) {
  return (
    <Wrap>
      <TopBar pill={pill} />
      <Hero {...hero} />
      {settle.length > 0 && <>
        <Sec title="Settle up" right={settleNote} />
        <Card>{settle.map((s, i) => <SettleRow key={i} first={!i} {...s} />)}</Card>
      </>}
      <Sec title="Activity" />
      <Card style={{ paddingTop: 5, paddingBottom: 5 }}>
        {newRow && (
          <div style={{ height: 61 * newP, overflow: 'hidden', opacity: Math.min(1, newP * 1.4) }}>
            <ExpenseRow first {...newRow} style={{ transform: `translateX(${(1 - newP) * 40}px)` }} />
          </div>
        )}
        {rows.map((r, i) => <ExpenseRow key={i} first={!i && !newRow} {...r} />)}
      </Card>
    </Wrap>
  );
}
