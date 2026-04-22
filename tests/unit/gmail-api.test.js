import { describe, test, expect, jest, beforeEach } from '@jest/globals';

const mockDraftsList = jest.fn();
const mockDraftsGet  = jest.fn();

jest.unstable_mockModule('googleapis', async () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
    },
    gmail: jest.fn().mockReturnValue({
      users: {
        drafts: {
          list: mockDraftsList,
          get:  mockDraftsGet,
        },
      },
    }),
  },
}));

const { listDrafts } = await import('../../src/gmail-api.js');

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GMAIL_OAUTH_CLIENT_ID     = 'client-id';
  process.env.GMAIL_OAUTH_CLIENT_SECRET = 'client-secret';
  process.env.GMAIL_OAUTH_REFRESH_TOKEN = 'refresh-token';
});

describe('listDrafts', () => {
  test('returns empty array when no drafts exist', async () => {
    mockDraftsList.mockResolvedValue({ data: { drafts: [] } });
    const result = await listDrafts();
    expect(result).toEqual([]);
  });

  test('returns empty array when drafts key is absent', async () => {
    mockDraftsList.mockResolvedValue({ data: {} });
    const result = await listDrafts();
    expect(result).toEqual([]);
  });

  test('fetches metadata for each draft and maps fields', async () => {
    mockDraftsList.mockResolvedValue({ data: { drafts: [{ id: 'd1' }, { id: 'd2' }] } });
    mockDraftsGet
      .mockResolvedValueOnce({ data: { message: { snippet: 'Snip 1', payload: { headers: [
        { name: 'Subject', value: 'Invoice' },
        { name: 'To',      value: 'a@b.com' },
        { name: 'Date',    value: '2026-01-01' },
      ] } } } })
      .mockResolvedValueOnce({ data: { message: { snippet: 'Snip 2', payload: { headers: [
        { name: 'Subject', value: 'Follow-up' },
        { name: 'To',      value: 'c@d.com' },
        { name: 'Date',    value: '2026-01-02' },
      ] } } } });

    const result = await listDrafts({ limit: 10 });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'd1', subject: 'Invoice',    to: 'a@b.com', date: '2026-01-01', snippet: 'Snip 1' });
    expect(result[1]).toEqual({ id: 'd2', subject: 'Follow-up',  to: 'c@d.com', date: '2026-01-02', snippet: 'Snip 2' });
  });

  test('returns placeholder when individual draft fetch fails', async () => {
    mockDraftsList.mockResolvedValue({ data: { drafts: [{ id: 'bad' }] } });
    mockDraftsGet.mockRejectedValue(new Error('API error'));

    const result = await listDrafts();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'bad', subject: '(error reading draft)' });
  });

  test('uses "(no subject)" when Subject header is missing', async () => {
    mockDraftsList.mockResolvedValue({ data: { drafts: [{ id: 'd1' }] } });
    mockDraftsGet.mockResolvedValue({ data: { message: { snippet: '', payload: { headers: [] } } } });

    const [draft] = await listDrafts();
    expect(draft.subject).toBe('(no subject)');
    expect(draft.to).toBe('(no recipient)');
  });

  test('passes query param to Gmail API when provided', async () => {
    mockDraftsList.mockResolvedValue({ data: { drafts: [] } });
    await listDrafts({ query: 'subject:invoice' });
    expect(mockDraftsList).toHaveBeenCalledWith(expect.objectContaining({ q: 'subject:invoice' }));
  });

  test('throws when OAuth env vars are not set', async () => {
    delete process.env.GMAIL_OAUTH_CLIENT_ID;
    await expect(listDrafts()).rejects.toThrow('Gmail OAuth not configured');
  });
});
