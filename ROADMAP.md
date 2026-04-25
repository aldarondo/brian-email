# brian-email Roadmap
> Tag key: `[Code]` = Claude Code · `[Cowork]` = Claude Cowork · `[Human]` = Charles must act

## 🔄 In Progress
<!-- nothing active -->

## 🔲 Backlog

### Known Gaps (not blocking)
- [ ] `[Human]` Add integration tests (full MCP server against real Gmail API) — requires Gmail OAuth credentials with live API access; set up test Gmail account with App Password or OAuth tokens, then Claude Code can write the integration tests

## ✅ Completed

- [x] 2026-04-25 — Add `POST /api/send-email` REST endpoint for direct callers (e.g. Python coordinators) that bypass the MCP SSE handshake; supports plain-text and HTML; 8 new unit tests (55 total)
- [x] 2026-04-25 — Add docker-compose log rotation: `json-file` driver, 10 MB / 5 files
- [x] 2026-04-25 — Deployed and live-tested: `send_email` with plain-text, HTML, and non-ASCII characters verified against charles.aldarondo@gmail.com
- [x] 2026-04-25 — Fix non-ASCII encoding (em-dash, curly quotes, etc.): set `encoding:'quoted-printable'` explicitly in nodemailer; add HTML pass-through to REST endpoint; root cause was Windows shell mangling UTF-8 in curl — production HTTP clients unaffected
- [x] 2026-04-24 — Upgrade Dockerfile base image: `node:20-alpine` → `node:22-alpine` (LTS). build.yml already pushes to GHCR; this ensures the built image uses the current LTS base. 47 tests pass.
- [x] 2026-04-23 — Refactored `authorize.js` to export testable functions (`createAuthClient`, `generateAuthUrl`, `exchangeCode`, `runInteractiveFlow`) with execution guard; 11 new unit tests covering auth URL generation, code exchange, and interactive flow mocking (47 total)
- [x] 2026-04-19 — Scaffolded: MCP server (send_email, test_connection), nodemailer wrapper, unit tests, Dockerfile, docker-compose
- [x] 2026-04-19 — Add `list_drafts` tool — Gmail API OAuth (read-only scope); `src/gmail-api.js` + `src/authorize.js` interactive token flow
- [x] 2026-04-19 — Add rate limiting (max N emails/hour) via `EMAIL_RATE_LIMIT_PER_HOUR` env var (default 20)
- [x] 2026-04-19 — Deployed to Synology NAS (port 8768, SSE)
- [x] 2026-04-20 — Add GHCR build-push workflow — `.github/workflows/build.yml`; builds on push to main + weekly Sunday 08:00 UTC; deploys to NAS via cloudflared tunnel
- [x] 2026-04-20 — Add log rotation — `src/logger.js`; rotates at `LOG_MAX_SIZE_MB`, keeps `LOG_MAX_FILES` copies
- [x] 2026-04-22 — Security: upgrade nodemailer 6.9.0 → 8.0.5 (SMTP injection + DoS CVEs)
- [x] 2026-04-22 — Security: add API key auth (`MCP_API_KEY`) to SSE server via `src/middleware.js`; `Authorization: Bearer` required on `/sse` and `/messages`
- [x] 2026-04-22 — Wire auth in brian-telegram: added `brian-email` entry to `config/mcp.json` with `Authorization` header; added `BRIAN_EMAIL_API_KEY` to brian-telegram `.env`
- [x] 2026-04-22 — Fix silent draft-fetch errors — gmail-api.js now logs failed individual draft fetches
- [x] 2026-04-22 — Fix `list_drafts` limit — clamp to 1–100; reject negative/extreme values
- [x] 2026-04-22 — Fix error logging — tool errors now include full stack trace
- [x] 2026-04-22 — Fix rate limit env var read at call time (was frozen at startup)
- [x] 2026-04-22 — Add 36 unit tests across 5 suites: tool handlers, rate limiting, API key middleware, gmail-api, logger
- [x] 2026-04-22 — Add email address format validation on `to` field
- [x] 2026-04-22 — Add 10 MB body size limit on `send_email`
- [x] 2026-04-22 — Add rate limiting to `list_drafts` (60/hour via `DRAFTS_RATE_LIMIT_PER_HOUR`)
- [x] 2026-04-22 — Add startup env validation (`src/validate-env.js`) — fails fast if `GMAIL_USER`/`GMAIL_APP_PASSWORD` missing
- [x] 2026-04-22 — QA report written to `QA_REPORT.md`

## 🚫 Blocked
<!-- none -->
