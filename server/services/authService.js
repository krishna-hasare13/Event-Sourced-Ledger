const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');

const SALT_ROUNDS = 10;

function getPrismaClient(options = {}) {
  return options.prismaClient || prisma;
}

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }
  return email.trim().toLowerCase();
}

function requirePassword(password) {
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  return password;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET || 'dev-only-secret',
    { expiresIn: '24h' }
  );
}

async function register({ email, password }, options = {}) {
  const db = getPrismaClient(options);
  const normalizedEmail = normalizeEmail(email);
  const rawPassword = requirePassword(password);
  const hashedPassword = await bcrypt.hash(rawPassword, SALT_ROUNDS);

  try {
    const user = await db.user.create({
      data: { email: normalizedEmail, hashedPassword }
    });

    return {
      user: { id: user.id, email: user.email },
      token: signToken(user)
    };
  } catch (err) {
    if (err.code === 'P2002') {
      throw new Error('Email already registered');
    }
    throw err;
  }
}

async function login({ email, password }, options = {}) {
  const db = getPrismaClient(options);
  const normalizedEmail = normalizeEmail(email);
  const rawPassword = requirePassword(password);

  const user = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const matches = await bcrypt.compare(rawPassword, user.hashedPassword);
  if (!matches) {
    throw new Error('Invalid email or password');
  }

  return {
    user: { id: user.id, email: user.email },
    token: signToken(user)
  };
}

module.exports = { register, login, signToken };