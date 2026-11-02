// Backups: needs `node test/mock-sheet.mjs` running and, in .dev.vars,
// BACKUP_URL=http://localhost:9999/exec and BACKUP_SECRET=bksecret.
import fs from 'fs';
import { parseTricount } from '../src/core.js';
import { B, call, ok, wait, balances, newFlat } from './lib.mjs';

const rows = parseTricount(fs.readFileSync(new URL('./fixtures/tricount-sample.csv', import.meta.url), 'utf8')).rows;
const many = Array.from({ length: 30 }, (_, k) => rows.map(r => ({ ...r, key: r.key + ':' + k }))).flat(); // 1260 entries
let { token: admin, me } = await newFlat('Asha');
const big = (await call(admin, 'POST', '/api/import', { people: { Asha: me.me.id, Ben: 'new', Chen: 'new' }, rows: many })).d;
ok(big.added === many.length, `bulk import of ${many.length} entries in one request (free-plan query limit safe)`);
await call(admin, 'POST', '/api/recurring', { description: 'Cook', amount: '8500', day: 5, paidBy: me.me.id, split: [] });
await call(admin, 'POST', '/api/guests', { name: 'Neha', until: Date.now() + 864e5 });
me = (await call(admin, 'GET', '/api/me')).d;
const before = JSON.stringify(balances(me));
ok(me.backup.sheet === true && me.backup.last === null, 'admin sees the Google Sheet backup as connected');

const t0 = Date.now(), now = await call(admin, 'POST', '/api/backup/now', {});
ok(now.d.ok && Date.now() - t0 < 1500, `"Back up now" answers in ${Date.now() - t0} ms; the copy runs in the background`);
await wait(1500);
ok((await call(admin, 'GET', '/api/me')).d.backup.last > 0, 'last backup time is recorded');

const snap = (await call(admin, 'GET', '/api/backup')).d;
ok(snap.app === 'its-settled' && snap.expenses.length === many.length && snap.recurring.length === 1 && snap.members.some(m => m.role === 'guest'), 'downloaded backup has entries, bills and guests');

for (const e of me.expenses.slice(0, 5)) await call(admin, 'DELETE', '/api/expenses/' + e.id);
await call(admin, 'POST', '/api/expenses', { amount: '99999', description: 'oops', split: [me.me.id], paidBy: me.members[1].id });
const r1 = (await call(admin, 'POST', '/api/restore', { snapshot: snap })).d;
me = (await call(admin, 'GET', '/api/me')).d;
ok(r1.expenses === many.length && JSON.stringify(balances(me)) === before && !me.expenses.some(e => e.description === 'oops'), 'restore from file brings back exact balances');

const { token: admin2 } = await newFlat('Asha');
const r2 = (await call(admin2, 'POST', '/api/restore', { snapshot: snap })).d;
const m2 = (await call(admin2, 'GET', '/api/me')).d;
ok(r2.people_added === 3 && m2.members.find(m => m.name === 'Neha')?.role === 'guest', 'restore into a new flat: Asha matched by name; Ben, Chen and guest Neha come back');
ok((await call(admin2, 'POST', '/api/restore', { snapshot: { hello: 1 } })).s === 400, 'a file that is not a backup is rejected');

await call(admin, 'POST', '/api/expenses', { amount: '1', description: 'after backup', split: [me.me.id] });
const r3 = (await call(admin, 'POST', '/api/restore', { from: 'sheet' })).d;
me = (await call(admin, 'GET', '/api/me')).d;
ok(r3.ok && JSON.stringify(balances(me)) === before, 'restore from the Google Sheet copy works');

const p0 = (await (await fetch('http://localhost:9999/stats')).json()).posts;
await fetch(B + '/__scheduled?cron=30+2+*+*+*'); await wait(2000);
ok((await (await fetch('http://localhost:9999/stats')).json()).posts - p0 >= 2, 'the nightly run backs up every flat');
const t1 = Date.now(); await call(admin, 'GET', '/api/me');
ok(Date.now() - t1 < 800, `still fast with ${many.length}+ entries: ${Date.now() - t1} ms`);
