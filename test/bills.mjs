// Monthly bills: "always X" vs "whoever pays" (claim) mode, reminders, undo by deleting the entry.
// Needs TELEGRAM_WEBHOOK_SECRET=testsecret in .dev.vars. Uses `wrangler d1 execute --local` to age a reminder.
import { execSync } from 'child_process';
import { B, call, ok, newFlat } from './lib.mjs';

const sql = q => JSON.parse(execSync(`npx wrangler d1 execute its-settled --local --json --command ${JSON.stringify(q)}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString())[0].results;
const hook = b => call(null, 'POST', '/api/telegram/testsecret', b);
const me$ = t => call(t, 'GET', '/api/me').then(r => r.d);

const { token: asha, me } = await newFlat('Asha');
const join = async name => {
  const t = (await call(null, 'POST', '/api/join', { code: me.flat.invite_code, name })).d.token;
  await call(asha, 'POST', `/api/members/${(await me$(asha)).members.find(m => m.status === 'pending').id}/approve`, {});
  return t;
};
const ben = await join('Ben'), chen = await join('Chen');
const A = me.me.id, Bn = (await me$(ben)).me.id, Cn = (await me$(chen)).me.id;

// Rent: always Asha → added automatically, no question asked.
await call(asha, 'POST', '/api/recurring', { description: 'Rent', amount: '30000', day: 1, paidBy: A, split: [], addNow: true });
let s = await me$(asha);
ok(s.expenses.some(e => e.description.startsWith('Rent') && e.paid_by === A) && s.dues.length === 0, 'fixed bill: added automatically with the regular payer');

// Maid: whoever pays → a "who paid?" card, no entry yet.
await call(ben, 'POST', '/api/recurring', { description: 'Maid', amount: '4500', day: 1, mode: 'claim', split: [], addNow: true });
s = await me$(asha);
ok(s.recurring.find(r => r.description === 'Maid').mode === 'claim', 'bill saved as "whoever pays"');
ok(s.dues.length === 1 && s.dues[0].amount === 450000 && !s.expenses.some(e => e.description.startsWith('Maid')), 'claim bill: shows a due card and adds nothing yet');
const due = s.dues[0];
ok((await me$(chen)).dues.length === 1, 'every flatmate sees the card');
const g = (await call(asha, 'POST', '/api/guests', { name: 'Neha', until: Date.now() + 864e5 })).d;
ok(!(await me$(g.token)).dues && (await call(g.token, 'POST', `/api/dues/${due.id}/claim`, {})).s === 403, 'guests never see or claim monthly bills');

// Two people tap "I paid" at the same moment → exactly one wins.
const [r1, r2] = await Promise.all([
  call(ben, 'POST', `/api/dues/${due.id}/claim`, { amount: '4200' }),
  call(chen, 'POST', `/api/dues/${due.id}/claim`, {}),
]);
const winner = r1.s === 200 ? 'Ben' : 'Chen', loser = r1.s === 200 ? r2 : r1;
ok([r1.s, r2.s].sort().join() === '200,409' && /already marked it paid/.test(loser.d.error), `simultaneous claims: one wins (${winner}), the other is told "${loser.d.error}"`);
s = await me$(asha);
const maid = s.expenses.filter(e => e.description.startsWith('Maid'));
ok(maid.length === 1 && s.dues.length === 0, 'exactly one entry is created and the card disappears');
ok(maid[0].paid_by === (winner === 'Ben' ? Bn : Cn) && JSON.parse(maid[0].split).length === 3 && JSON.parse(maid[0].split).reduce((a, [, x]) => a + x, 0) === maid[0].amount,
  'entry: paid by the claimer, split between all 3 flatmates, exact paise');

// Wrong claim → delete the entry → card comes back → claim again with a new amount and payer.
const claimer = winner === 'Ben' ? ben : chen;
ok((await call(claimer, 'DELETE', '/api/expenses/' + maid[0].id)).s === 200, 'the claimer can delete the entry');
s = await me$(asha);
ok(s.dues.length === 1 && s.dues[0].id === due.id, 'deleting the entry brings the "who paid?" card back');
ok((await call(asha, 'POST', `/api/dues/${due.id}/claim`, { amount: '3900', paidBy: Cn })).s === 200, 'can claim on behalf of someone else, with a different amount');
s = await me$(asha);
const m2 = s.expenses.find(e => e.description.startsWith('Maid'));
ok(m2.paid_by === Cn && m2.amount === 390000, 'the new entry has the corrected payer and amount');

// Next month's card starts at the last paid amount; skip works; daily run doesn't duplicate.
await fetch(B + '/__scheduled?cron=30+2+*+*+*');
ok((await me$(asha)).dues.length === 0, 'the daily run does not reopen a bill already paid this month');
await call(asha, 'POST', '/api/recurring', { description: 'Cook', amount: '8500', day: 1, mode: 'claim', split: [], addNow: true });
const cook = (await me$(asha)).dues[0];
ok((await call(ben, 'POST', `/api/dues/${cook.id}/skip`, {})).s === 200 && (await me$(asha)).dues.length === 0, 'skip this month hides the card without adding anything');
ok((await call(chen, 'POST', `/api/dues/${cook.id}/claim`, {})).s === 409, 'a skipped bill cannot be claimed');

// Reminders every 2 days: age the reminder, run the daily job, check it was re-sent (timestamp moves).
await call(asha, 'POST', '/api/recurring', { description: 'Gas', amount: '1100', day: 1, mode: 'claim', split: [], addNow: true });
const gas = (await me$(asha)).dues[0];
const sentAt = sql(`SELECT last_nudge FROM bill_dues WHERE id='${gas.id}'`)[0].last_nudge;
await fetch(B + '/__scheduled?cron=30+2+*+*+*');
ok(sql(`SELECT last_nudge FROM bill_dues WHERE id='${gas.id}'`)[0].last_nudge === sentAt, 'no reminder before 2 days have passed');
sql(`UPDATE bill_dues SET last_nudge=${Date.now() - 47 * 3600e3} WHERE id='${gas.id}'`);
await fetch(B + '/__scheduled?cron=30+2+*+*+*');
ok(sql(`SELECT last_nudge FROM bill_dues WHERE id='${gas.id}'`)[0].last_nudge > Date.now() - 60e3, 'after 2 days unclaimed, the reminder is sent again');

// Telegram "I paid" button.
await hook({ message: { chat: { id: 501, type: 'private' }, from: { id: 501 }, text: '/start ' + (await me$(ben)).me.tg_code } });
await hook({ message: { chat: { id: 777, type: 'private' }, from: { id: 777 }, text: '/start ' + (await me$(g.token)).me.tg_code } });
await hook({ callback_query: { id: 'x1', from: { id: 777 }, data: 'pd:' + gas.id, message: { chat: { id: 777 }, message_id: 1, text: 'x' } } });
ok((await me$(asha)).dues.length === 1, "a guest's tap on the Telegram button is ignored");
await hook({ callback_query: { id: 'x2', from: { id: 501 }, data: 'pd:' + gas.id, message: { chat: { id: 501 }, message_id: 1, text: 'x' } } });
s = await me$(asha);
ok(s.dues.length === 0 && s.expenses.find(e => e.description.startsWith('Gas'))?.paid_by === Bn, 'Telegram "I paid" button claims the bill for that flatmate');

// Stopping a bill clears its open card; backups keep the mode.
await call(asha, 'POST', '/api/recurring', { description: 'Water', amount: '300', day: 1, mode: 'claim', split: [], addNow: true });
const water = (await me$(asha)).recurring.find(r => r.description === 'Water');
await call(asha, 'DELETE', '/api/recurring/' + water.id);
ok((await me$(asha)).dues.length === 0, 'stopping a bill removes its open card');
const snap = (await call(asha, 'GET', '/api/backup')).d;
ok(snap.recurring.find(r => r.description === 'Maid').mode === 'claim', 'backups keep each bill\'s "who pays" setting');
ok((await call(asha, 'POST', '/api/restore', { snapshot: { ...snap, app: 'other-app' } })).s === 400, 'restore rejects a file from another app');
