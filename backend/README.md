# Backend Architecture

## Target shape

```text
backend/
├── prisma/                         # Prisma schema and database config
├── src/
│   ├── app/                        # Nest root module composition
│   │   └── app.module.ts
│   ├── common/                     # Shared constants and cross-module helpers
│   │   ├── constants/
│   │   └── prisma/
│   ├── config/                     # Bootstrap configuration (CORS, Swagger)
│   ├── database/
│   │   └── prisma/                 # Prisma client, module, and service
│   ├── modules/                    # Domain modules
│   │   ├── auth/
│   │   ├── bookings/
│   │   ├── dashboard/
│   │   ├── documents/
│   │   ├── invitations/
│   │   ├── partners/
│   │   ├── payments/
│   │   └── tours/
│   └── main.ts                     # Nest bootstrap entrypoint
├── .env
├── .env.example
├── Dockerfile
└── package.json
```

## Why this structure

- `app/` is only for root composition. It should not contain business logic.
- `config/` keeps bootstrap concerns out of `main.ts`.
- `database/prisma/` isolates persistence wiring from business modules.
- `modules/` is the real product surface. Each domain keeps its controller, service, module, and DTOs together.
- `common/` is reserved for small shared pieces that are genuinely cross-cutting, such as public Prisma selects and app constants.

## Rules for growth

- Put new product features under `src/modules/<domain>`.
- Create shared helpers in `common/` only after at least two modules need them.
- Keep DTOs inside the owning module.
- Do not let controllers talk to Prisma directly; persistence stays in services.
- When a Prisma relation includes `User`, return a public user select instead of the full Prisma model.

## Bugs fixed in this pass

- Authentication now validates passwords instead of accepting any email.
- Auth responses and related APIs no longer leak `passwordHash`.
- Dev login data is normalized from legacy `bestway` emails to `moneycash` emails.
- Missing staff passwords are backfilled in development using `DEFAULT_STAFF_PASSWORD`.
- Booking references now use the `MC-` prefix instead of the old `BW-`.

## Prisma workflow

- `npm run db:validate` validates the Prisma schema from the workspace root.
- `npm run db:check` validates the schema and regenerates the Prisma client.
- `npm run db:migrate` creates a new development migration.
- `npm run db:deploy` validates Prisma, generates the client, applies migrations when `prisma/migrations/` exists, and only falls back to `db push` when no migration files exist yet.
