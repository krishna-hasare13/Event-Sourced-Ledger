const express = require('express');
const router = express.Router();
const { createTransaction } = require('../services/transactionService');

router.post('/', async (req, res, next) => {
  try {
    const idempotencyKey = req.get('Idempotency-Key') || req.get('idempotency-key');
    const transaction = await createTransaction(req.body, { idempotencyKey });
    res.status(201).json(transaction);
  } catch (err) { next(err); }
});

module.exports = router;