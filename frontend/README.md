# Subscription Tracker – mobile app (Expo)

Replit UI wired to the NestJS backend. The backend is unchanged.

## Run
1. Start the API (`npm run start:dev` in subscription-tracker-api, port 3000).
2. `cp .env.example .env` and set `EXPO_PUBLIC_API_URL` (see comments inside).
3. `npm install`
4. `npx expo start` (press `a` for Android, `i` for iOS, or scan the QR code in Expo Go).

## Where things are
- `lib/api.ts`      – fetch client, secure token storage, automatic refresh, typed endpoints
- `lib/mappers.ts`  – API <-> UI mapping (sends only fields the backend whitelists)
- `context/AuthContext.tsx`         – login / signup / logout / delete account / session restore
- `context/SubscriptionContext.tsx` – subscriptions + dashboard summary from the API, offline cache
- `app/(auth)/`     – login, signup, forgot/reset password
