# MoneyCash

## Directory layout

- `backend/`: NestJS 11 + Prisma 6 + MySQL
- `los/`: Next.js 15 LOS interface for MoneyCash staff
- `customer/`: Next.js 15 customer portal for login, payments, trips, invoices, and my account
- `docker-compose.yml`: the only shared runtime file so each app can be split later

## Frontend architecture

The `customer/` and `los/` portals now follow the same baseline shape:

```text
portal/
├── app/                  # App Router pages, layouts, routes
├── components/
│   ├── layout/           # Shell, header, navigation, page chrome
│   └── ui/               # Reusable UI blocks and interactive controls
├── lib/                  # Fetch helpers and pure utilities
├── public/               # Static assets
├── README.md             # Portal-specific architecture notes
├── next.config.ts
└── tsconfig.json
```

Recommended rule:

- Keep `globals.css` minimal: tokens, reset, and top-level background only.
- Put page-specific styling in CSS modules next to the page or component.
- Add `components/sections/` only when a section is reused across multiple routes.
- Add `hooks/`, `services/`, `store/`, `types/`, and `config/` only when the portal actually needs them.
- Use `src/` only when the portal has grown enough that one more top-level nesting layer improves clarity. For this repo, each portal directory already acts as the app root, so `src/` is optional rather than mandatory.

## Quick start

1. Copy:
   - `backend/.env.example` to `backend/.env`
   - `los/.env.example` to `los/.env`
   - `customer/.env.example` to `customer/.env`
2. Run `docker compose up --build`
3. Open:
   - LOS: `http://localhost:3010`
   - Customer: `http://localhost:3041`
   - API: `http://localhost:4001/api`
