import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// ── Mock googleapis before importing authorize ────────────────────────────────

const mockGetToken       = jest.fn();
const mockGenerateAuthUrl = jest.fn(() => 'https://accounts.google.com/o/oauth2/auth?mock=1');
const mockOAuth2         = jest.fn().mockImplementation(() => ({
  generateAuthUrl: mockGenerateAuthUrl,
  getToken: mockGetToken,
}));

jest.unstable_mockModule('googleapis', async () => ({
  google: {
    auth: { OAuth2: mockOAuth2 },
  },
}));

// ── Mock readline ─────────────────────────────────────────────────────────────

const mockQuestion = jest.fn();
const mockClose    = jest.fn();
const mockCreateInterface = jest.fn(() => ({
  question: mockQuestion,
  close: mockClose,
}));

jest.unstable_mockModule('readline', async () => ({
  default: { createInterface: mockCreateInterface },
  createInterface: mockCreateInterface,
}));

const {
  SCOPES,
  createAuthClient,
  generateAuthUrl,
  exchangeCode,
  runInteractiveFlow,
} = await import('../../src/authorize.js');

beforeEach(() => {
  jest.clearAllMocks();
  mockOAuth2.mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
  }));
});

// ── SCOPES ────────────────────────────────────────────────────────────────────

describe('SCOPES', () => {
  test('includes gmail.readonly', () => {
    expect(SCOPES).toContain('https://www.googleapis.com/auth/gmail.readonly');
  });
});

// ── createAuthClient ──────────────────────────────────────────────────────────

describe('createAuthClient', () => {
  test('creates OAuth2 with correct credentials', () => {
    createAuthClient('id-123', 'secret-456');
    expect(mockOAuth2).toHaveBeenCalledWith('id-123', 'secret-456', 'urn:ietf:wg:oauth:2.0:oob');
  });

  test('returns the OAuth2 instance', () => {
    const auth = createAuthClient('id', 'secret');
    expect(auth).toBeDefined();
    expect(typeof auth.generateAuthUrl).toBe('function');
  });
});

// ── generateAuthUrl ───────────────────────────────────────────────────────────

describe('generateAuthUrl', () => {
  test('calls generateAuthUrl with offline access and correct scopes', () => {
    const auth = createAuthClient('id', 'secret');
    generateAuthUrl(auth);
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
      access_type: 'offline',
      scope: SCOPES,
    });
  });

  test('returns the URL string from auth', () => {
    const auth = createAuthClient('id', 'secret');
    const url = generateAuthUrl(auth);
    expect(url).toBe('https://accounts.google.com/o/oauth2/auth?mock=1');
  });
});

// ── exchangeCode ──────────────────────────────────────────────────────────────

describe('exchangeCode', () => {
  test('calls getToken with trimmed code and returns tokens', async () => {
    mockGetToken.mockResolvedValue({
      tokens: { refresh_token: 'rtoken-abc', access_token: 'atoken-xyz' },
    });
    const auth = createAuthClient('id', 'secret');
    const tokens = await exchangeCode(auth, '  code-123  ');
    expect(mockGetToken).toHaveBeenCalledWith('code-123');
    expect(tokens.refresh_token).toBe('rtoken-abc');
  });

  test('throws when getToken rejects', async () => {
    mockGetToken.mockRejectedValue(new Error('invalid_grant'));
    const auth = createAuthClient('id', 'secret');
    await expect(exchangeCode(auth, 'bad-code')).rejects.toThrow('invalid_grant');
  });
});

// ── runInteractiveFlow ────────────────────────────────────────────────────────

describe('runInteractiveFlow', () => {
  test('creates readline interface with stdin/stdout', async () => {
    mockGetToken.mockResolvedValue({ tokens: { refresh_token: 'rt' } });
    // Make question call the callback immediately
    mockQuestion.mockImplementation((_prompt, cb) => cb('user-code'));

    await runInteractiveFlow('client-id', 'client-secret');

    expect(mockCreateInterface).toHaveBeenCalledWith({
      input: process.stdin,
      output: process.stdout,
    });
  });

  test('closes readline and resolves with tokens on success', async () => {
    const expectedTokens = { refresh_token: 'rt-success', access_token: 'at-success' };
    mockGetToken.mockResolvedValue({ tokens: expectedTokens });
    mockQuestion.mockImplementation((_prompt, cb) => cb('valid-code'));

    const tokens = await runInteractiveFlow('cid', 'csecret');

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual(expectedTokens);
  });

  test('closes readline and rejects when getToken fails', async () => {
    mockGetToken.mockRejectedValue(new Error('auth error'));
    mockQuestion.mockImplementation((_prompt, cb) => cb('bad'));

    await expect(runInteractiveFlow('cid', 'csecret')).rejects.toThrow('auth error');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('logs the auth URL to console', async () => {
    mockGetToken.mockResolvedValue({ tokens: { refresh_token: 'rt' } });
    mockQuestion.mockImplementation((_prompt, cb) => cb('code'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await runInteractiveFlow('cid', 'csecret');

    const logged = logSpy.mock.calls.flat().join(' ');
    expect(logged).toContain('accounts.google.com');
    logSpy.mockRestore();
  });
});
