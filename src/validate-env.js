export function validateEnv() {
  const missing = [];
  if (!process.env.GMAIL_USER)         missing.push('GMAIL_USER');
  if (!process.env.GMAIL_APP_PASSWORD) missing.push('GMAIL_APP_PASSWORD');
  if (missing.length > 0) {
    console.error(`[ERROR] Missing required env vars: ${missing.join(', ')}. Check .env and restart.`);
    process.exit(1);
  }
}
