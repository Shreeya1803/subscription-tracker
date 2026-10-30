# Subscription Tracker

A privacy-first mobile app that helps people see **everything they pay for in one place**, get **reminders before renewals**, and spot **forgotten or unused subscriptions**. There is no bank connection and no inbox scanning: users add subscriptions themselves and stay in control of their data.

Built for **Kolhsys**. Android is distributed through Google Play (package `com.kolhsys.subscriptiontracker`); iOS is planned.

| Folder | What it is | Tech |
|---|---|---|
| [`frontend/`](frontend) | Mobile app (Android and iOS from one codebase) | Expo SDK 57, React Native 0.86, expo-router, TypeScript |
| [`supabase/`](supabase) | Backend: database, security rules, server functions, scheduled jobs | Supabase (Postgres, Auth, Edge Functions, pg_cron) |
| [`backend/`](backend) | **Retired.** The original NestJS API, kept for reference only. Not deployed. | NestJS, Prisma |

---

## Architecture

The app talks to Supabase directly. There is no separate server to host.

```
┌───────────────────────┐   Supabase client (HTTPS)   ┌──────────────────────────────────────────┐
│  Expo app             │ ──────────────────────────▶ │  Supabase                                │
│  Android (+ iOS)      │                             │  Auth: email + 6-digit email codes       │
│  session in Keystore/ │                             │  Postgres: tables + Row Level Security   │
│  Keychain             │                             │  Database functions (dashboard, cancel…) │
│  RevenueCat SDK       │                             │  Edge Functions (webhook, billing sync,  │
└──────────┬────────────┘                             │    delete account, expiry check)         │
           │ purchases                                │  pg_cron: daily reminders, hourly check  │
           ▼                                          └──────▲───────────────────┬───────────────┘
┌───────────────────────┐        webhook                     │                   │ SMTP
│  Google Play Billing  │ ──▶  RevenueCat  ──────────────────┘                   ▼
│  (App Store later)    │                                                     Resend
└───────────────────────┘                                          (no-reply@updates.kolhsys.com)
```

| Service | Used for | Plan |
|---|---|---|
| **Supabase** | Database, sign-in, security rules, server functions, scheduled jobs | Free |
| **Resend** | Sign-up and password-reset code emails, from `updates.kolhsys.com` | Free (3,000/month, 100/day) |
| **RevenueCat** | In-app purchases and subscription status for Google Play (and later App Store) | Free up to US$2,500 monthly revenue |
| **Expo EAS** | Android builds and signing (organization `kolhsys`) | Free |
| **Google Play** | Distribution (internal testing today) | n/a |

---

## Features

**For users**
- Sign up with email and password, confirmed with a **6-digit code** sent by email; reset a forgotten password the same way
- Add, edit, delete and cancel subscriptions (weekly, monthly, quarterly, yearly or custom billing cycles)
- Dashboard with normalized **monthly and annual spend**, upcoming renewals (next 30 days) and **money saved** from canceled subscriptions
- Categories, search, filter and sort
- Per-subscription renewal reminders (choose how many days before)
- **Export your data** as a PDF report or JSON, and **delete your account** with all its data
- Read-only offline access to the last loaded data

**Plans**
- **Free:** up to **3 active subscriptions** (enforced by the database)
- **Premium:** unlimited subscriptions, plus spend trends and unused-subscription insights
- Sold through Google Play via RevenueCat, entitlement `subscription_tracker_pro`:

| Plan | Google Play product | AUD | INR |
|---|---|---|---|
| Monthly | `subscript_monthly:monthly` | 2.99 | 99 |
| Annual | `subscript_annual:annual` | 22.99 | 699 |
| Lifetime | `subscript_lifetime` (non-consumable) | 44.99 | 1,499 |

---

## Project layout

```
subscription-tracker/
├── frontend/
│   ├── app/                     # screens (expo-router): (auth), (tabs), add, upgrade, subscription/[id]
│   ├── components/  context/  hooks/  constants/  assets/
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client (session in secure storage)
│   │   ├── api.ts               # data layer used by the screens
│   │   ├── purchases.ts         # RevenueCat
│   │   └── exportPdf.ts  mappers.ts  plan.ts
│   └── eas.json                 # build profiles (production env vars live here)
├── supabase/
│   ├── migrations/              # the whole database, in order (schema, auth, RLS, functions, jobs, grants)
│   ├── functions/               # Edge Functions (Deno)
│   │   ├── _shared/             # billing logic + helpers shared by the functions
│   │   ├── revenuecat-webhook/  billing-sync/  billing-expiry/  delete-account/
│   │   └── deno.json
│   ├── templates/               # email templates (confirm sign-up, reset password)
│   ├── tests/                   # smoke tests against a real project
│   └── config.toml
└── backend/                     # retired NestJS API (reference only)
```

---

## How the backend works

### Database and security
All tables are in `public`, and **every table has Row Level Security**. Users can only read and change their own rows; logged-out requests see nothing.

| Table | Contents | App access |
|---|---|---|
| `users` | Profile and plan, one row per Supabase Auth user (created automatically at sign-up) | Read own row; edit only name, currency, push token. Plan columns are written only by the server. |
| `subscriptions` | The tracked subscriptions | Full control of own rows, except `status`, `last_used_date` and reminder bookkeeping (changed through functions) |
| `saved_events` | Money saved when a subscription is canceled | Read own |
| `payment_events` | Log of RevenueCat purchase events | Read own |
| `households`, `memberships` | Shared households (V2, no screens yet) | Members read; owner manages |

Validation rules from the original API live in the database as constraints (name length, positive amount, 3-letter currency, custom cycle days, reminder days 0–365).
The **free limit** is a trigger: adding a 4th active subscription on the free plan fails with SQLSTATE `PT403`, which the API returns as **HTTP 403**, and the app opens the upgrade screen.

### Database functions (called with `supabase.rpc`)
| Function | Purpose |
|---|---|
| `cancel_subscription(id)` | Marks canceled and records the money saved (409 if already canceled) |
| `mark_subscription_used(id)` | Sets last used to today |
| `dashboard_summary()` | Monthly and annual totals, upcoming renewals, money saved |
| `dashboard_trends(months)` | Premium only (403 for free): 6-month spend history and category breakdown |
| `dashboard_unused(days)` | Premium only: active subscriptions not used for 30+ days |
| `export_my_data()` | Everything stored about the user, without credentials |
| `invite_household_member`, `household_detail` | Households (V2) |

### Edge Functions
| Function | Called by | Auth |
|---|---|---|
| `revenuecat-webhook` | RevenueCat on every purchase event | `Authorization` header = `REVENUECAT_WEBHOOK_AUTH` (deployed with `--no-verify-jwt`) |
| `billing-sync` | The app right after a purchase or restore | User session |
| `delete-account` | Settings > Delete account (also deletes the RevenueCat customer) | User session |
| `billing-expiry` | pg_cron, hourly | `x-cron-secret` header = `CRON_SECRET` (deployed with `--no-verify-jwt`) |

Billing rules: every RevenueCat event is recorded once; purchases and renewals grant Premium until the expiry date; a normal cancellation keeps access until expiry; a refund (`CUSTOMER_SUPPORT`) or expiration removes it; a lifetime purchase is never downgraded by subscription events.

### Scheduled jobs (pg_cron, UTC)
| Job | When | What |
|---|---|---|
| `subscription-reminders` | Daily 03:30 UTC (09:00 IST) | Rolls past renewal dates forward and sends due renewal reminders as Expo push notifications |
| `billing-expiry-check` | Hourly at :05 | Calls `billing-expiry`, the safety net for missed expiration webhooks |

---

## Setting up a Supabase project

Use a separate **development** project for testing; the production project is the client's **Subscript Tracker** (Kolhsys organization). Keep all secrets outside the repo (for example `D:\secrets\`).

### 1. Prerequisites
- **Node.js 22** and npm
- Supabase CLI through npx: `npx supabase --version`
- Windows with Norton or another TLS-inspecting antivirus: set `NODE_USE_SYSTEM_CA=1` (once: `setx NODE_USE_SYSTEM_CA 1`)

### 2. Link and apply the database
```bash
npx supabase login
npx supabase link --project-ref <project-ref>
cat supabase/.temp/project-ref        # ALWAYS check which project you are linked to
npx supabase db push --linked
```
Never run `db reset` against a hosted project.

### 3. Auth settings (dashboard)
- **Authentication > Sign In / Providers > Email:** Confirm email **on**, Secure email change **on**, minimum password length **8**, Email OTP length **6**, expiration **3600**
- **Authentication > Emails > SMTP:** host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API key, sender `no-reply@updates.kolhsys.com`, name `Subscription Tracker`
- **Authentication > Emails > Templates:** paste `supabase/templates/confirm-signup.html` (subject *Confirm your Subscription Tracker email*) and `supabase/templates/reset-password.html` (subject *Reset your Subscription Tracker password*). Both use `{{ .Token }}` for the code.
- **Authentication > Rate Limits:** emails per hour about 30 (Resend's free plan allows 100 per day in total)

### 4. Edge Function secrets
Create an env file **outside the repo** with real values (no quotes):
```
REVENUECAT_WEBHOOK_AUTH=<random 64-hex value, also entered in RevenueCat>
REVENUECAT_SECRET_KEY=<RevenueCat secret API key, sk_...>
REVENUECAT_ENTITLEMENT_ID=subscription_tracker_pro
CRON_SECRET=<random 64-hex value, also stored in Vault>
```
Generate random values with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
```bash
npx supabase secrets set --env-file <path-to-env-file>
npx supabase functions deploy --use-api
npx supabase functions deploy revenuecat-webhook --no-verify-jwt --use-api
npx supabase functions deploy billing-expiry --no-verify-jwt --use-api
```

### 5. Vault secrets for the scheduler (SQL Editor)
```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<same value as CRON_SECRET>', 'cron_secret');
```
Check: `select private.invoke_billing_expiry();`, wait a few seconds, then `select status_code, content from net._http_response order by id desc limit 1;` should return `200 {"checked":0}`.

### 6. RevenueCat
**Integrations > Webhooks:** URL `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`, Authorization header value = `REVENUECAT_WEBHOOK_AUTH`, both environments, all events. **Send test event** should log "RevenueCat test webhook received".

### 7. Smoke tests
```bash
cd supabase
npm install
export SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_ANON_KEY=<publishable key>
node tests/auth-smoke.mjs you@example.com                  # sign-up + reset with emailed codes
node tests/data-smoke.mjs <free-test-user> <password>      # validation, free limit, RLS
node tests/functions-smoke.mjs <free-test-user> <password> # dashboard, cancel, export
```
(PowerShell: `$env:SUPABASE_URL="..."`.) Create the free test user under **Authentication > Users > Add user** with *Auto Confirm User*.

---

## Running the app

```bash
cd frontend
cp .env.example .env     # then fill it in
npm install
npx expo start -c
```
Press `a` for an Android emulator, or scan the QR code with Expo Go.

**`frontend/.env`** (local development only, git-ignored)

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<dev-project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project's publishable key (`sb_publishable_...`), safe to ship in the app |
| `EXPO_PUBLIC_REVENUECAT_TEST_KEY` | RevenueCat Test Store key (`test_...`). Used **only** in development; release builds ignore it |

Never put a secret or `service_role` key in an `EXPO_PUBLIC_` variable: those are bundled into the app.

---

## Releasing (Android)

Production values (Supabase URL, publishable key, RevenueCat Google key) are in `frontend/eas.json` under `build.production.env`. The version code is managed by EAS and increases automatically.

```bash
cd frontend
eas build --platform android --profile production
```
Upload the `.aab` in **Play Console > Subscript-Tracker > Test and release > Internal testing > Create new release**. License testers are under **Play Console > Manage account > Play apps settings > License testing**.

The upload signing key is held by EAS (`eas credentials`); keep an offline backup of the keystore outside the repo.

---

## Operations

- **Which project am I on?** `supabase/.temp/project-ref` shows the linked project. Check it before every `db push`, `secrets set` or `functions deploy`.
- **Logs:** Supabase dashboard > Edge Functions > *function* > Logs; scheduled jobs: `select * from cron.job_run_details order by start_time desc limit 20;`
- **Free plan:** Supabase pauses a free project after a week with no activity, and has no automatic backups. Take regular backups and keep the project active (see Project status).
- **Rotating secrets:** generate a new value, update the env file, `npx supabase secrets set --env-file ...`; for `CRON_SECRET` also update the Vault secret, for `REVENUECAT_WEBHOOK_AUTH` also update RevenueCat.

---

## Project status

**Live in internal testing (Android, version 5):** email-code sign-up and password reset, subscriptions, dashboard, free limit, Google Play purchases with RevenueCat (monthly, annual, lifetime; restore), data export (PDF and JSON), account deletion, offline cache, scheduled renewal roll-forward.

**Next**
- Push notifications: the app does not register a push token yet, so reminders are not delivered (the server side is ready)
- Play production launch: privacy policy in Play Console, closed test with 12 testers for 14 days
- Keep-alive and backup routine for the Supabase free plan
- Household sharing screens (database and functions exist)
- iOS / App Store (awaiting the client's decision)

---

## License

Private project for Kolhsys. All rights reserved.
