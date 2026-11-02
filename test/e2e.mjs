// Core API flow: create, join, approve, import, link placeholders, offline idempotency, monthly bills.
import fs from 'fs';
import { parseTricount } from '../src/core.js';
import { B, call, ok, balances, newFlat } from './lib.mjs';

const csv = fs.readFileSync(new URL('./fixtures/tricount-sample.csv', import.meta.url), 'utf8');
const parsed = parseTricount(csv);
// Expected balances straight from the CSV's own numbers (floats), to compare against the server.
const want = {};
for (const r of parsed.rows) { want[r.payer] = (want[r.payer] || 0) + r.amount / 100; for (const [n, a] of r.shares) want[n] = (want[n] || 0) - a / 100; }

let { token: admin, me } = await newFlat('Asha');
ok(me.me.role === 'admin' && me.flat.invite_code.length === 6 && me.flat.simplify === 1, 'flat created: admin, 6-char code, simplify on by default');
ok((await call(null, 'POST', '/api/join', { code: 'NOPE00', name: 'X' })).s === 404, 'wrong invite code rejected');
const ben = (await call(null, 'POST', '/api/join', { code: me.flat.invite_code.toLowerCase(), name: 'Ben' })).d.token;
const b1 = (await call(ben, 'GET', '/api/me')).d;
ok(b1.me.status === 'pending' && !b1.expenses && b1.flat.admin === 'Asha', 'joiner is pending and sees no data');
ok((await call(ben, 'POST', '/api/expenses', { amount: 5, split: [] })).s === 403, 'pending member cannot add');

const imp = (await call(admin, 'POST', '/api/import', { people: { Asha: me.me.id, Ben: 'new', Chen: 'new' }, rows: parsed.rows })).d;
ok(imp.added === parsed.rows.length && imp.skipped === 0, 'import: ' + JSON.stringify(imp));
me = (await call(admin, 'GET', '/api/me')).d;
const got = balances(me);
ok(['Asha', 'Ben', 'Chen'].every(n => Math.abs(got[n] - want[n]) < 0.05), `balances match the CSV: ${JSON.stringify(got)}`);
const again = (await call(admin, 'POST', '/api/import', { people: { Asha: me.me.id, Ben: me.members.find(m => m.name === 'Ben' && m.status === 'placeholder').id, Chen: me.members.find(m => m.name === 'Chen').id }, rows: parsed.rows })).d;
ok(again.added === 0 && again.duplicates === parsed.rows.length, 're-import adds nothing');

const pend = me.members.find(m => m.status === 'pending'), ph = me.members.find(m => m.status === 'placeholder' && m.name === 'Ben');
ok((await call(ben, 'POST', `/api/members/${pend.id}/approve`, {})).s === 403, 'non-admin cannot approve');
ok((await call(admin, 'POST', `/api/members/${pend.id}/approve`, { as: ph.id })).d.linked === 'Ben', 'approve links joiner to imported Ben');
const b2 = (await call(ben, 'GET', '/api/me')).d;
ok(b2.me.id === ph.id && b2.expenses.length === parsed.rows.length, 'Ben signs in and sees his history as himself');

const ids = b2.members.filter(m => m.status !== 'pending').map(m => m.id);
const body = { cid: 'offline-1', amount: '450', description: 'Milk', paidBy: ph.id, split: ids, at: Date.now() };
const a1 = await call(ben, 'POST', '/api/expenses', body), a2 = await call(ben, 'POST', '/api/expenses', body);
ok(a1.d.ok && a2.d.duplicate, 'an offline entry sent twice is stored once');
const milk = (await call(ben, 'GET', '/api/me')).d.expenses.find(x => x.description === 'Milk');
ok(JSON.parse(milk.split).reduce((a, [, x]) => a + x, 0) === 45000, '₹450 split three ways sums exactly');
ok((await call(admin, 'DELETE', '/api/expenses/' + milk.id)).s === 200, 'admin can delete any entry');
const mine = (await call(admin, 'POST', '/api/expenses', { amount: '10', split: [me.me.id] }), (await call(admin, 'GET', '/api/me')).d.expenses[0]);
ok((await call(ben, 'DELETE', '/api/expenses/' + mine.id)).s === 403, "members can't delete someone else's entry");

ok((await call(ben, 'POST', '/api/flat', { simplify: false })).s === 403, 'only admin changes simplify');
await call(admin, 'POST', '/api/flat', { simplify: false });
ok((await call(admin, 'GET', '/api/me')).d.flat.simplify === 0, 'admin turns simplify off');
await call(admin, 'POST', '/api/flat', { simplify: true });

ok((await call(ben, 'POST', '/api/expenses', { kind: 'settle', amount: '1000', paidBy: ph.id, split: [me.me.id] })).d.ok, 'settle-up payment recorded');
ok((await call(admin, 'POST', '/api/recurring', { description: 'Rent', amount: '30000', day: 1, paidBy: me.me.id, split: [], addNow: true })).d.ok, 'monthly bill saved');
let s3 = (await call(admin, 'GET', '/api/me')).d;
ok(s3.recurring.length === 1 && s3.expenses.filter(x => x.source === 'auto').length === 1, "add-now created this month's rent");
await fetch(B + '/__scheduled?cron=30+2+*+*+*'); s3 = (await call(admin, 'GET', '/api/me')).d;
ok(s3.expenses.filter(x => x.source === 'auto').length === 1, 'the daily run does not add it twice');
const rel = (await call(admin, 'POST', `/api/members/${ph.id}/relogin`)).d.token;
ok((await call(ben, 'GET', '/api/me')).s === 401 && (await call(rel, 'GET', '/api/me')).s === 200, 'a new login link replaces the old login');
const page = await (await fetch(B + '/')).text();
ok(page.includes('function settlePlan(') && page.includes('const CONFIG = ') && !page.includes('/*__CORE__*/'), 'page is served with shared core and config inlined');
