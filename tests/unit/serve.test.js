import { describe, test, expect } from '@jest/globals';

// middleware.js reads MCP_API_KEY at import time. Jest ESM caches modules, so
// we test with whatever key was set when the module first loaded. We set it here
// before the import so the module sees the test key.
process.env.MCP_API_KEY = 'test-secret-key';
const { requireApiKey } = await import('../../src/middleware.js');

function makeReqRes(authHeader) {
  const req = { headers: authHeader ? { authorization: authHeader } : {} };
  const res = {
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    _status: null,
    _body: null,
  };
  return { req, res };
}

describe('requireApiKey middleware', () => {
  test('allows request with correct Bearer token', () => {
    const { req, res } = makeReqRes('Bearer test-secret-key');
    let called = false;
    requireApiKey(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(res._status).toBeNull();
  });

  test('rejects request with wrong token', () => {
    const { req, res } = makeReqRes('Bearer wrong-key');
    let called = false;
    requireApiKey(req, res, () => { called = true; });
    expect(called).toBe(false);
    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Unauthorized' });
  });

  test('rejects request with no Authorization header', () => {
    const { req, res } = makeReqRes(null);
    let called = false;
    requireApiKey(req, res, () => { called = true; });
    expect(called).toBe(false);
    expect(res._status).toBe(401);
  });

  test('rejects request with malformed Authorization header (no Bearer prefix)', () => {
    const { req, res } = makeReqRes('test-secret-key');
    let called = false;
    requireApiKey(req, res, () => { called = true; });
    expect(called).toBe(false);
    expect(res._status).toBe(401);
  });
});
