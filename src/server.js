/**
 * brian-email MCP server factory.
 * Call createServer() to get a configured Server instance without a transport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { sendEmail, verifyConnection } from './mailer.js';
import { listDrafts } from './gmail-api.js';
import { log } from './logger.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

const sendTimestamps = [];
const draftTimestamps = [];

function checkRateLimit(timestamps, envVar, defaultLimit, label) {
  const limit = parseInt(process.env[envVar] || String(defaultLimit), 10);
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recent = timestamps.filter(ts => ts > cutoff);
  timestamps.length = 0;
  timestamps.push(...recent);
  if (recent.length >= limit) {
    throw new Error(`Rate limit exceeded: max ${limit} ${label}/hour`);
  }
  timestamps.push(Date.now());
}

function validateEmailAddresses(to) {
  const addresses = Array.isArray(to) ? to : [to];
  for (const addr of addresses) {
    if (!EMAIL_RE.test(addr)) throw new Error(`Invalid email address: ${addr}`);
  }
}

export function createServer() {
  const server = new Server(
    { name: 'brian-email', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'send_email',
        description: 'Send an email from the Brian Gmail account.',
        inputSchema: {
          type: 'object',
          properties: {
            to: {
              oneOf: [
                { type: 'string', description: 'Single recipient email address' },
                { type: 'array', items: { type: 'string' }, description: 'Multiple recipients' },
              ],
            },
            subject: { type: 'string', description: 'Email subject line' },
            body: { type: 'string', description: 'Plain-text email body' },
            html: { type: 'string', description: 'Optional HTML body (used instead of plain text in rich clients)' },
          },
          required: ['to', 'subject', 'body'],
        },
      },
      {
        name: 'test_connection',
        description: 'Verify Gmail SMTP credentials are working without sending a message.',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'list_drafts',
        description:
          'List Gmail drafts from the Brian Gmail account via the Gmail API. ' +
          'Requires GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, and GMAIL_OAUTH_REFRESH_TOKEN. ' +
          'Run node src/authorize.js once to set up OAuth.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max number of drafts to return (default: 10)' },
            query: { type: 'string', description: 'Gmail search query to filter drafts (e.g. "subject:invoice")' },
          },
          required: [],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log('info', 'tool_call', { tool: name, to: args?.to, subject: args?.subject });
    try {
      switch (name) {
        case 'send_email': {
          const { to, subject, body, html } = args;
          if (!to) throw new Error('"to" is required');
          if (!subject) throw new Error('"subject" is required');
          if (!body) throw new Error('"body" is required');
          validateEmailAddresses(to);
          if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
            throw new Error('Email body exceeds 10 MB limit');
          }
          checkRateLimit(sendTimestamps, 'EMAIL_RATE_LIMIT_PER_HOUR', 20, 'emails');
          const result = await sendEmail({ to, subject, text: body, html });
          log('info', 'email_sent', { to, subject, messageId: result.messageId });
          return {
            content: [{ type: 'text', text: `✅ Email sent — messageId: ${result.messageId}` }],
          };
        }

        case 'test_connection': {
          await verifyConnection();
          return {
            content: [{ type: 'text', text: `✅ Gmail SMTP connection verified (${process.env.GMAIL_USER})` }],
          };
        }

        case 'list_drafts': {
          checkRateLimit(draftTimestamps, 'DRAFTS_RATE_LIMIT_PER_HOUR', 60, 'draft listings');
          const rawLimit = args?.limit ?? 10;
          const limit = Math.min(Math.max(Math.trunc(Number(rawLimit)), 1), 100);
          const query = args?.query ?? '';
          const drafts = await listDrafts({ limit, query });
          if (!drafts.length) {
            return { content: [{ type: 'text', text: 'No drafts found.' }] };
          }
          const lines = drafts.map((d, i) =>
            `${i + 1}. [${d.id}] "${d.subject}" → ${d.to} (${d.date})\n   ${d.snippet}`
          );
          return {
            content: [{ type: 'text', text: `${drafts.length} draft(s):\n\n${lines.join('\n\n')}` }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err) {
      log('error', 'tool_error', { tool: name, error: err.message, stack: err.stack });
      return {
        content: [{ type: 'text', text: `❌ Error: ${err.message}` }],
        isError: true,
      };
    }
  });

  return server;
}
