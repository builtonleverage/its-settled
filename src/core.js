// It's Settled core: pure functions shared by the Worker and the browser.
//
// The Worker imports this module directly. For the browser, worker.js inlines each function's
// source into app.html at the CORE placeholder, and scripts/build-demo.mjs does the same for the
// standalone demo. So the server, the Telegram bot and the app always run the same money math.
//
// RULES for this file:
//   - every export is a plain `export function` (the source is copied with Function#toString)
//   - no imports, no module-level variables, no closures; functions may call each other by name
//   - money is integer paise; an expense split is [[memberId, paise], ...] summing exactly to amount

export function toPaise(v) {
  const n = Math.round(Number(String(v ?? '').replace(/[,₹\s]/g, '')) * 100);
  return Number.isFinite(n) && n > 0 && n < 1e11 ? n : 0;
}

// Equal split; the first people absorb leftover paise so the shares add up exactly.
export function equalShares(amount, ids) {
  const base = Math.floor(amount / ids.length), rem = amount - base * ids.length;
  return ids.map((id, i) => [id, base + (i < rem ? 1 : 0)]);
}

export function sharesOf(e) {
  return typeof e.split === 'string' ? JSON.parse(e.split) : e.split;
}

// True when a member paid for or shares in an entry (what a guest is allowed to see).
export function involves(e, id) {
  return e.paid_by === id || sharesOf(e).some(s => s[0] === id);
}

// Net balance per member: positive = others owe them, negative = they owe.
export function netBalances(expenses) {
  const net = {};
  for (const e of expenses) {
    net[e.paid_by] = (net[e.paid_by] || 0) + e.amount;
    for (const [id, a] of sharesOf(e)) net[id] = (net[id] || 0) - a;
  }
  return net;
}

// Direct debts: each sharer owes the payer their share, netted per pair of people.
export function pairDebts(expenses) {
  const pair = {};
  for (const e of expenses) {
    for (const [id, a] of sharesOf(e)) {
      if (id === e.paid_by || !a) continue;
      const k = id < e.paid_by ? id + '|' + e.paid_by : e.paid_by + '|' + id;
      pair[k] = (pair[k] || 0) + (id < e.paid_by ? a : -a); // positive: first id owes second
    }
  }
  const out = [];
  for (const [k, v] of Object.entries(pair)) {
    if (!v) continue;
    const [x, y] = k.split('|');
    out.push(v > 0 ? { from: x, to: y, amount: v } : { from: y, to: x, amount: -v });
  }
  return out;
}

// Fewest payments: settle net balances greedily (largest debtor pays largest creditor).
// A owes B and B owes C becomes A pays C.
export function simplifyDebts(net) {
  const cr = [], dr = [];
  for (const [id, v] of Object.entries(net)) {
    if (v > 0) cr.push({ id, v }); else if (v < 0) dr.push({ id, v: -v });
  }
  cr.sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1));
  dr.sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1));
  const out = [];
  let i = 0, j = 0;
  while (i < dr.length && j < cr.length) {
    const x = Math.min(dr[i].v, cr[j].v);
    out.push({ from: dr[i].id, to: cr[j].id, amount: x });
    dr[i].v -= x; cr[j].v -= x;
    if (!dr[i].v) i++;
    if (!cr[j].v) j++;
  }
  return out;
}

// The settle-up list shown everywhere. Guests (role 'guest') always settle directly with the
// people they shared with; only flatmate-to-flatmate debts are simplified, and only when on.
// Amounts under ₹1 are ignored.
export function settlePlan(members, expenses, simplify) {
  const guests = new Set(members.filter(m => m.role === 'guest').map(m => m.id));
  const direct = [], net = {};
  for (const d of pairDebts(expenses)) {
    if (simplify && !guests.has(d.from) && !guests.has(d.to)) {
      net[d.from] = (net[d.from] || 0) - d.amount;
      net[d.to] = (net[d.to] || 0) + d.amount;
    } else direct.push(d);
  }
  return [...(simplify ? simplifyDebts(net) : []), ...direct]
    .filter(d => d.amount >= 100)
    .sort((a, b) => b.amount - a.amount);
}

export function parseCSV(text) {
  const rows = [];
  let row = [], f = '', q = false;
  text = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// Tricount CSV export → rows ready for /api/import. Shares are converted to exact paise
// (Tricount rounds them, so 1600 / 3 comes out as 533.33 x 3) and keyed for re-import dedupe.
export function parseTricount(text) {
  const num = s => { const n = Number(String(s ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
  const rows = parseCSV(text), head = (rows.shift() || []).map(h => h.trim().toLowerCase());
  const col = n => head.indexOf(n);
  if (col('who paid') < 0 || col('for whom') < 0 || col('split amounts') < 0)
    throw new Error("This doesn't look like a Tricount export. It needs the Who paid, For whom and Split amounts columns.");
  const g = (r, n) => (col(n) >= 0 ? r[col(n)] : '') ?? '';
  const out = [], seen = new Set();
  let skipped = 0;
  for (const r of rows) {
    const type = g(r, 'type').trim().toLowerCase() || 'expense';
    const orig = num(g(r, 'amount')), conv = num(g(r, 'converted amount')) || orig;
    const payer = g(r, 'who paid').trim();
    const who = g(r, 'for whom').split(';').map(s => s.trim());
    const vals = g(r, 'split amounts').split(';').map(num);
    const total = Math.round(Math.abs(conv) * 100);
    if (!payer || !total || !who[0]) { skipped++; continue; }
    const scale = orig ? Math.abs(conv / orig) : 1, m = new Map();
    who.forEach((n, i) => n && m.set(n, (m.get(n) || 0) + Math.round(Math.abs(vals[i] || 0) * scale * 100)));
    const sh = [...m.entries()];
    let diff = total - sh.reduce((a, [, x]) => a + x, 0);
    for (let i = 0; diff && i < 100000; i++) { const st = Math.sign(diff); sh[i % sh.length][1] += st; diff -= st; }
    const sign = type === 'income' ? -1 : 1;
    const tz = g(r, 'timezone').trim();
    const dt = Date.parse(g(r, 'date & time').trim().replace(' ', 'T') + (/^[+-]\d\d:\d\d$/.test(tz) ? tz : 'Z'));
    seen.add(payer); sh.forEach(([n]) => seen.add(n));
    out.push({
      payer, amount: total * sign, shares: sh.map(([n, x]) => [n, x * sign]),
      description: g(r, 'purpose').trim() || g(r, 'category').trim() || 'Imported',
      kind: /transfer|reimburse/.test(type) ? 'settle' : 'expense',
      date: Number.isFinite(dt) ? dt : Date.now(), key: 'tc:' + hashStr(r.join('\u0001')),
    });
  }
  return { rows: out, names: [...seen], skipped };
}
