const express = require('express');
const autoAnalysisQuota = require('../services/autoAnalysisQuota.service');

const router = express.Router();

router.get('/status', async (req, res, next) => {
  try {
    const status = await autoAnalysisQuota.getStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
