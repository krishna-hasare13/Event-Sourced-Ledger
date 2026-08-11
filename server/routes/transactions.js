const express = require('express');
const router = express.Router();
const { createTransaction } = require('../services/transactionService');
const { createValidationMiddleware } = require('../middleware/validate');
const { z } = require('zod');

const transactionSchema = z.object({
  description: z.string().trim().optional().default(''),
  entries: z.array(z.object({
    accountId: z.string().trim().min(1),
    amount: z.number().finite().refine(value => value !== 0, 'Amount must be non-zero')
  })).min(2)
});

router.post('/', createValidationMiddleware(transactionSchema), async (req, res, next) => {
  try {
    const idempotencyKey = req.get('Idempotency-Key') || req.get('idempotency-key');
    const transaction = await createTransaction(req.body, {
      idempotencyKey,
      userId: req.user.id,
      requestId: req.requestId
    });
    res.status(201).json(transaction);
  } catch (err) { next(err); }
});

module.exports = router;