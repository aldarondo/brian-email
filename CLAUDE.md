# brian-email

## Project Purpose
MCP server deployed on Synology NAS via Docker. Sends outbound email from a dedicated Brian Gmail account. Exposes a `send_email` tool callable by Claude skills.

## Key Commands
```bash
npm install          # install dependencies
npm start            # run locally (stdio mode)
npm test             # run unit tests
docker compose up -d # deploy via Docker
docker compose logs -f
```

## Setup
1. Enable 2FA on the Brian Gmail account
2. Create an App Password at https://myaccount.google.com/apppasswords
3. Copy `.env.example` to `.env`, fill in `GMAIL_USER` and `GMAIL_APP_PASSWORD`
4. Run `npm start` and call `test_connection` to verify

## Testing Requirements
- Unit tests in `tests/unit/` using Jest with `jest.unstable_mockModule` for nodemailer
- Run before marking any task complete: `npm test`

## After Every Completed Task
- Move task to ✅ Completed in ROADMAP.md with today's date
- Update README.md if interface changed

## Git Rules
- Never create pull requests. Push directly to main.
- solo/auto-push OK

@~/Documents/GitHub/CLAUDE.md
