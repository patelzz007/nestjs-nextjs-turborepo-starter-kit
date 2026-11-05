---
title: "Certification exercise"
description: "A timed exercise for a new developer: add one field to the sample category end to end — contract, database, seed, API, admin form and tests — then let the checker confirm every layer and run the gate."
order: 6
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=630&fit=crop"
tags: ["guide", "onboarding", "development"]
---

# Certification exercise

A first task for a new developer (enhancement 7.6). It touches every layer a real feature does, on the sample
category, the module built to be copied (`docs/technical/adding-a-feature.md`). **Time box: half a day.**

## The task

Add an optional **`badgeColor`** to the sample category: a colour (`#RRGGBB`) the admin shows as a dot next to
the category's name.

| Layer | What done looks like |
|---|---|
| Contract | `packages/shared/src/contexts/catalog/schemas/sample-category.ts`: the field in the response, the create and the update input, validated as `#RRGGBB` (one schema, used by the API and the form) |
| Database | `badgeColor String? @db.VarChar(7)` on `SampleCategory` in `schema.prisma`, and a **generated** migration (`pnpm --filter @workspace/api db:migrate:create`) |
| Seed | At least one seeded category has a colour, so the column holds a value (`db:check-seed-coverage` fails otherwise) |
| API | The repository reads and writes it; the response carries it; nothing else changes (authorization and audit already cover the routes) |
| Admin | The category form has the field (the same schema validates it); the list shows the dot |
| Tests | The schema (a good colour, a bad one, absent), the API (create, update, clear, a bad value refused) and the form |
| Docs | A line in `docs/technical/adding-a-feature.md`'s example, if anything there changed |

The rules are the repository's own: `rules/00-non-negotiables.md` first. No `any`, no casts, no `typeof`
checks, server-side validation, tests in `__tests__/`.

## Checking your work

```bash
pnpm certify:check                    # every layer, then the full gate (format → lint → typecheck → test → test:e2e → ci:local)
pnpm certify:check -- --no-gate       # only whether each layer is done (fast, while working)
pnpm certify:check -- --field iconName  # a reviewer setting a different field
```

The checker reads the files a correct solution touches and names each layer that is missing. It does not
judge design: a reviewer reads the diff. Passing it and the gate is the bar for review.
