const express = require('express');
const settingsService = require('../services/settings.service');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// Never returns the actual key value anywhere — only whether one is set.
router.get('/', async (req, res, next) => {
  try {
    const geminiKeyConfigured = await settingsService.isGeminiKeyConfigured();
    res.json({ geminiKeyConfigured });
  } catch (err) {
    next(err);
  }
});

router.put('/gemini-key', async (req, res, next) => {
  try {
    const { apiKey } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string') {
      throw new ApiError(400, "Gemini API kaliti kiritilmadi.");
    }
    await settingsService.setGeminiApiKey(apiKey);
    res.json({ geminiKeyConfigured: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
