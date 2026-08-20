const prisma = require('../lib/prisma');
const env = require('../config/env');
const secretCrypto = require('../lib/secretCrypto');

const GEMINI_KEY_SETTING = 'geminiApiKey';
const CACHE_TTL_MS = 30_000;

let cache = { value: undefined, expiresAt: 0 };

function setCache(value) {
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
}

async function getGeminiApiKey() {
  if (cache.value !== undefined && Date.now() < cache.expiresAt) {
    return cache.value;
  }

  const row = await prisma.appSetting.findUnique({ where: { key: GEMINI_KEY_SETTING } });
  const dbValue = row ? secretCrypto.decrypt(row.value) : '';
  const resolved = dbValue || env.geminiApiKey || '';
  setCache(resolved);
  return resolved;
}

async function setGeminiApiKey(rawKey) {
  const trimmed = (rawKey || '').trim();
  if (!trimmed) {
    throw new Error("Gemini API kaliti bo'sh bo'lishi mumkin emas.");
  }

  await prisma.appSetting.upsert({
    where: { key: GEMINI_KEY_SETTING },
    update: { value: secretCrypto.encrypt(trimmed) },
    create: { key: GEMINI_KEY_SETTING, value: secretCrypto.encrypt(trimmed) },
  });

  setCache(trimmed); // Effective immediately — no restart, no TTL wait.
}

async function isGeminiKeyConfigured() {
  const key = await getGeminiApiKey();
  return Boolean(key);
}

module.exports = { getGeminiApiKey, setGeminiApiKey, isGeminiKeyConfigured };
