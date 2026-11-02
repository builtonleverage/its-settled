// Stand-in for the Google Apps Script web app (same doPost/doGet contract as backup/Code.gs).
import http from 'http';
const SECRET = 'bksecret', store = {}; let posts = 0;
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), send = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
  if (u.pathname === '/stats') return send({ posts, flats: Object.keys(store) });
  if (req.method === 'GET') {
    if (u.searchParams.get('key') !== SECRET) return send({ error: 'Bad key' });
    return send(store[u.searchParams.get('flat')] || { error: 'No backups found for this flat yet' });
  }
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = JSON.parse(b); if (j.key !== SECRET) return send({ error: 'Bad key' });
    posts++; store[j.flatId] = j.snapshot; send({ ok: true });
  });
}).listen(9999);
