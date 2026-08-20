const express = require('express');
const syncService = require('../services/sync.service');

const router = express.Router();

router.post('/amocrm', async (req, res, next) => {
  try {
    const result = await syncService.syncAmoCrmCalls();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
