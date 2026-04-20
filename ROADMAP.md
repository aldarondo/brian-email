# brian-email Roadmap
> Tag key: `[Code]` = Claude Code · `[Cowork]` = Claude Cowork · `[Human]` = Charles must act

## 🔄 In Progress
<!-- nothing active -->

## 🔲 Backlog

### Deployment
- [ ] `[Human]` Enable 2FA on Brian Gmail account (required for App Passwords)
- [ ] `[Human]` Create Gmail App Password at https://myaccount.google.com/apppasswords
- [ ] `[Human]` Copy `.env.example` → `.env`, fill in credentials, run `npm start` + `test_connection`
- [x] `[Code]` 2026-04-19 — Deployed to Synology NAS (port 8768, SSE); container running — blocked on `[Human]` filling in Gmail credentials in `.env`
- [x] `[Code]` 2026-04-19 — Add `brian-email` to `config/mcp.json` in brian-telegram (port 8768, SSE); added `src/serve.js` + `src/server.js` factory

### Build & Infrastructure
- [ ] `[Code]` Add GHCR build-push workflow — migrate container from `node:20-alpine` to a versioned GHCR image (`ghcr.io/aldarondo/...`) with GitHub Actions auto-deploy
- [ ] `[Code]` Add weekly scheduled rebuild — GitHub Actions `schedule: cron` to repull and push a fresh image every week, picking up base-image security patches

### Enhancements
- [x] `[Code]` 2026-04-19 — Add `list_drafts` tool — Gmail API OAuth (read-only scope); `src/gmail-api.js` + `src/authorize.js` interactive token flow; requires `[Human]` to create Google OAuth2 Desktop credential and run `node src/authorize.js`
- [x] `[Code]` 2026-04-19 — Add rate limiting (max N emails/hour) via `EMAIL_RATE_LIMIT_PER_HOUR` env var (default 20)

## ✅ Completed
- [x] 2026-04-19 — Scaffolded: MCP server (send_email, test_connection), nodemailer wrapper, unit tests, Dockerfile, docker-compose

## 🚫 Blocked
<!-- log blockers here -->
