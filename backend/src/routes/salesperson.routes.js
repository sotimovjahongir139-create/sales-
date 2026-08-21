const express = require('express');
const salespersonService = require('../services/salesperson.service');

const router = express.Router();

router.get('/summary', async (req, res, next) => {
  try {
    const summary = await salespersonService.getSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
