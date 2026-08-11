const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
}

describe('auth middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('attaches the decoded user for a valid bearer token', () => {
    jwt.verify.mockReturnValue({ sub: 'user-1', email: 'alice@example.com' });
    const req = { get: () => 'Bearer token-1' };
    const res = createRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.user).toEqual({ id: 'user-1', email: 'alice@example.com' });
    expect(next).toHaveBeenCalledWith();
    expect(res.statusCode).toBe(200);
  });

  test('rejects missing tokens', () => {
    const req = { get: () => '' };
    const res = createRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });
});