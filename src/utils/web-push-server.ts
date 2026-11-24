import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface VapidKeyPair {
  publicKey: string; // base64url uncompressed 65-byte P-256 point
  privateKeyPem: string;
}

export interface ScheduledLunchPush {
  id: string;
  subscription: PushSubscriptionJSON;
  targetEpoch: number;
  preAlertEpoch: number;
  durationMinutes: number;
  expectedEndTimeStr: string;
  preAlertSent: boolean;
  alarmSent: boolean;
}

export function base64UrlEncode(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function base64UrlDecode(str: string): Buffer {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

export function generateVapidKeyPair(): VapidKeyPair {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const rawPub = ecdh.getPublicKey(); // 65 bytes uncompressed (0x04 || x || y)
  const rawPriv = ecdh.getPrivateKey(); // 32 bytes

  // Wrap raw P-256 keypair into PKCS8 DER/PEM via Node JWK import
  const x = base64UrlEncode(rawPub.subarray(1, 33));
  const y = base64UrlEncode(rawPub.subarray(33, 65));
  const d = base64UrlEncode(rawPriv);

  const keyObj = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d,
    },
    format: 'jwk',
  });

  const privateKeyPem = keyObj.export({ type: 'pkcs8', format: 'pem' }).toString();
  return {
    publicKey: base64UrlEncode(rawPub),
    privateKeyPem,
  };
}

export function loadOrCreateVapidKeys(storagePath: string): VapidKeyPair {
  const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPriv = process.env.VAPID_PRIVATE_KEY_PEM?.trim();
  if (envPub && envPriv) {
    return { publicKey: envPub, privateKeyPem: envPriv.replace(/\\n/g, '\n') };
  }

  try {
    if (fs.existsSync(storagePath)) {
      const parsed = JSON.parse(fs.readFileSync(storagePath, 'utf8')) as Partial<VapidKeyPair>;
      if (parsed.publicKey && parsed.privateKeyPem) {
        return { publicKey: parsed.publicKey, privateKeyPem: parsed.privateKeyPem };
      }
    }
  } catch {
    // Regenerate below if corrupted
  }

  const fresh = generateVapidKeyPair();
  try {
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    fs.writeFileSync(storagePath, JSON.stringify(fresh, null, 2), 'utf8');
  } catch {
    // Non-fatal in read-only environments
  }
  return fresh;
}

export function createVapidAuthorizationHeader(
  endpoint: string,
  vapid: VapidKeyPair,
  subject = 'mailto:suporte@pontofacil.local',
  nowEpochSeconds = Math.floor(Date.now() / 1000)
): { authorization: string; jwt: string } {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payloadB64 = base64UrlEncode(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: nowEpochSeconds + 12 * 3600,
        sub: subject,
      })
    )
  );

  const unsignedToken = `${headerB64}.${payloadB64}`;
  const signature = crypto.sign('sha256', Buffer.from(unsignedToken, 'utf8'), {
    key: vapid.privateKeyPem,
    dsaEncoding: 'ieee-p1363',
  });

  const jwt = `${unsignedToken}.${base64UrlEncode(signature)}`;
  return {
    jwt,
    authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
  };
}

/**
 * Encrypts a JSON/text Web Push payload per RFC 8291 (`aes128gcm` content coding).
 */
export function encryptWebPushPayload(
  payloadText: string,
  clientPublicKeyB64: string,
  authSecretB64: string
): Buffer {
  const clientPublicKey = base64UrlDecode(clientPublicKeyB64);
  const authSecret = base64UrlDecode(authSecretB64);

  if (clientPublicKey.length !== 65 || clientPublicKey[0] !== 0x04) {
    throw new Error('Invalid p256dh client public key');
  }
  if (authSecret.length < 16) {
    throw new Error('Invalid Web Push auth secret');
  }

  const serverEcdh = crypto.createECDH('prime256v1');
  serverEcdh.generateKeys();
  const serverPublicKey = serverEcdh.getPublicKey(); // 65 bytes uncompressed
  const sharedSecret = serverEcdh.computeSecret(clientPublicKey);
  const salt = crypto.randomBytes(16);

  // RFC 8291 Section 3.3 key derivation
  const authInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    clientPublicKey,
    serverPublicKey,
  ]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, authSecret, authInfo, 32));

  const cek = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16)
  );
  const nonce = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12)
  );

  const plaintext = Buffer.concat([Buffer.from(payloadText, 'utf8'), Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const idLen = Buffer.from([serverPublicKey.length]);

  return Buffer.concat([salt, rs, idLen, serverPublicKey, ciphertext]);
}

export async function sendWebPushNotification(
  subscription: PushSubscriptionJSON,
  payload: Record<string, unknown>,
  vapid: VapidKeyPair,
  ttlSeconds = 3600
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { ok: false, status: 400, error: 'Assinatura Web Push incompleta.' };
  }

  const body = encryptWebPushPayload(
    JSON.stringify(payload),
    subscription.keys.p256dh,
    subscription.keys.auth
  );
  const { authorization } = createVapidAuthorizationHeader(subscription.endpoint, vapid);

  try {
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttlSeconds),
        Urgency: 'high',
      },
      body: new Uint8Array(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: errText || `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
