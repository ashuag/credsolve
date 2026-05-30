# MoneyCash backend (data layer)

This package holds **Prisma** (schema, migrations, seeds, client factory), **shared TypeScript constants** under `src/common/constants/`, and a **NestJS** HTTP app under `src/`. Customer **Option A** auth lives under `src/modules/auth` (unified `send-otp` / `verify-otp`, repositories, use cases, DTOs). **OpenAPI** is served at `**/docs`** (global API prefix is `**/api`**).

```text
backend/
├── prisma/              # schema, migrations, seed.ts, prisma-client.ts
├── src/
│   ├── main.ts          # Nest bootstrap
│   ├── app.module.ts    # root module
│   ├── app.controller.ts / app.service.ts
│   ├── modules/auth/    # customer OTP + session (controllers, use-cases, repos)
│   ├── prisma/          # PrismaModule + PrismaService
│   └── common/constants # shared enums/strings for seeds
├── nest-cli.json
└── package.json
```

## Commands

- `npm run prisma:generate` — generate Prisma Client  
- `npm run prisma:migrate:dev` — create/apply migrations in development (add `-- --name your_migration_name`)  
- `npm run prisma:migrate:deploy` — apply existing migrations (CI / production)  
- `npm run seed` — compile seeds (`tsconfig.seed.json`: `prisma/` + `src/common/` only, not the Nest app) and run `prisma/seed.ts`  
- `npm run lint` — `tsc --noEmit` on `src/` + prisma TS  
- `npm run dev` — Prisma generate + Nest dev (`nest start --watch --builder tsc`)  
- `npm run nest -- …` — Nest CLI (e.g. `npm run nest -- g module users`)

### Inside Docker (`docker exec -it <backend-container> sh`)

Use **npm scripts** with Node 20+ (`engines` in package.json). Docker Compose uses Node 22.

```sh
cd /workspace/backend
npm run prisma:generate
npm run prisma:migrate:dev -- --name describe_your_change
npm run prisma:migrate:deploy
npm run seed
```

`DATABASE_URL` / `DIRECT_DATABASE_URL` in the container must point at the Compose DB host `**db**` (e.g. `mysql://moneyCash:moneyCash@db:3306/moneyCash`), not `localhost`.

If `npx prisma …` ever says it cannot find the executable, run `npm install` once in the container (named volume `backend_node_modules` may be empty on first run after dependency changes), then use the `npm run prisma:*` scripts again.

### “Table `otp_type` does not exist” (or API fails on first query)

The API process is connected to a database that **has no Prisma migrations applied**. Run `**npm run prisma:migrate:deploy`** against the same `**DATABASE_URL`** the Nest app uses (see commands above). Inside Docker Compose, the DB hostname must be `**db`**, not `localhost`, unless you intentionally point at a host DB on port **3310**.

The Nest app also checks for `**otp_type`** at startup and exits with a short explanation if migrations are missing.