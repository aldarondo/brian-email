#!/usr/bin/env node
/**
 * One-time OAuth2 authorization flow to get a Gmail API refresh token.
 * Run: node src/authorize.js
 * Then copy GMAIL_OAUTH_REFRESH_TOKEN into .env.
 *
 * Prerequisites:
 *   1. Create a Google Cloud project at console.cloud.google.com
 *   2. Enable the Gmail API
 *   3. Create an OAuth2 credential (Desktop app type)
 *   4. Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in .env
 */

import { google } from 'googleapis';
import readline from 'readline';

// Load .env if present
try {
  const { readFileSync } = await import('fs');
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch { /* .env not present */ }

const clientId     = process.env.GMAIL_OAUTH_CLIENT_ID;
const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Error: Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in .env first.');
  process.exit(1);
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const auth   = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');

const authUrl = auth.generateAuthUrl({ access_type: 'offline', scope: SCOPES });

console.log('\n1. Open this URL in a browser and authorize the app:');
console.log('   ' + authUrl);
console.log('\n2. After authorizing, Google will show you a code. Paste it here:');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('   Code: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await auth.getToken(code.trim());
    console.log('\n✅ Authorization successful!\n');
    console.log('Add this to your .env file:');
    console.log(`GMAIL_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nAlso ensure .env contains:');
    console.log('GMAIL_OAUTH_CLIENT_ID=...');
    console.log('GMAIL_OAUTH_CLIENT_SECRET=...');
  } catch (err) {
    console.error('Failed to exchange code:', err.message);
    process.exit(1);
  }
});
