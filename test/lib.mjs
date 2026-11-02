// Shared helpers for API tests. Run `npm run dev` first (or set BASE=http://localhost:8788).
export const B = process.env.BASE || 'http://localhost:8787';
export const call = async (tok, m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (tok || '') }, body: b ? JSON.stringify(b) : undefined });
  return { s: r.status, d: await r.json() };
};
export const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
export const wait = ms => new Promise(r => setTimeout(r, ms));
// Balances by name, in rupees, from a /api/me response.
export const balances = d => {
  const n = {};
  for (const e of d.expenses) { n[e.paid_by] = (n[e.paid_by] || 0) + e.amount; for (const [i, a] of JSON.parse(e.split)) n[i] = (n[i] || 0) - a; }
  return Object.fromEntries(d.members.filter(m => m.status !== 'pending').map(m => [m.name, (n[m.id] || 0) / 100]));
};
export const newFlat = async (name = 'Asha') => {
  const token = (await call(null, 'POST', '/api/flats', { flat: 'Test Flat', name })).d.token;
  return { token, me: (await call(token, 'GET', '/api/me')).d };
};
