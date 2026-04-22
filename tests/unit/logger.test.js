import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

// logger.js reads env vars and calls fs at import time (mkdirSync).
// We test it by setting LOG_FILE before import and using a real temp dir.

const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
const logFile = path.join(tmpDir, 'test.log');

process.env.LOG_FILE         = logFile;
process.env.LOG_MAX_SIZE_MB  = '0';   // rotate immediately after first write
process.env.LOG_MAX_FILES    = '3';

const { log } = await import('../../src/logger.js');

afterEach(() => {
  // Clean up all rotated files between tests
  for (let i = 0; i <= 5; i++) {
    const f = i === 0 ? logFile : `${logFile}.${i}`;
    try { fs.unlinkSync(f); } catch { /* ok */ }
  }
});

describe('log()', () => {
  test('writes a JSON line to the log file', () => {
    log('info', 'test_event', { foo: 'bar' });
    const content = fs.readFileSync(logFile, 'utf8').trim();
    const entry = JSON.parse(content);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('test_event');
    expect(entry.foo).toBe('bar');
    expect(entry.ts).toBeDefined();
  });

  test('includes ts, level, message, and extra fields', () => {
    log('error', 'something_broke', { tool: 'send_email', error: 'SMTP fail' });
    const line = fs.readFileSync(logFile, 'utf8').trim();
    const entry = JSON.parse(line);
    expect(entry.tool).toBe('send_email');
    expect(entry.error).toBe('SMTP fail');
  });

  test('rotates when file exceeds LOG_MAX_SIZE_MB', () => {
    // First write creates the file (size will exceed 0 MB threshold)
    log('info', 'first');
    // Second write triggers rotation
    log('info', 'second');

    // After rotation, .1 should exist (the previous log file was renamed)
    expect(fs.existsSync(`${logFile}.1`)).toBe(true);
    // Current log file should have only the second entry
    const current = fs.readFileSync(logFile, 'utf8').trim();
    expect(JSON.parse(current).message).toBe('second');
  });

  test('does not keep more than LOG_MAX_FILES rotated files', () => {
    // Write enough times to fill all rotation slots.
    // With maxFiles=3, the loop runs for i=2 and i=1, so it manages
    // slots .1 and .2 (the oldest managed slot is maxFiles-1 = 2).
    for (let i = 0; i < 6; i++) log('info', `entry-${i}`);

    expect(fs.existsSync(`${logFile}.1`)).toBe(true);
    expect(fs.existsSync(`${logFile}.2`)).toBe(true);
    expect(fs.existsSync(`${logFile}.3`)).toBe(false);
  });
});
