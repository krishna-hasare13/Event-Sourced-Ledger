const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { createValidationMiddleware } = require('../middleware/validate');
const { z } = require('zod');

const authSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8)
});

router.post('/register', createValidationMiddleware(authSchema), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', createValidationMiddleware(authSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;