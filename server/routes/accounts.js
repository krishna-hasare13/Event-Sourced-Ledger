const express = require('express');
const router = express.Router();
const accountService = require('../services/accountService');
const auditService = require('../services/auditService');

router.post('/', async (req, res, next) => {
  try {
    const account = await accountService.createAccount(req.body);
    res.status(201).json(account);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await accountService.listAccounts());
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await accountService.getAccountById(req.params.id));
  } catch (err) { next(err); }
});

router.get('/:id/balance', async (req, res, next) => {
  try {
    const balance = await accountService.getBalance(req.params.id, req.query.asOf);
    res.json({ accountId: req.params.id, balance });
  } catch (err) { next(err); }
});

router.get('/:id/audit', async (req, res, next) => {
  try {
    res.json(await auditService.getAuditTrail(req.params.id));
  } catch (err) { next(err); }
});

module.exports = router;