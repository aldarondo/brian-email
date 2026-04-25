/**
 * brian-email MCP Server — HTTP/SSE entry point.
 * Listens on PORT (default 8768) for SSE connections from brian-telegram.
 */

import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from './server.js';
import { requireApiKey } from './middleware.js';
import { validateEnv } from './validate-env.js';

validateEnv();

const PORT = parseInt(process.env.PORT || '8768', 10);

const app = express();
const transports = new Map();

// Simple REST endpoint — bypasses the MCP SSE handshake for direct callers
// (e.g. the coordinator's Python email_mcp.py, which has a protocol mismatch with the JS SSE SDK).
app.post('/api/send-email', express.json(), requireApiKey, async (req, res) => {
  const { to, subject, body } = req.body ?? {};
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
  }
  try {
    const { sendEmail } = await import('./mailer.js');
    const result = await sendEmail({ to, subject, text: body });
    return res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error('[REST /api/send-email] failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/sse', requireApiKey, async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);
  res.on('close', () => transports.delete(transport.sessionId));
  const server = createServer();
  await server.connect(transport);
});

app.post('/messages', express.json(), requireApiKey, async (req, res) => {
  const transport = transports.get(req.query.sessionId);
  if (!transport) return res.status(404).json({ error: 'Session not found' });
  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => console.error(`[MCP SSE] brian-email listening on port ${PORT}`));
