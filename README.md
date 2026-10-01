# Subscription Tracker

A privacy-first mobile app that helps people see **everything they pay for in one place**, get **reminders before renewals**, and spot **forgotten or unused subscriptions**. There is no bank connection and no inbox scanning: users add subscriptions manually and stay in control of their data.

This repository contains the full project:

| Folder | What it is | Tech |
|---|---|---|
| [`backend/`](backend) | REST API | NestJS, Prisma 7, PostgreSQL, JWT |
| [`frontend/`](frontend) | Mobile app (iOS and Android from one codebase) | Expo SDK 57, React Native, expo-router, TypeScript |

---

## Features

**For users**
- Sign up, sign in, change or reset password (JWT access and refresh tokens, stored in the device's secure storage)
- Add, edit, delete and cancel subscriptions (weekly, monthly, quarterly, yearly or custom billing cycles)
- Dashboard with normalized **monthly and annual spend**, upcoming renewals, and **money saved** from canceled subscriptions
- Categories, search, filter and sort
- Per-subscription renewal reminders (choose how many days before)
- **Export your data** as a PDF report or raw JSON, and **delete your account** (GDPR/CCPA-style controls)
- Read-only offline access to the last loaded data

**Plans**
- Free accounts can track up to **3 active subscriptions**
- Premium accounts unlock spend trends and unused-subscription insights (API endpoints are premium-only)

---

## Architecture

```
┌──────────────────────┐   HTTPS / REST (JSON)   ┌────────────────────────┐
│  Expo app            │ ──────────────────────▶ │  NestJS API            │
│  iOS + Android       │ ◀────────────────────── │  auth · subscriptions  │
│  secure token store  │                         │  dashboard · user      │
│  offline cache       │                         │  households · reminders│
└──────────────────────┘                         └───────────┬────────────┘
                                                             │ Prisma
                                                      ┌──────▼──────┐
                                                      │ PostgreSQL  │
                                                      └─────────────┘
```

**Project layout**

```
subscription-tracker/
├── backend/
│   ├── prisma/                 # schema.prisma + migrations
│   ├── src/
│   │   ├── auth/  user/  subscriptions/  dashboard/
│   │   └── household/  reminders/  notifications/  email/  prisma/
│   └── prisma7.config.ts
└── frontend/
    ├── app/                    # screens (expo-router): (auth), (tabs), add, subscription/[id]
    ├── components/  context/  hooks/  constants/  assets/
    └── lib/                    # api client, mappers, PDF export
```

---

## Getting started

### Prerequisites

- **Node.js** 22 LTS (20.19 or newer works) and npm
- **PostgreSQL**, either a local install or the built-in Prisma dev database shown below
- For the app: **Expo Go** on a phone, or an Android emulator / iOS simulator

### 1. Run the backend

```bash
cd backend
cp .env.example .env          # then edit .env (see "Environment variables")
npm install
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run start:dev
```

The API listens on **http://localhost:3000** (or the `PORT` you set). Routes have no global prefix.

> **No Postgres installed?** In a separate terminal run `npx prisma dev` inside `backend/`. It starts a local database and prints a `DATABASE_URL` and `SHADOW_DATABASE_URL` to paste into `.env`. The port can change between runs, so update `.env` if the API reports `ECONNREFUSED`.

### 2. Run the app

```bash
cd frontend
cp .env.example .env          # set EXPO_PUBLIC_API_URL (see below)
npm install
npx expo start
```

Then press `a` for an Android emulator, or scan the QR code with **Expo Go**.

`EXPO_PUBLIC_API_URL` must point at the **API (port 3000), not Expo (port 8081)**:

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| Android emulator | `http://10.0.2.2:3000` |
| iOS simulator (macOS) | `http://localhost:3000` |
| Physical phone, same Wi-Fi | `http://<your-computer-LAN-IP>:3000` (allow Node through the firewall) |
| Remote testers on another network | an `https://` tunnel or hosted API URL, with `npx expo start --tunnel` |

Expo reads `.env` only at startup. Restart with `npx expo start -c` after changing it.

---

## Environment variables

**`backend/.env`**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SHADOW_DATABASE_URL` | Scratch database used only by `prisma migrate dev` (not needed in production) |
| `JWT_ACCESS_SECRET` | Secret for access tokens (15 min lifetime). Use a long random value |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens (7 day lifetime, rotated on every refresh). Use a different random value |
| `PORT` | Optional. Defaults to `3000` |

**`frontend/.env`**

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the API. Values with the `EXPO_PUBLIC_` prefix are bundled into the app, so never put secrets here |

`.env` files are git-ignored. Only the `.env.example` templates are committed.

---

## API overview

All routes except sign up, sign in, refresh and the password-reset routes require `Authorization: Bearer <accessToken>`. Request bodies are validated with a strict whitelist: unknown fields return `400`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/signup` · `/auth/login` · `/auth/refresh` · `/auth/forgot-password` · `/auth/reset-password` · `/auth/change-password` |
| Subscriptions | `GET /subscriptions` (sort, filter, search) · `POST /subscriptions` · `GET/PATCH/DELETE /subscriptions/:id` · `POST /subscriptions/:id/cancel` · `POST /subscriptions/:id/mark-used` |
| Dashboard | `GET /dashboard/summary` · `GET /dashboard/trends` (premium) · `GET /dashboard/unused` (premium) |
| User and compliance | `GET /user/me` · `GET /user/export` · `DELETE /user` · `POST /user/push-token` |
| Households | `POST /households` · `GET /households` · `GET /households/:id` · `POST /households/:id/invite` |

Notes:
- Monetary amounts are returned as decimal **strings**; dates are ISO 8601.
- Creating a 4th active subscription on a free account returns `403`.

---

## Security and privacy

- Secrets live in `.env` files that are never committed
- Tokens are kept in the device's secure storage (Keychain / Keystore) and refreshed automatically
- Strict request validation on every endpoint; users can only access their own data
- Users can export or permanently delete all of their data from within the app

---

## Project status

**Working today:** authentication, subscription management, dashboard totals, categories and search, free-tier limit, data export (PDF and JSON), account deletion, offline cache.

**Not finished yet**
- In-app purchases and receipt validation (there is no endpoint that upgrades an account to premium yet)
- Real email delivery (password-reset emails are currently logged to the API console)
- Push notification delivery (the reminder scheduler runs, but notifications are logged to the console)
- Pause and resume for subscriptions
- Household sharing screens in the app (the API endpoints exist)
- Production hosting: managed PostgreSQL, an HTTPS API URL, fresh JWT secrets, and store builds (EAS and TestFlight / Play Console)

---

## Testing the app on iOS without a Mac

1. Run the API and expose it over HTTPS, for example `cloudflared tunnel --url http://localhost:3000`
2. Put that URL in `frontend/.env` as `EXPO_PUBLIC_API_URL`
3. Run `npx expo start --tunnel -c` and share the QR code
4. Testers install **Expo Go** from the App Store and scan it

For longer testing, host the API and distribute builds through **TestFlight** (requires an Apple Developer account).

---

## License

Private project. All rights reserved. Update this section if you choose a license.
