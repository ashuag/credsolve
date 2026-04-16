# Customer Portal Architecture

## Current structure

```text
customer/
├── app/                      # App Router routes
├── components/
│   ├── layout/               # Header and shared page chrome
│   └── ui/                   # Reusable panels and UI building blocks
├── lib/                      # API fetch helpers and pure utilities
├── public/
│   └── images/               # Static assets such as the MoneyCash logo
├── next.config.ts
├── tsconfig.json
└── README.md
```

## Why this shape

- `app/` owns route behavior and page composition.
- `components/layout/` keeps shell concerns out of route files.
- `components/ui/` keeps reusable building blocks separate from page sections.
- `public/images/` is the correct home for static brand assets.
- `globals.css` should stay small and only define app-wide tokens/reset.

## Recommended growth path

Add these only when they become real needs:

- `components/sections/` for shared landing-page sections reused across pages.
- `lib/utils.ts` and `lib/constants.ts` when helper reuse increases.
- `config/` for site metadata, navigation config, and SEO config.
- `services/` when API wrappers become more complex than the current `lib/api.ts`.
- `hooks/`, `store/`, and `types/` only when custom hooks, client state, or shared models start repeating.

## Comment on the proposed `src/` architecture

Your proposed structure is a good target for a larger Next.js app. The main thing I would change is this:

- do not create every folder on day one
- create `src/`, `services/`, `store/`, and `hooks/` when the codebase actually earns them

For this portal today, `customer/` itself is already the app boundary, so adding `src/` immediately would mostly add another nesting layer without solving a current problem.
