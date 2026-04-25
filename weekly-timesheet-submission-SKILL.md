---
name: weekly-timesheet-submission
description: Every Friday: log into Bullhorn and submit 40-hour timesheet for the week
---

You are automating a weekly timesheet submission for Charles Aldarondo. Every Friday, log into the Bullhorn staffing portal, submit 40 hours (8h/day Mon–Fri) for the current week, then send a confirmation email via the brian-email MCP.

## Credentials
- Bullhorn URL: https://optomi.bbo.bullhornstaffing.com/Login/
- Username: charles.aldarondo@gmail.com
- Password: %1h#JaEl

---

## PART 1 — Submit the timesheet

1. Call tabs_context_mcp (createIfEmpty: true) to get a tab ID.

2. Navigate to https://optomi.bbo.bullhornstaffing.com/Login/

3. Log in:
   - Set the Username field (textbox type="text") to: charles.aldarondo@gmail.com
   - Set the Password field (textbox type="password") to: %1h#JaEl
   - Click the submit button (input type="image")

4. Wait for the employee dashboard to load (URL contains /employee/).

5. Check the current Timesheet Status shown on the page:
   - "Submitted" → already done; note week dates and skip to PART 2.
   - "In Progress" → skip to step 8.
   - "Not Created" → continue to step 6.

6. The current week should be highlighted in blue on the calendar. If not, click a date within the current Mon–Fri week.

7. Select the "40 Hours Worked Timesheet" radio button, then click "Create".

8. Verify: Status = "In Progress", Total Hours = 40:00, Mon–Fri each 8:00.

9. Click "Submit Timesheet".

10. A confirmation dialog appears — click "Accept".

11. Verify Timesheet Status = "Submitted". Note the time period (e.g. "03/23/2026 – 03/27/2026").

---

## PART 2 — Send confirmation email via brian-email MCP

Use the brian-email MCP `send_email` tool. Do NOT use Google Workspace MCP or Claude in Chrome for this step.

The brian-email MCP is a custom MCP server running at http://192.168.0.64:8768 (SSE endpoint: /sse). It exposes a `send_email` tool with these parameters:
- **to** (string or array): recipient email address(es)
- **subject** (string): email subject line
- **body** (string): plain-text email body

1. Call `send_email` (brian-email MCP) with:
   - **to:** charles.aldarondo@gmail.com
   - **subject** (success): `✅ Timesheet Submitted – [week date range]`
   - **subject** (failure): `❌ Timesheet Submission Failed – [today's date]`
   - **body** (success): "Your Bullhorn timesheet for [Mon date] – [Fri date] was automatically submitted with 40 hours (8h/day, Mon–Fri). Submitted at [time]. No action needed."
   - **body** (failure): "Automatic timesheet submission failed. Please log in and submit manually: https://optomi.bbo.bullhornstaffing.com/Login/ — Error details: [describe what went wrong]"

---

## Success criteria
- Bullhorn Timesheet Status = "Submitted"
- Confirmation email sent to charles.aldarondo@gmail.com via brian-email MCP
