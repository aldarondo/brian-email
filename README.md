# brian-email

MCP server that sends outbound email via a dedicated Gmail account. Deployed on the Synology NAS and consumed by the Brian Telegram bot.

## Features
- `send_email` — send an email to one or more recipients (subject, plain text, optional HTML)
- `test_connection` — verify SMTP credentials without sending a message
- `list_drafts` — list Gmail drafts via OAuth2 (requires separate OAuth setup)
- Rate limiting via `EMAIL_RATE_LIMIT_PER_HOUR` (default: 20)

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (Alpine) |
| Transport | MCP SSE (`src/serve.js`) on port 8768 |
| Email | nodemailer + Gmail SMTP (App Password) |
| Draft listing | Gmail API (OAuth2, optional) |
| Container | Docker via GHCR (`ghcr.io/aldarondo/brian-email:latest`) |
| CI/CD | GitHub Actions → GHCR → NAS deploy via cloudflared tunnel |

## Getting Started

### Prerequisites
- 2FA enabled on the Gmail account
- Gmail App Password created at https://myaccount.google.com/apppasswords

```bash
npm install
cp .env.example .env
# Fill in GMAIL_USER and GMAIL_APP_PASSWORD in .env
npm start          # stdio mode (for direct MCP use)
npm run serve      # SSE mode on port 8768 (for NAS deployment)
npm test           # run unit tests
```

### Docker (NAS)
```bash
docker compose up -d
docker compose logs -f
```

The container pulls `ghcr.io/aldarondo/brian-email:latest` and runs the SSE server. The `.env` file must exist in the same directory on the NAS with credentials filled in.

## MCP Integration

The server is registered in `brian-telegram/config/mcp.json` as `"email"`:

```json
{
  "email": {
    "type": "sse",
    "url": "http://172.18.0.1:8768/sse"
  }
}
```

### Available Tools

**`send_email`**
```json
{
  "to": "recipient@example.com",
  "subject": "Hello",
  "text": "Plain text body",
  "html": "<p>Optional HTML body</p>"
}
```

**`test_connection`** — no arguments, returns `✅ Connected` or an error.

**`list_drafts`** — no arguments, requires OAuth2 env vars set (see `.env.example`).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GMAIL_USER` | Yes | Gmail address to send from |
| `GMAIL_APP_PASSWORD` | Yes | Gmail App Password (not your account password) |
| `GMAIL_FROM_NAME` | No | Display name in From header (default: `Brian`) |
| `PORT` | No | SSE server port (default: `8768`) |
| `EMAIL_RATE_LIMIT_PER_HOUR` | No | Max emails per hour (default: `20`) |
| `LOG_FILE` | No | Path to log file inside container (default: none; set to `/logs/brian-email.log` in docker-compose) |
| `LOG_MAX_SIZE_MB` | No | Max log file size before rotation in MB (default: `10`) |
| `LOG_MAX_FILES` | No | Number of rotated log files to keep (default: `5`) |
| `GMAIL_OAUTH_CLIENT_ID` | No | OAuth2 client ID (for `list_drafts` only) |
| `GMAIL_OAUTH_CLIENT_SECRET` | No | OAuth2 client secret (for `list_drafts` only) |
| `GMAIL_OAUTH_REFRESH_TOKEN` | No | OAuth2 refresh token (for `list_drafts` only) |

## Logging

Each tool call, successful send, and error is logged as a JSON line to both stderr and (when `LOG_FILE` is set) a file on the host.

In the Docker deployment, logs are written to `./logs/brian-email.log` on the NAS via a bind mount. The file rotates when it reaches `LOG_MAX_SIZE_MB` and up to `LOG_MAX_FILES` rotated copies are kept (e.g. `brian-email.log.1` … `brian-email.log.5`), capping total disk usage at ~60 MB with defaults.

```bash
# Tail logs on the NAS
tail -f logs/brian-email.log | jq .
```

## OAuth2 Setup (list_drafts only)

1. Create OAuth2 Desktop credentials at https://console.cloud.google.com → APIs & Services → Credentials
2. Download the JSON and set `GMAIL_OAUTH_CLIENT_ID` and `GMAIL_OAUTH_CLIENT_SECRET` in `.env`
3. Run `node src/authorize.js` and follow the browser prompt to get a refresh token
4. Add the refresh token to `.env` as `GMAIL_OAUTH_REFRESH_TOKEN`

## CI/CD

Every push to `main` that touches `Dockerfile`, `src/`, or `package*.json` triggers a GitHub Actions build that:
1. Builds and pushes the image to GHCR
2. SSHs to the NAS via cloudflared tunnel and runs `docker compose pull && up -d`

A weekly rebuild runs Sundays at 08:00 UTC to pick up base-image security patches.

---
**Publisher:** Xity Software, LLC
