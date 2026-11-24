import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  generateVapidKeyPair,
  createVapidAuthorizationHeader,
  encryptWebPushPayload,
  base64UrlDecode,
  base64UrlEncode,
} from './web-push-server';
import { buildAndroidNativeWrapperZip } from './android-wrapper';

test('VAPID keypair and ES256 JWT authorization header verify with P-256 public key', () => {
  const vapid = generateVapidKeyPair();
  const rawPub = base64UrlDecode(vapid.publicKey);
  assert.equal(rawPub.length, 65);
  assert.equal(rawPub[0], 0x04);

  const { jwt, authorization } = createVapidAuthorizationHeader(
    'https://fcm.googleapis.com/fcm/send/example-token-123',
    vapid,
    'mailto:suporte@pontofacil.local',
    1700000000
  );

  assert.ok(authorization.startsWith('vapid t='));
  const parts = jwt.split('.');
  assert.equal(parts.length, 3);

  const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
  assert.equal(payload.aud, 'https://fcm.googleapis.com');
  assert.equal(payload.exp, 1700043200);

  const pubKeyObj = crypto.createPublicKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: base64UrlEncode(rawPub.subarray(1, 33)),
      y: base64UrlEncode(rawPub.subarray(33, 65)),
    },
    format: 'jwk',
  });

  const verified = crypto.verify(
    'sha256',
    Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'),
    { key: pubKeyObj, dsaEncoding: 'ieee-p1363' },
    base64UrlDecode(parts[2])
  );
  assert.equal(verified, true);
});

test('encryptWebPushPayload produces valid RFC 8291 aes128gcm packet decryptable by client ECDH', () => {
  const clientEcdh = crypto.createECDH('prime256v1');
  clientEcdh.generateKeys();
  const clientPub = clientEcdh.getPublicKey();
  const authSecret = crypto.randomBytes(16);

  const msg = JSON.stringify({ type: 'alarm', title: 'Fim do Almoço' });
  const encrypted = encryptWebPushPayload(
    msg,
    base64UrlEncode(clientPub),
    base64UrlEncode(authSecret)
  );

  // Parse RFC 8188 header: 16-byte salt + 4-byte rs + 1-byte idlen(65) + 65-byte serverPub
  const salt = encrypted.subarray(0, 16);
  const rs = encrypted.readUInt32BE(16);
  const idlen = encrypted[20];
  assert.equal(rs, 4096);
  assert.equal(idlen, 65);
  const serverPub = encrypted.subarray(21, 21 + 65);
  const ciphertextWithTag = encrypted.subarray(21 + 65);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);

  const shared = clientEcdh.computeSecret(serverPub);
  const authInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    clientPub,
    serverPub,
  ]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, authInfo, 32));
  const cek = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16)
  );
  const nonce = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12)
  );

  const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  // Last byte is RFC 8188 record delimiter 0x02
  assert.equal(decrypted[decrypted.length - 1], 0x02);
  assert.equal(decrypted.subarray(0, decrypted.length - 1).toString('utf8'), msg);
});

test('buildAndroidNativeWrapperZip creates valid PKZIP archive containing MainActivity.kt and AndroidManifest.xml', () => {
  const zipBuf = buildAndroidNativeWrapperZip('https://meu-app.example.com');
  // PKZIP local file header signature PK\x03\x04
  assert.equal(zipBuf.readUInt32LE(0), 0x04034b50);
  // End of Central Directory signature PK\x05\x06 at end
  assert.equal(zipBuf.readUInt32LE(zipBuf.length - 22), 0x06054b50);
  const asLatin1 = zipBuf.toString('latin1');
  assert.ok(asLatin1.includes('AndroidManifest.xml'));
  assert.ok(asLatin1.includes('MainActivity.kt'));
  assert.ok(asLatin1.includes('LunchAlarmReceiver.kt'));
});
