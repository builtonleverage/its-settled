// It's Settled — ad-free expense splitting for flatmates.
// One Cloudflare Worker serves the web app, a JSON API, a Telegram bot webhook, and a daily cron
// that adds monthly bills and pushes backups. Read CLAUDE.md before changing anything.
import APP from './app.html';
import * as core from './core.js';

const { toPaise, equalShares, involves, settlePlan } = core;

// ---------- config (wrangler.toml [vars]) ----------
const cfg = env => ({
  name: env.APP_NAME || "It's Settled",
  currency: env.CURRENCY || 'INR',
  locale: env.LOCALE || 'en-IN',
  timezone: env.TIMEZONE || 'Asia/Kolkata',
  bot: env.BOT_USERNAME || null,
});

// The page = app.html + shared core functions + public config, built once per isolate.
let PAGE = null;
const page = env => PAGE ??= APP
  // The bundler (esbuild keepNames) may insert __name(...) calls into these functions; give the page a no-op shim.
  .replace('/*__CORE__*/', () => 'var __name = (f) => f;\n' + Object.values(core).map(f => f.toString()).join('\n'))
  .replace('/*__CONFIG__*/', () => `const CONFIG = ${JSON.stringify(cfg(env))};`)
  .replaceAll('__APP_NAME__', cfg(env).name.replace(/[<>&"]/g, ''));

// ---------- helpers ----------
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
const err = (m, s = 400) => J({ error: m }, s);
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = (n = 6) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => ABC[b % 32]).join('');
const clean = (s, max = 60) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const now = () => Date.now();
const money = (env, p) => new Intl.NumberFormat(cfg(env).locale, { style: 'currency', currency: cfg(env).currency, maximumFractionDigits: 2, minimumFractionDigits: p % 100 ? 2 : 0 }).format(p / 100);

// Member helpers. role: admin | member | guest. status: pending | approved | placeholder | rejected.
const isGuest = m => m?.role === 'guest';
const counted = ms => ms.filter(m => m.status === 'approved' || m.status === 'placeholder'); // people with balances
const residentIds = ms => counted(ms).filter(m => !isGuest(m)).map(m => m.id);                // "everyone" for splits
const expired = m => isGuest(m) && m.expires_at && m.expires_at <= now();

// ---------- schema & migrations ----------
// Append new arrays to MIGRATIONS to change the schema; never edit a shipped one (see CLAUDE.md).
const MIGRATIONS = [
  [ // v1
    `CREATE TABLE IF NOT EXISTS flats (id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT UNIQUE NOT NULL,
       simplify INTEGER NOT NULL DEFAULT 1, last_backup INTEGER, created_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, flat_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member',
       status TEXT NOT NULL DEFAULT 'pending', token_hash TEXT UNIQUE, tg_code TEXT UNIQUE, tg_chat_id TEXT,
       host_id TEXT, expires_at INTEGER, created_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_members_flat ON members(flat_id)`,
    `CREATE INDEX IF NOT EXISTS idx_members_tg ON members(tg_chat_id)`,
    `CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, flat_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'expense', description TEXT NOT NULL,
       amount INTEGER NOT NULL, paid_by TEXT NOT NULL, split TEXT NOT NULL, created_by TEXT, source TEXT NOT NULL DEFAULT 'web', ext_id TEXT,
       created_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)`,
    `CREATE INDEX IF NOT EXISTS idx_exp_flat ON expenses(flat_id, deleted, created_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_exp_ext ON expenses(flat_id, ext_id)`,
    `CREATE TABLE IF NOT EXISTS recurring (id TEXT PRIMARY KEY, flat_id TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL,
       paid_by TEXT NOT NULL, split TEXT, day INTEGER NOT NULL, last_run TEXT, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)`,
  ],
];
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)`).run();
  let v = (await db.prepare(`SELECT v FROM meta WHERE k='schema'`).first())?.v || 0;
  for (; v < MIGRATIONS.length; v++) {
    await db.batch([...MIGRATIONS[v].map(s => db.prepare(s)),
      db.prepare(`INSERT INTO meta (k, v) VALUES ('schema', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(v + 1)]);
  }
  schemaReady = true;
}

// ---------- data access ----------
const flatMembers = (db, flatId) => db.prepare(
  `SELECT id, name, role, status, host_id, expires_at, created_at, tg_chat_id IS NOT NULL AS tg FROM members
   WHERE flat_id=? AND status IN ('approved','placeholder','pending') ORDER BY created_at`).bind(flatId).all().then(r => r.results);
const flatExpenses = (db, flatId) => db.prepare(
  `SELECT id, kind, description, amount, paid_by, split, created_by, source, created_at FROM expenses
   WHERE flat_id=? AND deleted=0 ORDER BY created_at DESC`).bind(flatId).all().then(r => r.results);

async function auth(req, env) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (t.length < 20) return null;
  return env.DB.prepare(
    `SELECT m.*, f.name AS flat_name, f.invite_code, f.last_backup, f.simplify FROM members m JOIN flats f ON f.id=m.flat_id WHERE m.token_hash=?`)
    .bind(await sha(t)).first();
}

const insertExpense = (db, e) => db.prepare(
  `INSERT OR IGNORE INTO expenses (id, flat_id, kind, description, amount, paid_by, split, created_by, source, ext_id, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
  .bind(randHex(8), e.flat_id, e.kind || 'expense', e.description, e.amount, e.paid_by, JSON.stringify(e.split),
    e.created_by ?? null, e.source || 'web', e.ext_id ?? null, e.created_at ?? now());

// Bulk writes go through json_each so an import/restore of any size is ONE query
// (Workers free plan: 50 queries per request; D1: 100 bound params per query).
const bulkExpenses = (db, rows) => db.prepare(
  `INSERT OR IGNORE INTO expenses (id, flat_id, kind, description, amount, paid_by, split, created_by, source, ext_id, created_at)
   SELECT json_extract(value,'$.id'), json_extract(value,'$.flat_id'), json_extract(value,'$.kind'), json_extract(value,'$.description'),
          json_extract(value,'$.amount'), json_extract(value,'$.paid_by'), json_extract(value,'$.split'), json_extract(value,'$.created_by'),
          json_extract(value,'$.source'), json_extract(value,'$.ext_id'), json_extract(value,'$.created_at') FROM json_each(?)`)
  .bind(JSON.stringify(rows.map(e => ({ ...e, id: randHex(8), split: JSON.stringify(e.split), created_by: e.created_by ?? null, ext_id: e.ext_id ?? null }))));
const bulkPlaceholders = (db, flatId, people) => db.prepare(
  `INSERT INTO members (id, flat_id, name, role, status, created_at)
   SELECT json_extract(value,'$.id'), ?, json_extract(value,'$.name'), json_extract(value,'$.role'), 'placeholder', ? FROM json_each(?)`)
  .bind(flatId, now(), JSON.stringify(people.map(p => ({ role: 'member', ...p }))));

// ---------- Telegram ----------
async function tg(env, method, payload) {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    return await r.json();
  } catch (e) { console.error('telegram', e); return null; }
}
const send = (env, chat, text, markup) =>
  tg(env, 'sendMessage', { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });
async function notifyAdmins(env, flatId, text, markup) {
  const { results } = await env.DB.prepare(
    `SELECT tg_chat_id FROM members WHERE flat_id=? AND role='admin' AND status='approved' AND tg_chat_id IS NOT NULL`).bind(flatId).all();
  await Promise.all(results.map(r => send(env, r.tg_chat_id, text, markup)));
}
// Flat-wide pings go to flatmates only; guests never get them.
async function notifyFlat(env, flatId, text, exceptId = '') {
  const { results } = await env.DB.prepare(
    `SELECT tg_chat_id FROM members WHERE flat_id=? AND status='approved' AND role<>'guest' AND tg_chat_id IS NOT NULL AND id<>?`).bind(flatId, exceptId).all();
  await Promise.all(results.map(r => send(env, r.tg_chat_id, text)));
}
const HELP = `Type an amount and what it was for:
<code>450 milk</code>  → split equally
<code>/bal</code>  → who owes whom
<code>/undo</code>  → remove the last thing you added
Monthly bills, uneven splits and guests live in the web app.`;

async function balanceText(env, me) {
  const [ms, ex] = await Promise.all([flatMembers(env.DB, me.flat_id), flatExpenses(env.DB, me.flat_id)]);
  const name = Object.fromEntries(ms.map(m => [m.id, m.name]));
  const plan = settlePlan(counted(ms), ex, !!me.simplify).filter(s => !isGuest(me) || s.from === me.id || s.to === me.id);
  if (!plan.length) return '✅ All settled.';
  return '<b>To settle up</b>\n' + plan.map(s => `${esc(name[s.from] || '?')} → ${esc(name[s.to] || '?')}: <b>${money(env, s.amount)}</b>`).join('\n');
}

// ---------- API ----------
async function api(req, env, ctx, url) {
  const p = url.pathname, M = req.method, db = env.DB;
  await ensureSchema(db);
  const body = M === 'POST' ? await req.json().catch(() => ({})) : {};

  if (p.startsWith('/api/telegram/')) return telegram(env, ctx, p.split('/')[3], body);

  // One-time helper: registers the bot webhook against this deployment.
  if (p === '/api/setup-telegram') {
    if (!env.TELEGRAM_WEBHOOK_SECRET || url.searchParams.get('key') !== env.TELEGRAM_WEBHOOK_SECRET) return err('Bad key', 403);
    const r = await tg(env, 'setWebhook', { url: `${url.origin}/api/telegram/${env.TELEGRAM_WEBHOOK_SECRET}`, allowed_updates: ['message', 'callback_query'] });
    return J(r || { error: 'TELEGRAM_BOT_TOKEN is not set' });
  }

  if (p === '/api/flats' && M === 'POST') {
    const flat = clean(body.flat, 40), name = clean(body.name, 30);
    if (!flat || !name) return err('Enter the flat name and your name');
    const fid = randHex(8), token = randHex(24);
    await db.batch([
      db.prepare(`INSERT INTO flats (id, name, invite_code, created_at) VALUES (?,?,?,?)`).bind(fid, flat, genCode(), now()),
      db.prepare(`INSERT INTO members (id, flat_id, name, role, status, token_hash, tg_code, created_at) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(randHex(8), fid, name, 'admin', 'approved', await sha(token), genCode(10), now()),
    ]);
    return J({ token });
  }

  if (p === '/api/join' && M === 'POST') {
    const code = clean(body.code, 12).toUpperCase(), name = clean(body.name, 30);
    if (!code || !name) return err('Enter the invite code and your name');
    const flat = await db.prepare(`SELECT * FROM flats WHERE invite_code=?`).bind(code).first();
    if (!flat) return err("That invite code doesn't match any flat. Check it with whoever sent it.", 404);
    const pending = await db.prepare(`SELECT COUNT(*) n FROM members WHERE flat_id=? AND status='pending'`).bind(flat.id).first();
    if (pending.n >= 10) return err('This flat has too many pending requests. Ask the admin to clear them.', 429);
    const mid = randHex(8), token = randHex(24);
    await db.prepare(`INSERT INTO members (id, flat_id, name, role, status, token_hash, tg_code, created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(mid, flat.id, name, 'member', 'pending', await sha(token), genCode(10), now()).run();
    ctx.waitUntil(notifyAdmins(env, flat.id, `🙋 <b>${esc(name)}</b> wants to join <b>${esc(flat.name)}</b>`,
      { inline_keyboard: [[{ text: '✅ Approve', callback_data: 'ap:' + mid }, { text: '❌ Reject', callback_data: 'rj:' + mid }]] }));
    return J({ token });
  }

  const me = await auth(req, env);
  if (!me) return err('Not signed in', 401);
  const isAdmin = me.role === 'admin' && me.status === 'approved';
  const pub = { id: me.id, name: me.name, role: me.role, status: me.status, tg: !!me.tg_chat_id, tg_code: me.tg_code,
    host_id: me.host_id, expires_at: me.expires_at, expired: !!expired(me) };

  if (p === '/api/me' && M === 'GET') {
    if (me.status !== 'approved') {
      const admin = await db.prepare(`SELECT name FROM members WHERE flat_id=? AND role='admin' AND status='approved' LIMIT 1`).bind(me.flat_id).first();
      return J({ me: pub, flat: { name: me.flat_name, admin: admin?.name } });
    }
    const [members, expenses] = await Promise.all([flatMembers(db, me.flat_id), flatExpenses(db, me.flat_id)]);
    if (isGuest(me)) { // guests see only entries they're part of, and no other guests
      const host = members.find(m => m.id === me.host_id);
      return J({ me: pub, flat: { name: me.flat_name, simplify: 0, host: host?.name || null },
        members: members.filter(m => m.status !== 'pending' && (!isGuest(m) || m.id === me.id)).map(({ tg, ...m }) => m),
        expenses: expenses.filter(e => involves(e, me.id)), recurring: [], bot: cfg(env).bot });
    }
    const rec = (await db.prepare(`SELECT * FROM recurring WHERE flat_id=? AND active=1 ORDER BY day`).bind(me.flat_id).all()).results;
    return J({ me: pub, flat: { name: me.flat_name, invite_code: me.invite_code, simplify: me.simplify }, members, expenses, recurring: rec,
      bot: cfg(env).bot, backup: isAdmin ? { sheet: !!env.BACKUP_URL, last: me.last_backup } : null });
  }

  if (p === '/api/leave' && M === 'POST' && me.status === 'pending') {
    await db.prepare(`DELETE FROM members WHERE id=? AND status='pending'`).bind(me.id).run();
    return J({ ok: true });
  }

  if (me.status !== 'approved') return err('Waiting for the admin to approve you', 403);
  if (expired(me)) return err('Your guest access has ended. Ask whoever added you to extend it.', 403);
  const members = await flatMembers(db, me.flat_id);
  const valid = new Set(counted(members).map(m => m.id));
  const nameOf = id => members.find(m => m.id === id)?.name || 'Someone';
  const residentsOnly = () => isGuest(me) ? err('Guests can only add and settle their own entries', 403) : null;
  let m;

  // Add an expense or a settle-up payment.
  if (p === '/api/expenses' && M === 'POST') {
    const amount = toPaise(body.amount);
    if (!amount) return err('Enter an amount');
    const allowed = isGuest(me) ? new Set([...residentIds(members), me.id]) : valid;
    const paidBy = allowed.has(body.paidBy) ? body.paidBy : me.id;
    let split;
    if (Array.isArray(body.shares) && body.shares.length) { // exact amounts per person
      split = body.shares.map(([id, v]) => [id, toPaise(v)]).filter(([id, v]) => allowed.has(id) && v > 0);
      if (split.reduce((a, [, v]) => a + v, 0) !== amount) return err("The split amounts don't add up to the total");
    } else {
      const ids = [...new Set(Array.isArray(body.split) ? body.split : [])].filter(id => allowed.has(id));
      if (!ids.length) return err('Pick at least one person to split with');
      split = equalShares(amount, ids);
    }
    if (isGuest(me) && paidBy !== me.id && !split.some(([id]) => id === me.id)) return err('As a guest, you can only add entries you are part of');
    const kind = body.kind === 'settle' ? 'settle' : 'expense';
    if (kind === 'settle' && (split.length !== 1 || split[0][0] === paidBy)) return err('A payment goes from one person to another');
    const description = clean(body.description, 80) || (kind === 'settle' ? 'Settle up' : 'Expense');
    const cid = clean(body.cid, 40); // client id: an offline entry retried twice is stored once
    const at = Number(body.at), created_at = at > now() - 30 * 864e5 && at <= now() + 6e4 ? at : now();
    const r = await insertExpense(db, { flat_id: me.flat_id, kind, description, amount, paid_by: paidBy, split, created_by: me.id,
      ext_id: cid ? 'c:' + cid : null, created_at }).run();
    if (!r.meta.changes) return J({ ok: true, duplicate: true });
    ctx.waitUntil(notifyFlat(env, me.flat_id, kind === 'settle'
      ? `🤝 ${esc(nameOf(paidBy))} paid ${esc(nameOf(split[0][0]))} <b>${money(env, amount)}</b>`
      : `🧾 ${esc(me.name)} added <b>${money(env, amount)}</b> · ${esc(description)} (paid by ${esc(nameOf(paidBy))})`, me.id));
    return J({ ok: true });
  }

  if ((m = p.match(/^\/api\/expenses\/(\w+)$/)) && M === 'DELETE') {
    const r = await db.prepare(`UPDATE expenses SET deleted=1 WHERE id=? AND flat_id=? AND (created_by=? OR ?=1)`)
      .bind(m[1], me.flat_id, me.id, isAdmin ? 1 : 0).run();
    return r.meta.changes ? J({ ok: true }) : err('Only the person who added this, or the admin, can delete it', 403);
  }

  // Monthly bills (flatmates only)
  if (p === '/api/recurring' && M === 'POST') {
    const no = residentsOnly(); if (no) return no;
    const amount = toPaise(body.amount), description = clean(body.description, 60), day = Math.round(Number(body.day));
    if (!amount || !description || !(day >= 1 && day <= 31)) return err('Enter a name, an amount and a day between 1 and 31');
    const res = residentIds(members);
    const paidBy = res.includes(body.paidBy) ? body.paidBy : me.id;
    const ids = Array.isArray(body.split) ? body.split.filter(id => res.includes(id)) : [];
    const split = ids.length && ids.length < res.length ? JSON.stringify(ids) : null; // null = every flatmate, incl. future ones
    await db.prepare(`INSERT INTO recurring (id, flat_id, description, amount, paid_by, split, day, last_run, created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(randHex(8), me.flat_id, description, amount, paidBy, split, day, body.addNow ? null : localMonth(env).ym, now()).run();
    if (body.addNow) await runRecurring(env, me.flat_id);
    return J({ ok: true });
  }
  if ((m = p.match(/^\/api\/recurring\/(\w+)$/)) && M === 'DELETE') {
    const no = residentsOnly(); if (no) return no;
    await db.prepare(`UPDATE recurring SET active=0 WHERE id=? AND flat_id=?`).bind(m[1], me.flat_id).run();
    return J({ ok: true });
  }

  // Guests: any flatmate can add one; the host or the admin can extend, end, or re-issue their link.
  if (p === '/api/guests' && M === 'POST') {
    const no = residentsOnly(); if (no) return no;
    const name = clean(body.name, 30);
    if (!name) return err("Enter the guest's name");
    const id = randHex(8), token = randHex(24);
    await db.prepare(`INSERT INTO members (id, flat_id, name, role, status, token_hash, tg_code, host_id, expires_at, created_at)
                      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, me.flat_id, name, 'guest', 'approved', await sha(token), genCode(10), me.id, until(body.until), now()).run();
    return J({ id, token });
  }
  if ((m = p.match(/^\/api\/guests\/(\w+)$/)) && M === 'POST') {
    const g = members.find(x => x.id === m[1] && isGuest(x));
    if (!g) return err('Guest not found', 404);
    if (!isAdmin && g.host_id !== me.id) return err('Only whoever added this guest, or the admin, can change it', 403);
    await db.prepare(`UPDATE members SET expires_at=? WHERE id=?`).bind(body.until === 'now' ? now() : until(body.until), g.id).run();
    return J({ ok: true });
  }

  // Admin (and guest hosts for re-issuing a guest's link)
  if ((m = p.match(/^\/api\/members\/(\w+)\/(approve|reject|relogin)$/)) && M === 'POST') {
    const target = members.find(x => x.id === m[1]);
    if (!target) return err('Member not found', 404);
    if (!isAdmin && !(m[2] === 'relogin' && isGuest(target) && target.host_id === me.id)) return err('Only the admin can do that', 403);
    if (m[2] === 'relogin') {
      if (target.status === 'pending') return err('Approve them first');
      const token = randHex(24);
      await db.prepare(`UPDATE members SET token_hash=?, status='approved' WHERE id=?`).bind(await sha(token), target.id).run();
      return J({ token });
    }
    if (target.status !== 'pending') return err(`Already ${target.status}`);
    if (m[2] === 'reject') {
      await db.prepare(`UPDATE members SET status='rejected' WHERE id=?`).bind(target.id).run();
      return J({ ok: true });
    }
    return J(await approve(db, target.id, me.flat_id, body.as));
  }

  if (p === '/api/flat' && M === 'POST') {
    if (!isAdmin) return err('Only the admin can change flat settings', 403);
    if (typeof body.simplify === 'boolean') await db.prepare(`UPDATE flats SET simplify=? WHERE id=?`).bind(body.simplify ? 1 : 0, me.flat_id).run();
    return J({ ok: true });
  }

  // Import from another app. The browser parses the file (core.parseTricount) and sends rows.
  if (p === '/api/import' && M === 'POST') {
    if (!isAdmin) return err('Only the admin can import', 403);
    const people = body.people || {}, rows = Array.isArray(body.rows) ? body.rows.slice(0, 20000) : [];
    if (!rows.length) return err('Nothing to import');
    const map = {}, newPeople = [];
    for (const [name, target] of Object.entries(people)) {
      if (valid.has(target)) map[name] = target;
      else if (target === 'new') { map[name] = randHex(8); newPeople.push({ id: map[name], name: clean(name, 30) }); }
    }
    let bad = 0;
    const out = [];
    for (const r of rows) {
      const payer = map[r.payer], amount = Math.round(r.amount);
      const split = (r.shares || []).map(([n, v]) => [map[n], Math.round(v)]).filter(([id, v]) => id && v);
      if (!payer || !amount || !split.length || split.reduce((a, [, v]) => a + v, 0) !== amount) { bad++; continue; }
      out.push({ flat_id: me.flat_id, kind: r.kind === 'settle' ? 'settle' : 'expense', description: clean(r.description, 80) || 'Imported',
        amount, paid_by: payer, split, created_by: me.id, source: 'import', ext_id: clean(r.key, 64), created_at: Number(r.date) || now() });
    }
    const res = await db.batch([...(newPeople.length ? [bulkPlaceholders(db, me.flat_id, newPeople)] : []), bulkExpenses(db, out)]);
    const added = res.at(-1).meta.changes;
    return J({ added, duplicates: out.length - added, skipped: bad });
  }

  // Backup & restore (admin)
  if (p.startsWith('/api/backup') || p === '/api/restore') {
    if (!isAdmin) return err('Only the admin can manage backups', 403);
    if (p === '/api/backup' && M === 'GET') return J(await snapshot(db, me.flat_id));
    if (p === '/api/backup/now' && M === 'POST') {
      if (!env.BACKUP_URL) return err('Google Sheet backup is not set up yet');
      ctx.waitUntil(pushBackup(env, me.flat_id)); // runs after the response; the app never waits on Google
      return J({ ok: true });
    }
    if (p === '/api/restore' && M === 'POST') {
      let snap = body.snapshot;
      if (body.from === 'sheet') {
        if (!env.BACKUP_URL) return err('Google Sheet backup is not set up yet');
        snap = await fetch(`${env.BACKUP_URL}?key=${encodeURIComponent(env.BACKUP_SECRET || '')}&flat=${me.flat_id}`).then(r => r.json()).catch(() => null);
        if (!snap || snap.error) return err(snap?.error || "Couldn't reach the Google Sheet backup");
      }
      try { return J(await restore(db, me.flat_id, snap)); } catch (e) { return err(e.message); }
    }
  }

  return err('Not found', 404);
}

// Guest end date: a timestamp within ~13 months, or null for "no end date".
function until(v) {
  const t = Number(v);
  return Number.isFinite(t) && t > now() - 864e5 && t < now() + 400 * 864e5 ? Math.round(t) : null;
}

// Approve a pending member, optionally letting them take over an imported placeholder.
async function approve(db, pendingId, flatId, asPlaceholder) {
  const ph = asPlaceholder && await db.prepare(`SELECT * FROM members WHERE id=? AND flat_id=? AND status='placeholder'`).bind(asPlaceholder, flatId).first();
  if (!ph) {
    await db.prepare(`UPDATE members SET status='approved' WHERE id=? AND status='pending'`).bind(pendingId).run();
    return { ok: true };
  }
  const p = await db.prepare(`SELECT * FROM members WHERE id=?`).bind(pendingId).first();
  await db.batch([
    db.prepare(`DELETE FROM members WHERE id=?`).bind(pendingId),
    db.prepare(`UPDATE members SET status='approved', token_hash=?, tg_code=?, tg_chat_id=? WHERE id=?`).bind(p.token_hash, p.tg_code, p.tg_chat_id, ph.id),
  ]);
  return { ok: true, linked: ph.name };
}

// ---------- backup & restore ----------
async function snapshot(db, flatId) {
  const q = (sql, ...b) => db.prepare(sql).bind(...b).all().then(r => r.results);
  const [flat, members, expenses, recurring] = await Promise.all([
    db.prepare(`SELECT id, name, invite_code, simplify, created_at FROM flats WHERE id=?`).bind(flatId).first(),
    q(`SELECT id, name, role, status, host_id, expires_at, created_at FROM members WHERE flat_id=? AND status IN ('approved','placeholder')`, flatId),
    q(`SELECT id, kind, description, amount, paid_by, split, created_by, source, ext_id, created_at FROM expenses WHERE flat_id=? AND deleted=0 ORDER BY created_at`, flatId),
    q(`SELECT description, amount, paid_by, split, day, last_run FROM recurring WHERE flat_id=? AND active=1`, flatId),
  ]);
  return { app: 'its-settled', version: 1, exported_at: new Date().toISOString(), flat, members,
    expenses: expenses.map(e => ({ ...e, split: JSON.parse(e.split) })), recurring: recurring.map(r => ({ ...r, split: r.split ? JSON.parse(r.split) : null })) };
}

// Replace this flat's entries and monthly bills with a snapshot, as one transaction. People are matched
// by id, then by name; anyone missing comes back as "not joined yet". Current logins are untouched.
async function restore(db, flatId, snap) {
  if (!snap?.app === 'its-settled' || !Array.isArray(snap.members) || !Array.isArray(snap.expenses)) throw new Error("That file isn't an It's Settled backup");
  const cur = (await db.prepare(`SELECT id, name FROM members WHERE flat_id=? AND status IN ('approved','placeholder')`).bind(flatId).all()).results;
  const idMap = {}, newPeople = [];
  for (const m of snap.members) {
    const hit = cur.find(c => c.id === m.id) || cur.find(c => c.name.trim().toLowerCase() === String(m.name).trim().toLowerCase());
    if (hit) idMap[m.id] = hit.id;
    else { idMap[m.id] = randHex(8); newPeople.push({ id: idMap[m.id], name: clean(m.name, 30) || 'Flatmate', role: m.role === 'guest' ? 'guest' : 'member' }); }
  }
  const mapSplit = s => (s || []).map(([id, v]) => [idMap[id], Math.round(v)]).filter(([id]) => id);
  const expenses = snap.expenses.filter(e => idMap[e.paid_by]).map(e => ({
    flat_id: flatId, kind: e.kind === 'settle' ? 'settle' : 'expense', description: clean(e.description, 80) || 'Expense', amount: Math.round(e.amount),
    paid_by: idMap[e.paid_by], split: mapSplit(e.split), created_by: idMap[e.created_by] ?? null, source: e.source || 'web', ext_id: e.ext_id ?? null, created_at: e.created_at,
  })).filter(e => e.split.length);
  const rec = (snap.recurring || []).filter(r => idMap[r.paid_by]).map(r => ({
    id: randHex(8), description: clean(r.description, 60), amount: Math.round(r.amount), paid_by: idMap[r.paid_by],
    split: r.split ? JSON.stringify(r.split.map(id => idMap[id]).filter(Boolean)) : null, day: r.day, last_run: r.last_run ?? null,
  }));
  await db.batch([
    ...(newPeople.length ? [bulkPlaceholders(db, flatId, newPeople)] : []),
    db.prepare(`DELETE FROM expenses WHERE flat_id=?`).bind(flatId),
    db.prepare(`DELETE FROM recurring WHERE flat_id=?`).bind(flatId),
    bulkExpenses(db, expenses),
    db.prepare(`INSERT INTO recurring (id, flat_id, description, amount, paid_by, split, day, last_run, created_at)
      SELECT json_extract(value,'$.id'), ?, json_extract(value,'$.description'), json_extract(value,'$.amount'), json_extract(value,'$.paid_by'),
             json_extract(value,'$.split'), json_extract(value,'$.day'), json_extract(value,'$.last_run'), ? FROM json_each(?)`).bind(flatId, now(), JSON.stringify(rec)),
  ]);
  return { ok: true, expenses: expenses.length, recurring: rec.length, people_added: newPeople.length };
}

// Push a snapshot to the Apps Script in the owner's Google Sheet (backup/Code.gs).
async function pushBackup(env, flatId) {
  if (!env.BACKUP_URL) return;
  try {
    const snap = await snapshot(env.DB, flatId);
    const r = await fetch(env.BACKUP_URL, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: env.BACKUP_SECRET || '', flatId, snapshot: snap }) }).then(r => r.json()).catch(e => ({ error: String(e) }));
    if (r?.ok) await env.DB.prepare(`UPDATE flats SET last_backup=? WHERE id=?`).bind(now(), flatId).run();
    else console.error('backup failed', r);
  } catch (e) { console.error('backup failed', e); }
}
async function backupAll(env) {
  if (!env.BACKUP_URL) return;
  const { results } = await env.DB.prepare(`SELECT id FROM flats`).all();
  for (const f of results) await pushBackup(env, f.id);
}

// ---------- Telegram webhook ----------
async function telegram(env, ctx, secret, u) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) return err('Forbidden', 403);
  const db = env.DB;

  if (u.callback_query) { // Approve / Reject buttons on join requests
    const cq = u.callback_query, [act, mid] = String(cq.data || '').split(':');
    const target = await db.prepare(`SELECT * FROM members WHERE id=?`).bind(mid || '').first();
    const admin = target && await db.prepare(`SELECT id FROM members WHERE flat_id=? AND tg_chat_id=? AND role='admin' AND status='approved'`)
      .bind(target.flat_id, String(cq.from.id)).first();
    let note = 'Not allowed';
    if (admin) {
      if (target.status !== 'pending') note = `Already ${target.status}`;
      else if (act === 'ap') { await approve(db, target.id, target.flat_id); note = `✅ ${target.name} approved`; }
      else { await db.prepare(`UPDATE members SET status='rejected' WHERE id=?`).bind(target.id).run(); note = `❌ ${target.name} rejected`; }
    }
    await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: note });
    if (admin && cq.message) await tg(env, 'editMessageText', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text: `${cq.message.text}\n\n${note}` });
    return J({ ok: true });
  }

  const msg = u.message;
  if (!msg?.text || msg.chat?.type !== 'private') return J({ ok: true });
  const chat = String(msg.chat.id), text = msg.text.trim(), reply = t => send(env, chat, t);
  const done = () => J({ ok: true });

  const start = text.match(/^\/start\s+(\w+)/);
  if (start) {
    const m = await db.prepare(`SELECT m.*, f.name AS flat_name FROM members m JOIN flats f ON f.id=m.flat_id WHERE m.tg_code=? AND m.status IN ('approved','pending')`).bind(start[1]).first();
    if (!m) { await reply(`That link didn't work. Open ${esc(cfg(env).name)} → Flat → Connect Telegram again.`); return done(); }
    await db.batch([
      db.prepare(`UPDATE members SET tg_chat_id=NULL WHERE tg_chat_id=?`).bind(chat), // one chat ↔ one membership
      db.prepare(`UPDATE members SET tg_chat_id=? WHERE id=?`).bind(chat, m.id),
    ]);
    await reply(`👋 Linked to <b>${esc(m.flat_name)}</b> as ${esc(m.name)}${isGuest(m) ? ' (guest)' : ''}.`
      + (m.role === 'admin' ? "\nJoin requests will arrive here with Approve buttons." : '') + '\n\n' + HELP);
    return done();
  }

  const me = await db.prepare(`SELECT m.*, f.simplify FROM members m JOIN flats f ON f.id=m.flat_id WHERE m.tg_chat_id=? AND m.status='approved'`).bind(chat).first();
  if (!me) { await reply(`Open ${esc(cfg(env).name)} → Flat → <b>Connect Telegram</b> to link this chat.`); return done(); }

  if (/^\/(bal|balance|b)\b/i.test(text)) { await reply(await balanceText(env, me)); return done(); }
  if (expired(me)) { await reply('Your guest access has ended. /bal still shows what is left to settle.'); return done(); }
  if (/^\/undo\b/i.test(text)) {
    const last = await db.prepare(`SELECT * FROM expenses WHERE flat_id=? AND created_by=? AND deleted=0 AND source IN ('web','telegram') ORDER BY created_at DESC LIMIT 1`)
      .bind(me.flat_id, me.id).first();
    if (!last) { await reply('Nothing to undo.'); return done(); }
    await db.prepare(`UPDATE expenses SET deleted=1 WHERE id=?`).bind(last.id).run();
    await reply(`↩️ Removed ${money(env, last.amount)} · ${esc(last.description)}`);
    return done();
  }
  const add = text.match(/^(?:\/add\s+)?[^\d\s]?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(.*)$/i);
  if (add && toPaise(add[1])) {
    const amount = toPaise(add[1]), ms = await flatMembers(db, me.flat_id);
    // flatmates split with every flatmate; a guest splits with their host
    const ids = isGuest(me) ? [me.id, ...(counted(ms).some(x => x.id === me.host_id) ? [me.host_id] : [])] : residentIds(ms);
    const description = clean(add[2], 80) || 'Expense';
    await insertExpense(db, { flat_id: me.flat_id, description, amount, paid_by: me.id, split: equalShares(amount, ids), created_by: me.id, source: 'telegram' }).run();
    await reply(`✅ ${money(env, amount)} · ${esc(description)} — split ${ids.length} ways (${money(env, Math.round(amount / ids.length))} each).\n/undo to remove · /bal for balances`);
    ctx.waitUntil(notifyFlat(env, me.flat_id, `🧾 ${esc(me.name)} added <b>${money(env, amount)}</b> · ${esc(description)}`, me.id));
    return done();
  }
  await reply(HELP);
  return done();
}

// ---------- monthly bills ----------
// Current month and day in the flat's timezone (config TIMEZONE).
function localMonth(env, t = now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: cfg(env).timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(t)).map(x => [x.type, x.value]));
  const y = +parts.year, mo = +parts.month;
  return { ym: `${parts.year}-${parts.month}`, day: +parts.day, daysInMonth: new Date(Date.UTC(y, mo, 0)).getUTCDate(),
    label: new Intl.DateTimeFormat(cfg(env).locale, { month: 'short', timeZone: cfg(env).timezone }).format(new Date(t)) };
}
async function runRecurring(env, onlyFlat) {
  const db = env.DB;
  await ensureSchema(db);
  const { ym, day, daysInMonth, label } = localMonth(env);
  const { results } = await db.prepare(`SELECT * FROM recurring WHERE active=1 AND (last_run IS NULL OR last_run<?)` + (onlyFlat ? ' AND flat_id=?' : ''))
    .bind(...(onlyFlat ? [ym, onlyFlat] : [ym])).all();
  for (const r of results) {
    if (Math.min(r.day, daysInMonth) > day) continue;
    const ms = await flatMembers(db, r.flat_id), res = residentIds(ms);
    const want = r.split ? JSON.parse(r.split).filter(id => res.includes(id)) : res;
    if (!want.length || !res.includes(r.paid_by)) continue;
    await db.batch([
      insertExpense(db, { flat_id: r.flat_id, description: `${r.description} · ${label}`, amount: r.amount, paid_by: r.paid_by,
        split: equalShares(r.amount, want), source: 'auto', ext_id: `rec:${r.id}:${ym}` }),
      db.prepare(`UPDATE recurring SET last_run=? WHERE id=?`).bind(ym, r.id),
    ]);
    await notifyFlat(env, r.flat_id, `🔁 Monthly bill added: <b>${money(env, r.amount)}</b> · ${esc(r.description)} (paid by ${esc(ms.find(m => m.id === r.paid_by)?.name || '?')})`);
  }
}

// ---------- static assets ----------
// Service worker: the app shell opens instantly and offline. API calls are never cached here;
// the page keeps its own data cache and offline outbox in localStorage.
const SW = `const C='its-settled-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.add('/')));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
  if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put('/',cp));return r}).catch(()=>caches.match('/')));}
});`;
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#1f6b55"/><path d="M146 268l74 74 146-170" fill="none" stroke="#fff" stroke-width="56" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/sw.js') return new Response(SW, { headers: { 'content-type': 'text/javascript', 'cache-control': 'no-cache' } });
    if (url.pathname === '/icon.svg') return new Response(ICON, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=86400' } });
    if (url.pathname === '/manifest.json') return J({ name: cfg(env).name, short_name: cfg(env).name, start_url: '/', display: 'standalone',
      background_color: '#eef1ec', theme_color: '#eef1ec', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] });
    if (!url.pathname.startsWith('/api/'))
      return new Response(page(env), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
    try { return await api(req, env, ctx, url); }
    catch (e) { console.error(e); return err('Something went wrong on the server. Try again in a moment.', 500); }
  },
  async scheduled(_evt, env, ctx) { ctx.waitUntil(runRecurring(env).then(() => backupAll(env))); },
};
