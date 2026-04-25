import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock nodemailer so no real SMTP calls happen
const mockVerify = jest.fn();
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  verify: mockVerify,
  sendMail: mockSendMail,
}));

jest.unstable_mockModule('nodemailer', async () => ({
  default: { createTransport: mockCreateTransport },
}));

const { sendEmail, verifyConnection } = await import('../../src/mailer.js');

beforeEach(() => {
  mockCreateTransport.mockClear();
  mockVerify.mockReset();
  mockSendMail.mockReset();
  process.env.GMAIL_USER = 'test@gmail.com';
  process.env.GMAIL_APP_PASSWORD = 'test-app-password';
  process.env.GMAIL_FROM_NAME = 'TestBrian';
});

describe('sendEmail', () => {
  test('sends email with correct options', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-001' });

    const result = await sendEmail({ to: 'alice@example.com', subject: 'Hello', text: 'Hi there' });

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: '"TestBrian" <test@gmail.com>',
      to: 'alice@example.com',
      subject: 'Hello',
      text: 'Hi there',
    }));
    expect(result).toEqual({ messageId: 'msg-001' });
  });

  test('sets encoding to quoted-printable for correct non-ASCII handling', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-enc' });
    await sendEmail({ to: 'x@example.com', subject: 'Em—dash test', text: 'Hello — world' });
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      encoding: 'quoted-printable',
    }));
  });

  test('joins multiple recipients with comma', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-002' });

    await sendEmail({ to: ['a@example.com', 'b@example.com'], subject: 'Hi', text: 'Hey' });

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@example.com, b@example.com',
    }));
  });

  test('passes html body when provided', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-003' });

    await sendEmail({ to: 'x@example.com', subject: 'HTML', text: 'plain', html: '<b>bold</b>' });

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      html: '<b>bold</b>',
    }));
  });

  test('throws when GMAIL_USER is not set', async () => {
    delete process.env.GMAIL_USER;
    await expect(sendEmail({ to: 'x@x.com', subject: 's', text: 't' }))
      .rejects.toThrow('GMAIL_USER and GMAIL_APP_PASSWORD');
  });

  test('throws when GMAIL_APP_PASSWORD is not set', async () => {
    delete process.env.GMAIL_APP_PASSWORD;
    await expect(sendEmail({ to: 'x@x.com', subject: 's', text: 't' }))
      .rejects.toThrow('GMAIL_USER and GMAIL_APP_PASSWORD');
  });
});

describe('verifyConnection', () => {
  test('returns ok:true when verify succeeds', async () => {
    mockVerify.mockResolvedValue(true);
    const result = await verifyConnection();
    expect(result).toEqual({ ok: true });
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  test('throws when verify fails', async () => {
    mockVerify.mockRejectedValue(new Error('auth failed'));
    await expect(verifyConnection()).rejects.toThrow('auth failed');
  });
});
