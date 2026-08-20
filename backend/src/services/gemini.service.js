const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const env = require('../config/env');
const settingsService = require('./settings.service');
const { analysisResultSchema } = require('../lib/analysisSchema');

// @google/genai ships as ESM; a dynamic import from this CommonJS file avoids
// the require()/ESM interop bug in its published "require" entry point.
// Node caches the module import itself, but the client is rebuilt on every
// call (cheap, local, no network) since the API key can now change at
// runtime via Sozlamalar — a client built once at module load would keep
// using whatever key was live at process start.
let genaiModulePromise;
async function getGenaiModule() {
  if (!genaiModulePromise) {
    genaiModulePromise = import('@google/genai');
  }
  return genaiModulePromise;
}

async function getClient() {
  const apiKey = await settingsService.getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API kaliti sozlanmagan.');
  }
  const { GoogleGenAI } = await getGenaiModule();
  return new GoogleGenAI({ apiKey });
}

const ANALYSIS_PROMPT = `
Sen tajribali sotuv menejerlarini baholovchi sun'iy intellekt tahlilchisisan.
Senga bitta sotuv qo'ng'irog'ining audio yozuvi beriladi. Sotuvchining ismi: Sotuvchi. Mijoz: Mijoz.

VAZIFA:
1. Audio asosida to'liq transkript tuzing, gapiruvchini aniqlang (Sotuvchi yoki Mijoz), har bir jumla uchun taxminiy vaqt belgisini (mm:ss) bering.
2. Suhbatni quyidagi mezonlar bo'yicha 0-100 ball bilan baholang: communication (muloqot), needDiscovery (ehtiyojni aniqlash), productPresentation (mahsulot taqdimoti), objectionHandling (e'tiroz bilan ishlash), closing (sotuvni yakunlash).
3. overallScore - yuqoridagi 5 ta ballning umumiy, vaznli o'rtacha bahosi (0-100).
4. Sotuvchining kuchli tomonlarini aniqlang (faqat suhbatda haqiqatan sodir bo'lgan holatlar).
5. Sotuvchining xatolarini aniqlang. Har bir xato uchun: category, severity (low/medium/high), description, evidence (transkriptdan aniq iqtibos), whyItIsWrong, recommendation, betterPhrase.
6. Agar biror xato yoki xulosa uchun yetarli dalil topa olmasangiz, "Dalil yetarli emas" deb yozing va HECH QACHON dalil yoki iqtibosni o'ylab topmang (fabricate qilmang).

MUHIM QOIDALAR:
- summary, customerNeed, customerObjection, customerIntent, strengths, mistakes ichidagi barcha matnlar, recommendation va betterPhrase — FAQAT o'zbek lotin alifbosida yozilishi shart. Kirill va rus tilidan foydalanmang.
- transcript ichidagi "text" maydoni suhbatda haqiqatda gapirilgan tildagi so'zlarni AYNAN o'zi bo'lishi kerak (tarjima qilmang, o'zgartirmang).
- Faqat quyidagi JSON formatida javob bering, boshqa hech qanday matn qo'shmang.

JSON FORMAT:
{
  "overallScore": number,
  "scores": {
    "communication": number,
    "needDiscovery": number,
    "productPresentation": number,
    "objectionHandling": number,
    "closing": number
  },
  "summary": string,
  "customerNeed": string,
  "customerObjection": string,
  "customerIntent": string,
  "strengths": [string],
  "mistakes": [
    {
      "category": string,
      "severity": "low" | "medium" | "high",
      "description": string,
      "evidence": string,
      "whyItIsWrong": string,
      "recommendation": string,
      "betterPhrase": string
    }
  ],
  "transcript": [
    { "speaker": "Sotuvchi" | "Mijoz", "timestamp": "mm:ss", "text": string }
  ]
}
`;

function guessMimeType(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  const map = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
  };
  return map[ext] || 'audio/mpeg';
}

async function downloadRecording(recordingUrl) {
  const response = await axios.get(recordingUrl, { responseType: 'arraybuffer', timeout: 60000 });
  const mimeType = guessMimeType(recordingUrl);
  const ext = mimeType === 'audio/wav' ? 'wav' : 'mp3';
  const tmpPath = path.join(os.tmpdir(), `call-${crypto.randomUUID()}.${ext}`);
  fs.writeFileSync(tmpPath, response.data);
  return { tmpPath, mimeType };
}

async function waitForFileActive(ai, fileName, { timeoutMs = 60000, intervalMs = 2000 } = {}) {
  const start = Date.now();
  let file = await ai.files.get({ name: fileName });
  while (file.state === 'PROCESSING') {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Audio fayl Gemini tomonidan tayyor bo\'lmadi (timeout).');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    file = await ai.files.get({ name: fileName });
  }
  if (file.state !== 'ACTIVE') {
    throw new Error(`Gemini audio faylni qabul qilmadi (holat: ${file.state}).`);
  }
  return file;
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  return JSON.parse(cleaned);
}

// Gemini's JSON output is occasionally malformed even with
// responseMimeType: 'application/json' (observed directly — not every
// attempt, but frequently enough to break "click the button, it works").
// Re-asking (same uploaded file, no re-download/re-upload needed) resolves
// it in practice; if every attempt fails, the raw response snippet goes
// into the thrown error so it ends up in analysisError — visible through
// the app itself, no server log access ever needed to diagnose this again.
const MAX_GENERATION_ATTEMPTS = 3;

async function generateAnalysis(ai, contentsArgs) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const response = await ai.models.generateContent({
      model: env.geminiModel,
      contents: contentsArgs,
      config: { responseMimeType: 'application/json' },
    });

    const text = response.text;
    if (!text) {
      lastError = new Error('Gemini javob bermadi.');
      continue;
    }

    let parsedJson;
    try {
      parsedJson = extractJson(text);
    } catch (err) {
      const snippet = text.slice(0, 200).replace(/\s+/g, ' ');
      lastError = new Error(`Gemini JSON formatida javob bermadi: ${err.message}. Boshlanishi: "${snippet}"`);
      continue;
    }

    const validated = analysisResultSchema.safeParse(parsedJson);
    if (!validated.success) {
      lastError = new Error('Gemini javobi kutilgan JSON tuzilishiga mos kelmadi.');
      continue;
    }

    return { result: validated.data, raw: parsedJson };
  }
  throw lastError;
}

async function analyzeCallRecording(recordingUrl) {
  const ai = await getClient(); // throws with the Uzbek "kalit sozlanmagan" message if unset

  const { tmpPath, mimeType } = await downloadRecording(recordingUrl);

  try {
    const { createUserContent, createPartFromUri } = await getGenaiModule();

    const uploaded = await ai.files.upload({ file: tmpPath, config: { mimeType } });
    const activeFile = await waitForFileActive(ai, uploaded.name);

    const contents = createUserContent([
      createPartFromUri(activeFile.uri, activeFile.mimeType),
      ANALYSIS_PROMPT,
    ]);

    return await generateAnalysis(ai, contents);
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

module.exports = { analyzeCallRecording };
