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

const RATE_LIMIT = parseInt(process.env.EMAIL_RATE_LIMIT_PER_HOUR || '20', 10);
const sendTimestamps = [];

function checkRateLimit() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recent = sendTimestamps.filter(ts => ts > cutoff);
  sendTimestamps.length = 0;
  sendTimestamps.push(...recent);
  if (recent.length >= RATE_LIMIT) {
    throw new Error(`Rate limit exceeded: max ${RATE_LIMIT} emails/hour`);
  }
  sendTimestamps.push(Date.now());
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
    try {
      switch (name) {
        case 'send_email': {
          const { to, subject, body, html } = args;
          if (!to) throw new Error('"to" is required');
          if (!subject) throw new Error('"subject" is required');
          if (!body) throw new Error('"body" is required');
          checkRateLimit();
          const result = await sendEmail({ to, subject, text: body, html });
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
          const limit = args?.limit ?? 10;
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
      return {
        content: [{ type: 'text', text: `❌ Error: ${err.message}` }],
        isError: true,
      };
    }
  });

  return server;
}
