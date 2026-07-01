/**
 * Minimal Web Push (RFC 8291 + RFC 8188 aes128gcm) + VAPID (RFC 8292) using WebCrypto.
 * Runs on the Cloudflare Worker runtime — no Node crypto needed.
 */

function b64urlDecode(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = t.length % 4;
  if (pad) t += "=".repeat(4 - pad);
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlEncode(b: Uint8Array | ArrayBuffer): string {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    len * 8,
  );
  return new Uint8Array(bits);
}

async function importVapidPrivate(priv: Uint8Array, pub: Uint8Array): Promise<CryptoKey> {
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: b64urlEncode(priv),
    x: b64urlEncode(x),
    y: b64urlEncode(y),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function vapidAuthorization(endpoint: string): Promise<string> {
  const pub = b64urlDecode(process.env.VAPID_PUBLIC_KEY!);
  const priv = b64urlDecode(process.env.VAPID_PRIVATE_KEY!);
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  const url = new URL(endpoint);
  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: `${url.protocol}//${url.host}`,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  };
  const h = b64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signing = new TextEncoder().encode(`${h}.${p}`);
  const key = await importVapidPrivate(priv, pub);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, signing);
  const jwt = `${h}.${p}.${b64urlEncode(sig)}`;
  return `vapid t=${jwt}, k=${b64urlEncode(pub)}`;
}

async function encryptForSubscription(payload: Uint8Array, uaPubB64: string, authSecretB64: string): Promise<Uint8Array> {
  const uaPubRaw = b64urlDecode(uaPubB64);
  const authSecret = b64urlDecode(authSecretB64);

  const asKeypair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeypair.publicKey));

  const uaPubKey = await crypto.subtle.importKey(
    "raw",
    uaPubRaw as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPubKey }, asKeypair.privateKey, 256),
  );

  const keyInfo = concat(new TextEncoder().encode("WebPush: info\0"), uaPubRaw, asPubRaw);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  const plaintext = concat(payload, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, plaintext as BufferSource),
  );

  // RFC 8188 header: salt(16) || rs(4 BE) || idlen(1) || keyid(as_pub 65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const header = concat(salt, rs, new Uint8Array([asPubRaw.length]), asPubRaw);
  return concat(header, ciphertext);
}

export interface PushSubscriptionRecord {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type SendResult =
  | { ok: true }
  | { ok: false; status: number; expired: boolean; error?: string };

export async function sendWebPush(sub: PushSubscriptionRecord, payload: object | string): Promise<SendResult> {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  try {
    const body = await encryptForSubscription(new TextEncoder().encode(raw), sub.p256dh, sub.auth);
    const authorization = await vapidAuthorization(sub.endpoint);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Authorization: authorization,
      },
      body: body as BufferSource,
    });
    if (res.ok) return { ok: true };
    const expired = res.status === 404 || res.status === 410;
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, expired, error: text };
  } catch (e) {
    return { ok: false, status: 0, expired: false, error: e instanceof Error ? e.message : String(e) };
  }
}
