// Simulated Telegram webhook updates. Needs TELEGRAM_WEBHOOK_SECRET=testsecret in .dev.vars
// (no bot token needed: outgoing messages are skipped when TELEGRAM_BOT_TOKEN is unset).
import { call, ok, newFlat } from './lib.mjs';
const hook = b => call(null, 'POST', '/api/telegram/testsecret', b);
const msg = (id, text, type = 'private') => hook({ message: { chat: { id, type }, from: { id }, text } });
const exp = async t => (await call(t, 'GET', '/api/me')).d.expenses;

ok((await call(null, 'POST', '/api/telegram/wrong', {})).s === 403, 'webhook rejects a wrong secret');
const { token: admin, me } = await newFlat('Asha');
await msg(111, '/start ' + me.me.tg_code);
ok((await call(admin, 'GET', '/api/me')).d.me.tg, 'admin links Telegram with the /start link');

const ben = (await call(null, 'POST', '/api/join', { code: me.flat.invite_code, name: 'Ben' })).d.token;
const pid = (await call(admin, 'GET', '/api/me')).d.members.find(m => m.status === 'pending').id;
await hook({ callback_query: { id: 'q1', from: { id: 999 }, data: 'ap:' + pid, message: { chat: { id: 999 }, message_id: 1, text: 'x' } } });
ok((await call(ben, 'GET', '/api/me')).d.me.status === 'pending', 'a stranger cannot approve with the button');
await hook({ callback_query: { id: 'q2', from: { id: 111 }, data: 'ap:' + pid, message: { chat: { id: 111 }, message_id: 1, text: 'x' } } });
ok((await call(ben, 'GET', '/api/me')).d.me.status === 'approved', 'the admin Approve button works');

await msg(111, '450 milk');
await msg(111, '₹1,200.50 groceries blinkit');
let ex = await exp(admin);
ok(ex.length === 2 && ex.some(e => e.amount === 45000 && e.description === 'milk') && ex.some(e => e.amount === 120050), 'plain text "450 milk" and "₹1,200.50 groceries" are added');
await msg(111, '/undo');
ok((await exp(admin)).length === 1, '/undo removes the last entry');

// A guest on Telegram: their quick entries split with their host only; flat entries stay flatmates-only.
const g = (await call(admin, 'POST', '/api/guests', { name: 'Neha', until: Date.now() + 864e5 })).d;
const gm = (await call(g.token, 'GET', '/api/me')).d.me;
await msg(333, '/start ' + gm.tg_code);
await msg(333, '600 pizza');
const pizza = (await exp(admin)).find(e => e.description === 'pizza');
ok(pizza && JSON.parse(pizza.split).map(([id]) => id).sort().join() === [g.id, me.me.id].sort().join(), "a guest's '600 pizza' splits with their host only");
await msg(111, '90 bread');
const bread = (await exp(admin)).find(e => e.description === 'bread');
ok(JSON.parse(bread.split).length === 2 && !JSON.parse(bread.split).some(([id]) => id === g.id), "a flatmate's quick entry never includes guests");

await msg(222, '500 beer');
await msg(-5, '500 beer', 'group');
ok(!(await exp(admin)).some(e => e.description === 'beer'), 'unlinked chats and group chats are ignored');
