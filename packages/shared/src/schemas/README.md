# Schemas Directory

Zod schemas used by both the NestJS API and the Next.js client. **Single source of truth** — never define validation logic in the API or client alone.

## Directory Structure

```
schemas/
  auth/           → Login, signup, password reset, token, user schemas
  runtime/        → Utility schemas (JSON types, HTTP headers, caught errors)
  api/            → API-level schemas (pagination, response envelope, health, version)
  domain/         → Feature-specific schemas (telescope, backup, RBAC, etc.)
  email/          → Email log + email template schemas
  index.ts        → Barrel export (re-exports everything)
```

## Rules

1. **Every schema must be here** — not in `apps/api/src/` or `apps/admin/`
2. **Infer types from Zod** — use `z.output<typeof Schema>`, never define interfaces separately
3. **No `z.any()`, `z.unknown()`, `z.never()`** — use specific types
4. **No `as const`** — use tuples for readonly arrays
5. **Export both schema and type** — `export const FooSchema = z.object({...}); export type Foo = z.output<typeof FooSchema>;`

## Adding a New Schema

1. Create the file in the appropriate subdirectory (or `domain/` for new features)
2. Define the Zod schema
3. Export the type via `z.output<typeof Schema>`
4. Re-export from `schemas/index.ts`
5. Use in contracts (`contracts/index.ts`) and controllers (`ZodValidationPipe`)
