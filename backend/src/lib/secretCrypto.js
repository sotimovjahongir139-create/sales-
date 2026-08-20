const crypto = require('crypto');
const env = require('../config/env');

// Encrypts secret-shaped settings (e.g. a Gemini API key) at rest, without
// requiring a dedicated encryption-key env var — that would just recreate
// the exact "someone needs server file access to set a config value"
// problem this table exists to eliminate. DATABASE_URL is already required
// for the app to run at all, so it's the one secret we can assume is
// reliably and correctly present, and it's derived through scrypt (not
// used directly) before use as an AES key.
const KEY = crypto.scryptSync(env.databaseUrl, 'ai-sales-app-setting-v1', 32);
const ALGORITHM = 'aes-256-gcm';

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

function decrypt(encoded) {
  const raw = Buffer.from(encoded, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
