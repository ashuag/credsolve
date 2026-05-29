# Geography bulk import (cities + pincodes)

## Current schema

| Table | Purpose |
|-------|---------|
| `state` | 36 Indian states/UTs (seeded via `state.seed.ts`) |
| `city` | ~168 cities today via `city.seed.ts` — **too small** |
| `negative_pincode` | Serviceability blocklist — **not** the pincode master |
| `pincode` | **New** — 6-digit code → `city_id` |

CSV exports use a **different** `state_id` numbering (1 = Jammu & Kashmir). The import script maps by **state name**, not CSV id.

City row order in `generic_city_*.csv` matches `pincode_city_id` (1 = first city row, 650 = NEW DELHI).

## Why not `npm run seed`?

`city.seed.ts` upserts one city per Prisma call (~1k+ calls). Pincodes would be ~20k more. Use **bulk SQL** instead (~seconds in prod).

## Prod steps

1. Deploy migration:

```bash
cd backend
npm run prisma:migrate:deploy
npm run prisma:generate
```

2. Generate SQL from your CSV folder:

```bash
node scripts/import-geography-bulk.mjs \
  --csv-dir "/home/saurabha/Documents/city data" \
  --sql-only
```

3. Apply on production DB (adjust connection):

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  < prisma/data/geography/generated/import_geography.sql
```

Or pipe from CI with secrets. Typical runtime: **under 30 seconds**.

4. Optional — run from app host if `mysql` client + `DATABASE_URL` exist:

```bash
node scripts/import-geography-bulk.mjs \
  --csv-dir "/path/to/city data" \
  --execute
```

## After import

- Existing `city` rows are uppercased (`NEW DELHI` vs `New Delhi`) for consistent lookup.
- New cities get `source_city_id` (1..1032) for traceability.
- `pincode.code` is unique; duplicate rows in the CSV keep the first mapping.

## Re-run / idempotent

SQL uses `INSERT ... ON DUPLICATE KEY UPDATE` on `(name, state_id)` and `pincode.code`. Safe to re-run after fixing CSVs.

## Local dev

Same as prod. You can remove `seedCity` from the main seed (already skipped) and rely on this import once per environment.
