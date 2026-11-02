// Guest mode: added by a flatmate, magic link, sees only their entries, settles directly, expiry.
import { B, call, ok, newFlat } from './lib.mjs';

const { token: admin, me } = await newFlat('Asha');
const ben = (await call(null, 'POST', '/api/join', { code: me.flat.invite_code, name: 'Ben' })).d.token;
await call(admin, 'POST', `/api/members/${(await call(admin, 'GET', '/api/me')).d.members.find(m => m.status === 'pending').id}/approve`, {});
const benMe = (await call(ben, 'GET', '/api/me')).d.me;
const A = me.me.id, Bn = benMe.id;

// Ben (not admin) hosts a guest for a week.
const g = (await call(ben, 'POST', '/api/guests', { name: 'Neha', until: Date.now() + 7 * 864e5 })).d;
ok(g.token && g.id, 'any flatmate can add a guest and gets a login token');
const guest = g.token;
let gv = (await call(guest, 'GET', '/api/me')).d;
ok(gv.me.role === 'guest' && gv.me.status === 'approved' && gv.flat.host === 'Ben' && !gv.flat.invite_code, 'guest is in instantly, sees host name, no invite code');

await call(admin, 'POST', '/api/expenses', { amount: '900', description: 'Flat groceries', paidBy: A, split: [A, Bn] });            // not involving guest
await call(ben, 'POST', '/api/expenses', { amount: '1200', description: 'Dinner', paidBy: Bn, split: [Bn, g.id, A] });               // involves guest
await call(guest, 'POST', '/api/expenses', { amount: '300', description: 'Cab', paidBy: g.id, split: [g.id, Bn] });                 // guest adds
gv = (await call(guest, 'GET', '/api/me')).d;
ok(gv.expenses.length === 2 && gv.expenses.every(e => e.description !== 'Flat groceries'), 'guest sees only entries they are part of');
ok(gv.recurring.length === 0 && !gv.members.some(m => m.status === 'pending'), 'guest sees no monthly bills and no join requests');
ok((await call(guest, 'POST', '/api/expenses', { amount: '50', paidBy: A, split: [A, Bn] })).s === 400, "guest can't add entries they are not part of");
ok((await call(guest, 'POST', '/api/recurring', { description: 'x', amount: 1, day: 1 })).s === 403, "guest can't add monthly bills");
ok((await call(guest, 'POST', '/api/guests', { name: 'Plus one' })).s === 403, "guest can't add guests");

// "Everyone" excludes guests: monthly bills and flatmate defaults.
await call(admin, 'POST', '/api/recurring', { description: 'Maid', amount: '3000', day: 1, paidBy: A, split: [], addNow: true });
const maid = (await call(admin, 'GET', '/api/me')).d.expenses.find(e => e.description.startsWith('Maid'));
ok(JSON.parse(maid.split).length === 2 && !JSON.parse(maid.split).some(([id]) => id === g.id), 'monthly bills split between flatmates only, never guests');

// Access control on changing a guest: host or admin only.
const cara = (await call(null, 'POST', '/api/join', { code: me.flat.invite_code, name: 'Cara' })).d.token;
await call(admin, 'POST', `/api/members/${(await call(admin, 'GET', '/api/me')).d.members.find(m => m.status === 'pending').id}/approve`, {});
ok((await call(cara, 'POST', `/api/guests/${g.id}`, { until: 'now' })).s === 403, "another flatmate can't end someone else's guest");
ok((await call(cara, 'POST', `/api/members/${g.id}/relogin`)).s === 403, "another flatmate can't re-issue the guest's link");
const re = (await call(ben, 'POST', `/api/members/${g.id}/relogin`)).d.token;
ok(re && (await call(guest, 'GET', '/api/me')).s === 401, 'host can re-send a fresh guest link (old one stops working)');

// Expiry: read-only, balance still visible.
ok((await call(ben, 'POST', `/api/guests/${g.id}`, { until: 'now' })).d.ok, 'host ends access');
const ended = (await call(re, 'GET', '/api/me')).d;
ok(ended.me.expired === true && ended.expenses.length === 2, 'ended guest can still open and see what is left to settle');
ok((await call(re, 'POST', '/api/expenses', { amount: '10', paidBy: g.id, split: [g.id, Bn] })).s === 403, 'ended guest cannot add entries');
ok((await call(admin, 'POST', `/api/guests/${g.id}`, { until: Date.now() + 864e5 })).d.ok && (await call(re, 'GET', '/api/me')).d.me.expired === false, 'admin can give access again');

// Telegram: guests never get flat-wide pings (checked via query shape in worker), and the page still loads.
ok((await fetch(B + '/')).status === 200, 'app page still serves');
