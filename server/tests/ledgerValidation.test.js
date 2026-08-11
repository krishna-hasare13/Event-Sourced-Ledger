const {
  amountToCents,
  centsToAmount,
  validateTransactionPayload,
  parseAsOfDate
} = require('../services/ledgerValidation');

describe('ledger validation helpers', () => {
  test('converts decimal amounts to cents without floating-point drift', () => {
    expect(amountToCents(10.2)).toBe(1020);
    expect(amountToCents(0.1 + 0.2)).toBe(30);
    expect(centsToAmount(1234)).toBe(12.34);
  });

  test('rejects invalid transaction structures', () => {
    expect(() => validateTransactionPayload({ entries: [{ accountId: 'a', amount: 10 }] })).toThrow(/at least 2 entries/i);
    expect(() => validateTransactionPayload({ entries: [{ accountId: 'a', amount: 10 }, { accountId: 'a', amount: -10 }] })).toThrow(/duplicate account/i);
    expect(() => validateTransactionPayload({ entries: [{ accountId: 'a', amount: 10 }, { accountId: 'b', amount: 5 }] })).toThrow(/must contain both positive and negative/i);
  });

  test('parses and validates as-of dates', () => {
    expect(parseAsOfDate('2026-07-29').toISOString()).toBe('2026-07-29T00:00:00.000Z');
    expect(() => parseAsOfDate('not-a-date')).toThrow(/valid/i);
  });
});
