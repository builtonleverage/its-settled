# It's Settled

Ad-free expense splitting for people who live together. Rent, maid, cook, maintenance, groceries: add them in two taps and see who owes whom.

One Cloudflare Worker on the free tier. No ads, no accounts, no app store.

## What it does

- **Join with an invite code.** Flatmates open your WhatsApp invite, type their name, and the admin approves them in the app or with one tap in Telegram. No passwords: each phone keeps a private login, and anyone can get a login link for another device.
- **Simplify payments (on by default).** If A owes B and B owes C, A pays C directly. Same totals, fewer payments. The admin can switch to direct debts at any time.
- **Guests.** Friends staying over get a link that works instantly. They see only the entries they're part of, settle directly with whoever they shared with, and lose access on the date you pick (they can still see what's left to settle).
- **Monthly bills.** Set rent, maid or cook once; they're added on their day every month and split between flatmates (never guests).
- **Instant and offline.** The app opens from the phone's cache with no spinner. Entries added offline queue up and sync when the connection is back, and can never be duplicated.
- **Telegram bot (optional).** Type `450 milk` to add an expense, `/bal` to see balances, `/undo` to take it back.
- **Import from Tricount.** Upload the CSV export, match names, done. Exact per-person splits and dates are kept; importing the same file twice adds nothing. People who haven't joined yet claim their history when they're approved.
- **Backups.** A nightly copy to a Google Sheet only you can open, in-app download and restore, plus Cloudflare D1's 30-day point-in-time recovery.
- **Demo.** `/demo` runs a sample flat entirely in the browser, including the guest view.

## Deploy (about 10 minutes, needs a laptop)

```bash
git clone https://github.com/builtonleverage/its-settled && cd its-settled
npm install
npx wrangler login                     # free Cloudflare account
npx wrangler d1 create its-settled     # paste the database_id it prints into wrangler.toml
npx wrangler deploy                    # prints your URL, e.g. https://its-settled.<you>.workers.dev
```

Open the URL, choose **Start a flat**, and share the invite on WhatsApp. To bring history from Tricount: **Flat → Import CSV**.

## Make it yours

Everything a fork usually changes is in `wrangler.toml` under `[vars]`, with no code changes:

| Setting | Default | What it changes |
| --- | --- | --- |
| `APP_NAME` | It's Settled | Name in the app, tab title, bot messages |
| `CURRENCY` | INR | Any ISO 4217 code (USD, EUR, GBP…) |
| `LOCALE` | en-IN | Number and date formatting |
| `TIMEZONE` | Asia/Kolkata | Which day it is for monthly bills |
| `BOT_USERNAME` | (empty) | Your Telegram bot, without the @ |

Also set the daily run time in `[triggers] crons` (UTC). Colors and fonts are CSS variables at the top of `src/app.html`.

## Telegram bot (optional, 3 minutes)

1. In Telegram, message **@BotFather**, send `/newbot`, and copy the token.
2. Put the bot's username in `wrangler.toml` as `BOT_USERNAME`.
3. Set two secrets and deploy:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN        # the BotFather token
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # any long random string
   npx wrangler deploy
   ```
4. Open `https://<your-url>/api/setup-telegram?key=<that random string>` once. You should see `"ok":true`.
5. In the app, everyone taps **Flat → Connect Telegram** once.

## Google Sheet backup (optional, 5 minutes)

Only you can open the sheet; nobody else signs in to Google.

1. Create a Google Sheet. Open **Extensions → Apps Script** and paste in `backup/Code.gs`. Set `SECRET` to a long random string.
2. **Deploy → New deployment → Web app.** Execute as: *Me*. Who has access: *Anyone*. Copy the `/exec` URL.
   The script refuses any request without your secret, so the URL alone is useless to anyone else.
3. Add both to the Worker:
   ```bash
   npx wrangler secret put BACKUP_URL       # the /exec URL
   npx wrangler secret put BACKUP_SECRET    # the same secret as in Code.gs
   ```
4. In the app: **Flat → Backup → Back up now.** A readable tab appears in the sheet, and JSON copies (the last 60) go to a private Drive folder.

Backups run after the response or on the nightly schedule, so the app never waits on Google.

**Restoring:** Flat → Backup → Restore… from a file or the latest Sheet copy. Your current data downloads first, so a restore can be undone. Restoring into a brand-new flat matches people by name and brings the rest back as "not joined yet".

**Last resort:** `npx wrangler d1 time-travel restore its-settled --timestamp=<ISO time>` rolls the database back to any minute in the last 30 days.

## Free-tier fit

Workers allow 100,000 requests a day, and D1 gives 5 GB with 5 million reads a day. A flat uses a tiny fraction of either. Imports and restores run as single bulk queries, so they stay inside the free plan's per-request query limit even with thousands of entries.

## Develop

```bash
npm run dev            # http://localhost:8787 with a local SQLite database
npm test               # money math and CSV parsing (no server needed)
npm run test:api       # API, guest, Telegram and backup suites against `npm run dev` (see CLAUDE.md for .dev.vars)
npm run build:demo     # dist/demo.html: the whole app in demo mode as one file
```

How the code is organized, the rules it relies on, and how to add features safely: [CLAUDE.md](CLAUDE.md).

## Not in this version

Uneven splits from the add form (imports keep them), removing a flatmate who has history, and a WhatsApp bot. WhatsApp's Cloud API needs Meta business verification, so the bot lives on Telegram; invites still go out on WhatsApp.

## License

MIT. See [LICENSE](LICENSE).
