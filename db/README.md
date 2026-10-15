# Database (Supabase)

Project: **japan-vb-tracker** (`avfpoaipqkqxzuaqjutv`, Tokyo / `ap-northeast-1`)  
Dashboard: https://supabase.com/dashboard/project/avfpoaipqkqxzuaqjutv

The live GitHub Pages site still reads `data/*.json`. This Postgres DB is the seed mirror for a future API cutover.

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | Reference DDL (applied in Supabase as migration `init_japan_vb_tracker_schema`; `country_code` columns later widened to `text` for codes like `asia`) |
| `seed.py` | Reads `../data/*.json`, writes idempotent `INSERT … ON CONFLICT` batches under `sql/` |
| `sql/*.sql` | Generated batches (re-run `python3 db/seed.py` to regenerate) |

## Re-seed

```bash
python3 db/seed.py
# Then apply each numbered sql/*.sql via Supabase SQL editor or MCP execute_sql
# Order: leagues → teams → players → player_stats / matches → match_* → gossip_* → social → site_meta
```

Do not use `COPY FROM` file paths; load from the client / generated SQL only.
