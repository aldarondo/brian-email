/**
 * Tests for the POST /api/send-email REST endpoint in serve.js.
 * We test the handler logic directly by mocking express internals
 * rather than spinning up a full HTTP server.
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Set API key before middleware loads
process.env.MCP_API_KEY = 'test-key';

// Mock mailer and validate-env before serve.js is imported
const mockSendEmail = jest.fn();

jest.unstable_mockModule('../../src/mailer.js', async () => ({
  sendEmail: mockSendEmail,
  verifyConnection: jest.fn(),
}));

jest.unstable_mockModule('../../src/validate-env.js', async () => ({
  validateEnv: jest.fn(),
}));

// Mock the MCP server so serve.js doesn't require a transport
jest.unstable_mockModule('../../src/server.js', async () => ({
  createServer: jest.fn(() => ({ connect: jest.fn() })),
}));

// Mock SSEServerTransport
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/sse.js', async () => ({
  SSEServerTransport: jest.fn().mockImplementation(() => ({
    sessionId: 'test-session',
    handlePostMessage: jest.fn(),
  })),
}));

// Helper to build a minimal express-style req/res pair
function makeReqRes(body = {}) {
  const req = {
    body,
    headers: { authorization: 'Bearer test-key' },
    query: {},
  };
  const res = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  return { req, res };
}

// Extract the /api/send-email route handler from the express app
// We do this by intercepting app.post() calls during import.
let sendEmailHandler = null;

jest.unstable_mockModule('express', async () => {
  const jsonMiddleware = (_req, _res, next) => next();
  const app = {
    post(path, ...handlers) {
      if (path === '/api/send-email') {
        // handlers = [express.json(), requireApiKey, async handler]
        sendEmailHandler = handlers[handlers.length - 1];
      }
    },
    get: jest.fn(),
    listen: jest.fn(),
  };
  const express = jest.fn(() => app);
  express.json = jest.fn(() => jsonMiddleware);
  return { default: express };
});

// Trigger the module to register routes
await import('../../src/serve.js');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/send-email REST handler', () => {
  test('sends plain-text email and returns ok + messageId', async () => {
    mockSendEmail.mockResolvedValue({ messageId: 'msg-123' });
    const { req, res } = makeReqRes({ to: 'charles@example.com', subject: 'Hi', body: 'Hello' });

    await sendEmailHandler(req, res);

    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'charles@example.com',
      subject: 'Hi',
      text: 'Hello',
      html: undefined,
    });
    expect(res._body).toEqual({ ok: true, messageId: 'msg-123' });
  });

  test('passes html field through when provided', async () => {
    mockSendEmail.mockResolvedValue({ messageId: 'msg-html' });
    const { req, res } = makeReqRes({
      to: 'charles@example.com',
      subject: 'Rich email',
      body: 'Plain fallback',
      html: '<h1>Hello</h1><p>This is <strong>HTML</strong></p>',
    });

    await sendEmailHandler(req, res);

    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'charles@example.com',
      subject: 'Rich email',
      text: 'Plain fallback',
      html: '<h1>Hello</h1><p>This is <strong>HTML</strong></p>',
    });
    expect(res._body).toEqual({ ok: true, messageId: 'msg-html' });
  });

  test('returns 400 when "to" is missing', async () => {
    const { req, res } = makeReqRes({ subject: 'Hi', body: 'Hello' });
    await sendEmailHandler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toContain('Missing required fields');
  });

  test('returns 400 when "subject" is missing', async () => {
    const { req, res } = makeReqRes({ to: 'x@x.com', body: 'Hello' });
    await sendEmailHandler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toContain('Missing required fields');
  });

  test('returns 400 when "body" is missing', async () => {
    const { req, res } = makeReqRes({ to: 'x@x.com', subject: 'Hi' });
    await sendEmailHandler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toContain('Missing required fields');
  });

  test('returns 500 when sendEmail throws', async () => {
    mockSendEmail.mockRejectedValue(new Error('SMTP down'));
    const { req, res } = makeReqRes({ to: 'x@x.com', subject: 'Hi', body: 'Hello' });
    await sendEmailHandler(req, res);
    expect(res._status).toBe(500);
    expect(res._body.error).toBe('SMTP down');
  });

  test('handles missing body gracefully (null body)', async () => {
    const req = { body: null, headers: { authorization: 'Bearer test-key' }, query: {} };
    const res = {
      _status: 200, _body: null,
      status(c) { this._status = c; return this; },
      json(b) { this._body = b; return this; },
    };
    await sendEmailHandler(req, res);
    expect(res._status).toBe(400);
  });
});
