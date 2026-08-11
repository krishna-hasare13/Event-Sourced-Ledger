const express = require('express');
const router = express.Router();
const accountService = require('../services/accountService');
const auditService = require('../services/auditService');
const { createValidationMiddleware } = require('../middleware/validate');
const { z } = require('zod');

const accountCreateSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['asset', 'liability', 'equity', 'credit'])
});

const listQuerySchema = z.object({
  cursor: z.string().optional().refine(value => !value || !Number.isNaN(Date.parse(value)), 'cursor must be a valid date').optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const asOfQuerySchema = z.object({
  asOf: z.string().optional().refine(value => !value || !Number.isNaN(Date.parse(value)), 'asOf must be a valid date').optional()
});

const auditQuerySchema = z.object({
  cursor: z.string().optional().refine(value => !value || !Number.isNaN(Date.parse(value)), 'cursor must be a valid date').optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

router.post('/', createValidationMiddleware(accountCreateSchema), async (req, res, next) => {
  try {
    const account = await accountService.createAccount(req.body, { userId: req.user.id });
    res.status(201).json(account);
  } catch (err) { next(err); }
});

router.get('/', createValidationMiddleware(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json(await accountService.listAccounts({ userId: req.user.id, cursor: req.query.cursor, limit: req.query.limit }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await accountService.getAccountById(req.params.id, { userId: req.user.id }));
  } catch (err) { next(err); }
});

router.get('/:id/balance', createValidationMiddleware(asOfQuerySchema, 'query'), async (req, res, next) => {
  try {
    const balance = await accountService.getBalance(req.params.id, req.query.asOf, { userId: req.user.id });
    res.json({ accountId: req.params.id, balance });
  } catch (err) { next(err); }
});

router.get('/:id/audit', createValidationMiddleware(auditQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json(await auditService.getAuditTrail(req.params.id, { userId: req.user.id, cursor: req.query.cursor, limit: req.query.limit }));
  } catch (err) { next(err); }
});

module.exports = router;