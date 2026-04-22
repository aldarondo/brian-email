/**
 * Gmail API client (OAuth2) — used for reading drafts.
 * Separate from the SMTP/nodemailer setup used for sending.
 *
 * Required env vars:
 *   GMAIL_OAUTH_CLIENT_ID
 *   GMAIL_OAUTH_CLIENT_SECRET
 *   GMAIL_OAUTH_REFRESH_TOKEN  (obtained via src/authorize.js)
 */

import { google } from 'googleapis';

function getOAuthClient() {
  const clientId     = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Gmail OAuth not configured. Set GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, ' +
      'and GMAIL_OAUTH_REFRESH_TOKEN. Run node src/authorize.js to get the refresh token.'
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

/**
 * List Gmail drafts for the authenticated user.
 * @param {object} opts
 * @param {number} [opts.limit=10] - max number of drafts to return
 * @param {string} [opts.query]    - Gmail search query (e.g. "subject:invoice")
 * @returns {Promise<Array<{id, subject, to, date, snippet}>>}
 */
export async function listDrafts({ limit = 10, query = '' } = {}) {
  const auth  = getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const listParams = { userId: 'me', maxResults: limit };
  if (query) listParams.q = query;

  const { data: listData } = await gmail.users.drafts.list(listParams);
  const drafts = listData.drafts ?? [];

  if (!drafts.length) return [];

  // Fetch metadata for each draft in parallel
  const results = await Promise.all(
    drafts.map(async (d) => {
      try {
        const { data } = await gmail.users.drafts.get({
          userId: 'me',
          id: d.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'To', 'Date'],
        });

        const headers = data.message?.payload?.headers ?? [];
        const header  = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

        return {
          id:       d.id,
          subject:  header('Subject') || '(no subject)',
          to:       header('To')      || '(no recipient)',
          date:     header('Date')    || '',
          snippet:  data.message?.snippet ?? '',
        };
      } catch (err) {
        console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', message: 'draft_fetch_failed', id: d.id, error: err.message }));
        return { id: d.id, subject: '(error reading draft)', to: '', date: '', snippet: '' };
      }
    })
  );

  return results;
}
