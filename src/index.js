#!/usr/bin/env node
/**
 * brian-email MCP Server — stdio entry point.
 * Sends outbound email via Gmail SMTP (app password auth).
 *
 * Env vars required:
 *   GMAIL_USER         - Gmail address to send from
 *   GMAIL_APP_PASSWORD - Gmail app password (2FA must be enabled)
 *   GMAIL_FROM_NAME    - Optional display name (default: "Brian")
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('brian-email MCP server running');
