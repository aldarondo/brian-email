import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

// Mock dependencies before importing server
const mockSendEmail = jest.fn();
const mockVerifyConnection = jest.fn();
const mockListDrafts = jest.fn();
const mockLog = jest.fn();

jest.unstable_mockModule('../../src/mailer.js', async () => ({
  sendEmail: mockSendEmail,
  verifyConnection: mockVerifyConnection,
}));

jest.unstable_mockModule('../../src/gmail-api.js', async () => ({
  listDrafts: mockListDrafts,
}));

jest.unstable_mockModule('../../src/logger.js', async () => ({
  log: mockLog,
}));

const { createServer } = await import('../../src/server.js');

async function makeClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GMAIL_USER = 'brian@example.com';
  // Reset rate limit state between tests by clearing the module-level array
  // (the array is shared across calls within a module instance)
});

describe('send_email tool', () => {
  test('sends email and returns messageId', async () => {
    mockSendEmail.mockResolvedValue({ messageId: 'msg-001' });
    const client = await makeClient();

    const result = await client.callTool({ name: 'send_email', arguments: { to: 'a@b.com', subject: 'Hi', body: 'Hello' } });

    expect(mockSendEmail).toHaveBeenCalledWith({ to: 'a@b.com', subject: 'Hi', text: 'Hello', html: undefined });
    expect(result.content[0].text).toContain('msg-001');
    expect(result.isError).toBeFalsy();
  });

  test('returns error when "to" is missing', async () => {
    const client = await makeClient();
    const result = await client.callTool({ name: 'send_email', arguments: { subject: 'Hi', body: 'Hello' } });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('"to" is required');
  });

  test('returns error when "subject" is missing', async () => {
    const client = await makeClient();
    const result = await client.callTool({ name: 'send_email', arguments: { to: 'a@b.com', body: 'Hello' } });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('"subject" is required');
  });

  test('returns error when "body" is missing', async () => {
    const client = await makeClient();
    const result = await client.callTool({ name: 'send_email', arguments: { to: 'a@b.com', subject: 'Hi' } });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('"body" is required');
  });

  test('propagates sendEmail errors', async () => {
    mockSendEmail.mockRejectedValue(new Error('SMTP failure'));
    const client = await makeClient();
    const result = await client.callTool({ name: 'send_email', arguments: { to: 'a@b.com', subject: 'Hi', body: 'Hello' } });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('SMTP failure');
  });
});

describe('test_connection tool', () => {
  test('returns success message when SMTP connects', async () => {
    mockVerifyConnection.mockResolvedValue({ ok: true });
    const client = await makeClient();
    const result = await client.callTool({ name: 'test_connection', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('verified');
  });

  test('returns error when SMTP fails', async () => {
    mockVerifyConnection.mockRejectedValue(new Error('auth error'));
    const client = await makeClient();
    const result = await client.callTool({ name: 'test_connection', arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('auth error');
  });
});

describe('list_drafts tool', () => {
  test('returns formatted draft list', async () => {
    mockListDrafts.mockResolvedValue([
      { id: 'd1', subject: 'Invoice', to: 'x@y.com', date: '2026-01-01', snippet: 'Please find...' },
    ]);
    const client = await makeClient();
    const result = await client.callTool({ name: 'list_drafts', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Invoice');
  });

  test('returns "No drafts found" when list is empty', async () => {
    mockListDrafts.mockResolvedValue([]);
    const client = await makeClient();
    const result = await client.callTool({ name: 'list_drafts', arguments: {} });
    expect(result.content[0].text).toBe('No drafts found.');
  });

  test('clamps limit to 1–100', async () => {
    mockListDrafts.mockResolvedValue([]);
    const client = await makeClient();

    await client.callTool({ name: 'list_drafts', arguments: { limit: -5 } });
    expect(mockListDrafts).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 1 }));

    await client.callTool({ name: 'list_drafts', arguments: { limit: 999 } });
    expect(mockListDrafts).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100 }));
  });
});

describe('unknown tool', () => {
  test('returns error for unrecognised tool name', async () => {
    const client = await makeClient();
    const result = await client.callTool({ name: 'nonexistent_tool', arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });
});

describe('rate limiting', () => {
  test('enforces EMAIL_RATE_LIMIT_PER_HOUR', async () => {
    // Set limit to 1 so a single prior send in this test exhausts it.
    // sendTimestamps is module-level and may already have entries from
    // earlier tests, so we set the limit high enough to accommodate those
    // but low enough that one more push triggers the error.
    mockSendEmail.mockResolvedValue({ messageId: 'x' });

    // Drain the current timestamps by setting limit to 0 is not possible,
    // so instead: set limit to a value we know will be exceeded on next call.
    // We make (limit + 1) calls in this test with limit set to 1.
    process.env.EMAIL_RATE_LIMIT_PER_HOUR = '1';

    const server = createServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(ct);

    const args = { to: 'a@b.com', subject: 'Hi', body: 'Hello' };

    // Keep sending until we hit the rate limit (handles any pre-existing timestamps)
    let hitLimit = false;
    for (let i = 0; i < 25; i++) {
      const r = await client.callTool({ name: 'send_email', arguments: args });
      if (r.isError && r.content[0].text.includes('Rate limit exceeded')) {
        hitLimit = true;
        break;
      }
    }

    expect(hitLimit).toBe(true);
    delete process.env.EMAIL_RATE_LIMIT_PER_HOUR;
  });
});
