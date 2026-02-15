# FYP Internal Implementation Notes (Dev)

- Reused existing personalization primitives from `features/for-you/profile.ts`:
  - `deriveSignalTags`
  - decayed signal buckets and event weights
- Reused bounded content extraction from `features/for-you/contentSignals.ts`.
- Kept data-fetching boundaries:
  - Storefront retrieval stays in `lib/shopify/services/*`
  - orchestration/ranking stays in `features/for-you/*`
- New reel retrieval flow is seed-first and paginated with cursor state:
  - recommendations -> search-by-terms -> collection backfill -> profile backfill
- New grid selection uses ranked-band sampling for refresh novelty while preserving personalization constraints.
- Dev-only diagnostics:
  - score/band/category debug metadata
  - lightweight counters in `features/for-you/telemetry.ts`
