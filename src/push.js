// Web Push with no dependencies: VAPID signing (RFC 8292) and payload encryption (RFC 8291, aes128gcm),
// using only WebCrypto. Server-side only (imported by worker.js, never inlined into the page).
//
// The VAPID key pair and an HMAC secret for one-tap notification actions are created on first use and
// stored in the `kv` table, so a deployment needs no setup and the private key never touches git.

const enc = new TextEncoder();
export const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = s => {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - t.length % 4) % 4)), c => c.charCodeAt(0));
};
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const hmac = async (key, data) => new Uint8Array(await crypto.subtle.sign('HMAC',
  await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data));

// { jwk: private ECDSA key, pub: base64url raw public key (the browser's applicationServerKey), secret }
export async function pushKeys(db) {
  const read = () => db.prepare(`SELECT v FROM kv WHERE k='push'`).first();
  let row = await read();
  if (!row) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const v = { jwk: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)),
      secret: b64u(crypto.getRandomValues(new Uint8Array(32))) };
    await db.prepare(`INSERT OR IGNORE INTO kv (k, v) VALUES ('push', ?)`).bind(JSON.stringify(v)).run(); // two racing first calls: one wins
    row = await read();
  }
  return JSON.parse(row.v);
}

// Signed token for a one-tap action from a notification (e.g. "I paid"), bound to one member and one item.
export const actionSig = async (keys, scope, id, memberId) => b64u(await hmac(unb64u(keys.secret), enc.encode(`${scope}:${id}:${memberId}`)));

// RFC 8291: encrypt `payload` (string) for a subscription's p256dh/auth keys. Returns the request body.
export async function encryptPayload(payload, p256dh, auth) {
  const uaPub = unb64u(p256dh), authSecret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const header = new Uint8Array(21);
  header.set(salt, 0); new DataView(header.buffer).setUint32(16, 4096); header[20] = asPub.length;
  return concat(header, asPub, ct);
}

// RFC 8292: VAPID JWT for the push service's origin. `subject` must be an https: or mailto: URL (Apple checks).
async function vapidJwt(keys, endpoint, subject) {
  const part = o => b64u(enc.encode(JSON.stringify(o)));
  const unsigned = part({ typ: 'JWT', alg: 'ES256' }) + '.' + part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject });
  const k = await crypto.subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return unsigned + '.' + b64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc.encode(unsigned)));
}

// Send one notification. Returns the push service's HTTP status (404/410 mean the subscription is gone).
export async function sendPush(keys, sub, message, subject) {
  const body = await encryptPayload(JSON.stringify(message), sub.p256dh, sub.auth);
  const r = await fetch(sub.endpoint, {
    method: 'POST', body,
    headers: { 'content-type': 'application/octet-stream', 'content-encoding': 'aes128gcm', ttl: '86400', urgency: 'normal',
      authorization: `vapid t=${await vapidJwt(keys, sub.endpoint, subject)}, k=${keys.pub}` },
  });
  return r.status;
}
