// Unit tests for src/core.js (no server needed): node test/core.test.mjs
import fs from 'fs';
import * as core from '../src/core.js';
const { equalShares, netBalances, pairDebts, settlePlan, parseTricount, toPaise } = core;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ex = (paid_by, amount, ids) => ({ paid_by, amount, split: equalShares(amount, ids) });
const sum = plan => plan.reduce((a, d) => a + d.amount, 0);
const apply = (net, plan) => { const n = { ...net }; for (const d of plan) { n[d.from] += d.amount; n[d.to] -= d.amount; } return n; };
const zero = n => Object.values(n).every(v => Math.abs(v) < 100);

ok(toPaise('1,200.50') === 120050 && toPaise('₹ 45') === 4500 && toPaise('-5') === 0 && toPaise('abc') === 0, 'toPaise parses and rejects');
ok(equalShares(100000, ['a', 'b', 'c']).reduce((a, [, x]) => a + x, 0) === 100000, 'equal shares always sum exactly');

// The chain from the request: A owes B, B owes C → A pays C.
const chain = [ex('B', 10000, ['A']), ex('C', 10000, ['B'])]; // B paid for A; C paid for B
const members = ['A', 'B', 'C'].map(id => ({ id, role: 'member' }));
const simple = settlePlan(members, chain, true), direct = settlePlan(members, chain, false);
ok(simple.length === 1 && simple[0].from === 'A' && simple[0].to === 'C' && simple[0].amount === 10000, 'simplify ON: A pays C directly');
ok(direct.length === 2 && direct.some(d => d.from === 'A' && d.to === 'B') && direct.some(d => d.from === 'B' && d.to === 'C'), 'simplify OFF: A pays B, B pays C');

// Guests always settle directly, even with simplify on.
const gm = [...members, { id: 'G', role: 'guest' }];
const withGuest = [...chain, ex('A', 3000, ['A', 'G', 'B'])]; // A paid dinner for A, G, B
const gp = settlePlan(gm, withGuest, true);
ok(gp.some(d => d.from === 'G' && d.to === 'A' && d.amount === 1000), 'guest pays their host directly');
ok(!gp.some(d => (d.from === 'G' || d.to === 'G') && d.to !== 'A'), 'guest is never routed to someone they did not share with');

// Both modes clear everyone's balance exactly, on random data.
let seed = 42; const r = n => (seed = (seed * 16807) % 2147483647) % n;
for (let t = 0; t < 200; t++) {
  const ids = ['a', 'b', 'c', 'd', 'e'].slice(0, 2 + r(4)), es = [];
  for (let i = 0; i < 1 + r(20); i++) es.push(ex(ids[r(ids.length)], 100 + r(900000), ids.filter(() => r(2)).concat(ids[r(ids.length)])));
  const ms = ids.map(id => ({ id, role: r(5) ? 'member' : 'guest' })), net = netBalances(es);
  for (const s of [true, false]) {
    const plan = settlePlan(ms, es, s);
    if (!zero(apply(net, plan))) { ok(false, `plan clears balances (trial ${t}, simplify ${s})`); process.exit(1); }
  }
  if (settlePlan(ms, es, true).length > settlePlan(ms, es, false).length) { ok(false, `simplified never needs more payments (trial ${t})`); process.exit(1); }
}
ok(true, '200 random flats: both modes clear every balance; simplified never needs more payments');

const csv = fs.readFileSync(new URL('./fixtures/tricount-sample.csv', import.meta.url), 'utf8');
const p = parseTricount(csv);
ok(p.rows.length === 42 && p.skipped === 0 && p.names.sort().join() === 'Asha,Ben,Chen', 'fixture parses: 42 rows, 3 people');
ok(p.rows.every(r => r.shares.reduce((a, [, x]) => a + x, 0) === r.amount), 'every imported row sums exactly (rounding fixed)');
ok(p.rows.some(r => r.kind === 'settle') && p.rows.some(r => r.amount < 0), 'transfer → settle, income → negative');
let threw = false; try { parseTricount('a,b\n1,2'); } catch { threw = true; } ok(threw, 'non-Tricount CSV is rejected with a message');
ok(pairDebts([ex('a', 300, ['a', 'b', 'c'])]).length === 2, 'pair debts: two people owe the payer');
