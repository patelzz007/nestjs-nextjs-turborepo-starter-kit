# Schemas and contracts layout

Zod schemas used by both the NestJS API and the Next.js / Expo clients. **Single source of truth** — never define validation logic in the API or a client alone.

The single public entry point is `@workspace/shared` (`src/index.ts`). Every symbol keeps its name there, wherever its file lives; never import a deep path.

## Directory structure

```
src/
  contexts/<context>/       → one folder per bounded context (plan §6.1), owner per plan §6.2 / §7
    schemas/                → that context's zod schemas (+ __tests__/)
    routes.ts               → its API path templates, composed into `apiRoutes`
    contract.ts             → its contract leaves, composed into `apiContract`
  schemas/
    api/                    → cross-cutting API schemas (pagination, envelope, list queries, health, version)
    infrastructure/         → Kafka, outbox, queue and job payloads
    runtime/                → utility schemas (JSON types, HTTP headers, caught errors)
    domain/platform/        → schemas that belong to no context (route params, logs, the legacy URL shortener)
    index.ts                → barrel: re-exports every schema under its public name
  contracts/                → `apiContract` composition + shared helpers (define-contract, response,
                              versioning, idempotency, mutation-intent, client-session, path-param)
  api-routes.ts             → `apiRoutes` composition
```

The 14 contexts: `identity`, `authorization`, `tenants`, `rewards`, `claims`, `pos`, `referrals`, `reporting`, `files`, `notifications`, `catalog`, `reference-data`, `audit`, `integrations-github`.

## Rules

1. **Every schema must be here** — not in `apps/api/src/` or a client app.
2. **Infer types from Zod** — use `z.output<typeof Schema>`, never define interfaces separately.
3. **No `z.any()`, `z.unknown()`, `z.never()`** — use specific types.
4. **No `as const`** — use tuples for readonly arrays.
5. **Export both schema and type** — `export const FooSchema = z.object({...}); export type Foo = z.output<typeof FooSchema>;`
6. **A schema lives with the context that owns the data or the endpoint.** A context may import another context's schema file; keep the imports one-directional so no file-level import cycle forms.
7. **The public surface never changes by moving a file.** `src/contracts/__tests__/api-contract-shape.test.ts` snapshots every contract key, method and path and every export name of `@workspace/shared`.

## Adding a new schema or endpoint

1. Create the schema in `contexts/<owner>/schemas/` (or `schemas/api/` if it is genuinely cross-cutting).
2. Define the Zod schema and export its type via `z.output<typeof Schema>`.
3. Re-export it from `schemas/index.ts`.
4. Add the path to `contexts/<owner>/routes.ts` and the leaf to `contexts/<owner>/contract.ts`; if it is a new group, compose it in `api-routes.ts` and `contracts/index.ts`.
5. Use the leaf in the controller (`@ZodBody(apiContract.<group>.<leaf>.input)`) and the client router.
