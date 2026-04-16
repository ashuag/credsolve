# LOS Portal Architecture

## Current structure

```text
los/
├── app/                      # App Router routes
│   ├── dashboard/            # Dashboard page + scoped styles
│   ├── login/                # Login route + scoped styles
│   └── partners/             # Partner route + scoped styles
├── components/
│   ├── layout/               # LOS shell and navigation framework
│   └── ui/                   # Auth, forms, and reusable operator UI
├── lib/                      # API fetch helpers and pure utilities
├── public/images/            # Brand assets used by the portal
├── middleware.ts             # Route protection hook for the portal
├── next.config.ts
├── tsconfig.json
└── README.md
```

## Why this shape

- `app/` stays focused on routing and page assembly.
- `app/*/*.module.css` keeps route-specific styling local to the screen that owns it.
- `components/layout/` isolates portal chrome like the CRM shell.
- `components/ui/` groups reusable controls, auth guards, and shared form primitives.
- `lib/` remains for pure fetch and helper logic that should not depend on React.
- `public/images/` carries real brand assets so the portal uses the same MoneyCash logo as the customer app.

## Recommended growth path

Add these only when the LOS actually needs them:

- `components/sections/` for reusable dashboard sections or analytics blocks.
- `config/` for navigation metadata, site config, and role-based menu config.
- `types/` when dashboard and partner models are shared widely across pages.
- `services/` when backend integrations become richer than the current `lib/api.ts`.
- `store/` only if dashboard state truly needs client-side global state.

## Comment on the proposed `src/` architecture

The structure you shared is strong as a mature default. My recommendation for this repo is to adopt it incrementally:

- keep the portal root as the app root for now
- apply the useful boundaries first: `layout/`, `ui/`, `lib/`, `public/`, `config/`
- add `src/` later if the portal starts accumulating too many top-level folders

That gives you most of the architectural clarity without forcing a large filesystem migration too early.
