function amountToCents(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error('Amount must be a finite number');
  }

  const cents = Math.round(value * 100);
  if (cents === 0) {
    throw new Error('Amount must be non-zero');
  }

  return cents;
}

function centsToAmount(cents) {
  if (!Number.isInteger(cents)) {
    throw new Error('Cents must be an integer');
  }
  return cents / 100;
}

function validateTransactionPayload({ description, entries }) {
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new Error('A transaction requires at least 2 entries');
  }

  const normalizedEntries = [];
  const seenAccounts = new Set();
  let hasPositive = false;
  let hasNegative = false;

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Each entry must be an object');
    }

    if (!entry.accountId || typeof entry.accountId !== 'string' || !entry.accountId.trim()) {
      throw new Error('Each entry needs a valid accountId');
    }

    const accountId = entry.accountId.trim();
    if (seenAccounts.has(accountId)) {
      throw new Error('Duplicate accountId in a single transaction is not allowed');
    }
    seenAccounts.add(accountId);

    const amount = entry.amount;
    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      throw new Error('Each entry needs a finite numeric amount');
    }

    if (amount === 0) {
      throw new Error('Each entry needs a non-zero amount');
    }

    if (amount > 0) hasPositive = true;
    if (amount < 0) hasNegative = true;

    normalizedEntries.push({ ...entry, accountId });
  }

  if (!hasPositive || !hasNegative) {
    throw new Error('Entries must contain both positive and negative amounts');
  }

  const totalCents = normalizedEntries.reduce((sum, entry) => sum + amountToCents(entry.amount), 0);
  if (totalCents !== 0) {
    throw new Error('Entries must sum to zero');
  }

  return {
    description: typeof description === 'string' ? description.trim() : null,
    entries: normalizedEntries
  };
}

function parseAsOfDate(value) {
  if (!value) return null;

  const asOfDate = new Date(value);
  if (Number.isNaN(asOfDate.getTime())) {
    throw new Error('asOf must be a valid date');
  }

  return asOfDate;
}

module.exports = {
  amountToCents,
  centsToAmount,
  validateTransactionPayload,
  parseAsOfDate
};
