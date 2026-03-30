# TrendPulse Environment Troubleshooter

If the system validator fails, try these steps:

## 1. Backend UNREACHABLE
Symptoms: `ERR_CONNECTION_REFUSED` in Chrome or [FAIL] in validator.
- **Fix**: Open a terminal in `backend/` and run `npx wrangler dev`.
- **Verify**: Open `http://localhost:8787/health` in your browser.

## 2. Trends List EMPTY
Symptoms: "Loading trends..." never disappears or "No trends available" shows.
- **Fix**: Ensure the database is initialized.
- **Run**: `npx wrangler d1 execute trendpulse-db --local --file=schema.sql` (inside `backend/`).
- **Trigger Poll**: You can manually trigger a poll by hitting the `scheduled` function if using wrangler, or wait for the cron.

## 3. Icons MISSING
Symptoms: [FAIL] in validator for icon files.
- **Fix**: Run `resize_icons.ps1` in the root directory.
