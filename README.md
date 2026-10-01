# Subscription Tracker
- `backend/`  NestJS + Prisma + PostgreSQL API
- `frontend/` Expo (React Native) app

## Backend
cd backend; copy .env.example to .env and fill it in
npm install
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run start:dev

## App
cd frontend; copy .env.example to .env (set EXPO_PUBLIC_API_URL to the API address)
npm install
npx expo start
