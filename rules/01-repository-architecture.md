# 01 — Repository Architecture

## Why the repository is organized this way

A monorepo with three consuming apps (API, web, mobile) fails in a predictable way when there's no enforced boundary: shared logic gets copy-pasted between apps because "it was faster than figuring out where it should live," and within a year the API and the web app have two different, silently-diverging definitions of the same business rule. Everything in this document exists to make "where does this go?" a fast, mechanical decision instead of a judgment call made differently by every contributor.

## Monorepo layout

```text
apps/
  api/
  web/
  mobile/

packages/
  contracts/          # shared zod schemas — the runtime contract between api/web/mobile
  config/               # shared eslint/tsconfig/tailwind config
  database/              # Prisma schema, client, generated types, seed
  eslint-config/
  typescript-config/
  ui/                       # shadcn-based component library — web only
  tokens/                   # design token source (TypeScript) + generator → committed web/mobile CSS
  api-client/               # platform-neutral API client (router, fetch + zod, transports) — web and mobile
  client/                   # web-only wrappers on top of api-client (Next server helpers, cookies, auth UI)
  shared/                    # framework-agnostic utilities usable by api/web/mobile
  observability/              # shared logging/tracing helpers

infrastructure/
  docker/
  kafka/
  rabbitmq/
  redis/

docs/
  architecture/
  adr/
  runbooks/

tools/
  scripts/
```

The exact package list can evolve as the product grows, but ownership of each package must stay explicit at all times — every package documents its runtime, its dependencies, its public exports, and which consumers are forbidden from importing it (see `14-documentation.md` for the package README template).

## Where new code belongs — decision guide

| Adding... | Goes in | Why |
|---|---|---|
| A REST endpoint, NestJS module | `apps/api/src/modules/<feature>` | API-specific, owns HTTP concerns |
| A web page/route | `apps/web/src/app/...` | Web-specific routing/rendering |
| A mobile screen | `apps/mobile/src/app/...` | Mobile-specific navigation |
| A component used only on web, reused across 2+ features | `packages/ui` | Real reuse, web-only (shadcn/Radix) |
| A component specific to one page | co-located with that route | Not yet reused — don't promote speculatively |
| A zod schema shared between api and web/mobile | `packages/contracts` | Must be the same definition everywhere |
| A pure, framework-agnostic function used by 2+ apps | `packages/shared` | No framework dependency, genuine reuse |
| Prisma schema/client/seed | `packages/database` | Single source of DB truth |
| Shared eslint/tsconfig | `packages/eslint-config`, `packages/typescript-config` | Config consistency across apps |
| An API endpoint's client leaf, request/response handling, session transport, or a TanStack Query hook over the router | `packages/api-client` (core in `src/`, hooks in `src/react/`) | One client for web and mobile; it must stay free of Next, DOM and Node code |
| Web-only API glue (Next server prefetch, route proxy refresh, cookie names, auth forms) | `packages/client` | Depends on `next` / `react-dom` / `server-only`, which the mobile app must never pull in |
| A design token (colour, radius, type size, z-index, easing) | `packages/tokens/src` — then `pnpm tokens:generate` | One source for web and mobile (ADR 030); generated CSS is never hand-edited |

### Worked example

Say you're building a "resend invoice email" feature. Ask, in order:

1. **Does this need HTTP-specific logic (auth, request parsing, response shaping)?** Yes → the endpoint/controller part lives in `apps/api/src/modules/invoices/`.
2. **Does the actual "format an invoice email" logic need to run anywhere other than the API?** If web/mobile never need to independently render the same email template, that formatting logic stays inside `apps/api` — don't promote it to `packages/shared` just because it feels "generic." If, on the other hand, the web app *also* needs to render an invoice preview using the same formatting rules, then and only then does that formatting function move to `packages/shared`.
3. **Does the invoice shape need to be known by web/mobile at all** (e.g. to render a confirmation)? If yes, the `Invoice` zod schema goes in `packages/contracts`, not hand-duplicated as a separate TypeScript type inside `apps/web`.

```text
✅ DO:
  apps/api/src/modules/invoices/application/resend-invoice.service.ts   (API-only orchestration)
  packages/contracts/src/invoice.ts                                       (shared schema, if FE needs it)

❌ DON'T:
  apps/web/src/lib/invoice-email-formatter.ts   (duplicating API-only logic "just in case")
  apps/api/src/modules/invoices/invoice.types.ts  (hand-duplicating packages/contracts's schema)
```

### The rule of thumb, restated

**Used by exactly one app → lives in that app.** Promote to `packages/` only once a second real consumer needs it — not because it seems like the kind of thing that *should* be shared in principle. Premature promotion to a shared package has the same cost as any other speculative abstraction (`00-non-negotiables.md`): it adds a layer everyone has to understand, for a need that doesn't exist yet, and it's usually wrong about *how* the second consumer will actually want to use it once one shows up for real.

## Dependency direction

```text
UI / Application
       ↓
Feature / Domain
       ↓
Application services
       ↓
Ports / interfaces
       ↓
Infrastructure adapters
       ↓
External systems
```

Infrastructure must never become the application's business logic.

```ts
// ❌ DON'T — a Prisma-specific detail (a unique constraint error code) leaking into
// business logic that has no business knowing about Prisma
async function createUser(input: CreateUserInput) {
  try {
    return await prisma.user.create({ data: input });
  } catch (e) {
    if (e.code === 'P2002') throw new Error('duplicate'); // Prisma-specific code, leaked upward
  }
}

// ✅ DO — the infrastructure adapter translates the provider-specific error
// into an application-level concept before it leaves the repository
class UserRepository {
  public async create(input: CreateUserInput): Promise<User> {
    try {
      return await this.prisma.user.create({ data: input });
    } catch (e) {
      if (isPrismaUniqueConstraintError(e)) throw new DuplicateUserError(input.email);
      throw e;
    }
  }
}
```

## Package dependency graph

```text
apps/api      → packages/contracts, packages/database, packages/shared, packages/observability, packages/config
apps/web      → packages/contracts, packages/shared, packages/ui, packages/config
apps/mobile   → packages/shared, packages/api-client (both entries), packages/tokens (generated mobile.css only), packages/eslint-config + typescript-config (dev)
               NEVER packages/client, packages/ui, next, react-dom, server-only, Node built-ins or AsyncStorage (lint-enforced: mobileImportBoundaryConfig)
packages/client     → packages/api-client, packages/shared, packages/ui
packages/api-client → packages/shared (core "."); + react, @tanstack/react-query ("./react" entry only)
packages/ui   → packages/shared, packages/tokens (generated web.css), packages/config
packages/shared → packages/config only
packages/tokens → nothing (no runtime dependencies; zod is a dev-only dependency for its own validation)
```

`packages/tokens` sits at the bottom of the graph: it imports no other workspace and no runtime npm
package, so any app or package may depend on it. It is consumed two ways:

- **Generated CSS** (the normal path): `@workspace/tokens/web.css` (imported by `packages/ui`'s
  `globals.css`), `@workspace/tokens/palette.css` (the docs site) and `@workspace/tokens/mobile.css`
  (`apps/mobile`). These files are committed, produced only by `pnpm tokens:generate`, and a test
  fails while they are stale — never edit them by hand.
- **TypeScript** (`@workspace/tokens`): the typed token data and `resolveColorToken`, for code that
  needs a value in JavaScript (a chart, a native API). It must stay platform-neutral: no React,
  Next.js, DOM or Node imports outside its own `scripts/` and tests.

`packages/api-client` is the one API client of every frontend: the router built from the shared
contracts, `fetch` with zod validation, the error envelope mapping, and two session transports —
cookies for the browser client types, body tokens (Bearer + refresh in the request body) for
`mobile` ([ADR 029](../docs/adr/029-mobile-client-body-token-transport.md)). Its configuration
(`baseUrl`, client type, transport, app version) is injected by each app and validated with zod; the
package reads no environment. Because the mobile app runs it in React Native, lint
(`apiClientBoundaryConfigs` in `packages/eslint-config/import-boundaries.js`) forbids its core from
importing `next`, `react`, `react-dom`, `@tanstack/react-query`, `@workspace/client`, `@workspace/ui`
or a Node built-in, and its shipped code from touching DOM-only or Node globals; only `src/react/`
may add `react` and `@tanstack/react-query`. `packages/client` builds the web's cookie client on it
and re-exports it from its old `lib/api/*` paths; never the other way round.

`apps/mobile` (the Expo app, docs/technical/mobile/mobile-app.md §9) sits at the top beside the
Next apps but on a different runtime (React Native / Hermes), so it reaches the API only through
`@workspace/api-client` (token transport) and the contracts only through `@workspace/shared`. The web
packages (`@workspace/client`, `@workspace/ui`) would drag `react-dom`, Next and the DOM into the
native bundle; lint (`packages/eslint-config/react-native.js` → `mobileImportBoundaryConfig`) refuses
them, Node built-ins and AsyncStorage. Logic that both the web and the mobile app need belongs in
`packages/shared` (platform-neutral, Vitest-tested) or `packages/api-client`, never copied into the app.
Two Metro resolution rules (`apps/mobile/metro.config.js`, mirrored by `jest.resolver.cjs`) keep
`react`, `react-native` and `@tanstack/react-query` single instances (a workspace package's own
devDependency copies would otherwise be bundled) and resolve `@workspace/*` through their
`development` (TypeScript source) export.

Token *values* live nowhere else. A component never hard-codes a colour, and `packages/ui` holds no
token values of its own — only non-token CSS (base layer, scrollbars, component helpers).

No package imports from `apps/*` — ever, under any circumstance. This is what keeps packages independently testable and prevents an app-specific assumption from quietly leaking into shared code. No circular package dependencies either.

```text
❌ DON'T — packages/shared importing something from apps/api "just this once"
   because a utility function happened to be written there first.
   This inverts the whole dependency direction and means packages/shared
   can no longer be built or tested without apps/api existing.

✅ DO — if apps/api has a utility that packages/shared (and therefore
   apps/web, apps/mobile) also needs, MOVE it into packages/shared and
   have apps/api import it from there instead.
```

## Avoiding circular dependencies

Circular dependencies show up at two levels here, and both are real, recurring risks in a NestJS + Turborepo monorepo — not theoretical edge cases.

### Package-level cycles

If `packages/contracts` needs something from `packages/shared`, and `packages/shared` needs something from `packages/contracts`, one of two things is true: either a piece of code is living in the wrong package, or a third package needs to exist to hold the genuinely shared piece both of them depend on.

```text
❌ DON'T:
  packages/contracts/src/order.ts    imports formatCurrency from packages/shared
  packages/shared/src/format.ts       imports OrderSchema from packages/contracts
  → this is a cycle. Turborepo's task graph will fail to build.

✅ DO:
  Move the currency-formatting-that-needs-to-know-about-Order-shape logic
  either fully into packages/contracts (if it's schema-adjacent), or make
  formatCurrency generic enough that it doesn't need to import OrderSchema
  at all (it just takes a number and a currency code).
```

Turborepo's task graph will refuse to build on a real package cycle — treat that failure as a structural design bug to fix at the architecture level, not something to route around with a dynamic `import()` to dodge the static analysis. A dynamic import that dodges a cycle doesn't remove the cycle, it just hides it from the tool that was trying to warn you about it.

### NestJS module-level cycles

```text
❌ DON'T:
  OrdersModule imports UsersModule (to look up the customer)
  UsersModule imports OrdersModule (to show a user's order history)
  → two Nest modules importing each other directly is a sign a capability
    is misplaced, or that an event/port should mediate instead of a direct import.

✅ DO (option A — event-driven):
  OrdersModule publishes an `order.created` event.
  UsersModule subscribes to it to update a denormalized "last order" field,
  without ever importing OrdersModule directly.

✅ DO (option B — narrow port):
  Define a `UserLookupPort` interface (just the one method OrdersModule
  actually needs — see 21-oop-and-solid-principles.md's Interface
  Segregation guidance) in a shared location. OrdersModule depends on the
  PORT, not on UsersModule's full concrete service. UsersModule implements it.
```

Where a genuine bidirectional relationship is truly unavoidable, NestJS's `forwardRef()` is a last resort — and its presence in code should come with a comment explaining specifically why the cycle couldn't be designed away, so the next person doesn't assume it's the default way to solve this kind of problem.

## Shared packages must be runtime-appropriate

```text
❌ DON'T — importing a Node-only API (fs, path with Node semantics, process.env
   accessed directly) into packages/ui or packages/contracts, which Expo consumes.
   This will build fine locally on your machine and then crash at runtime on a
   physical device or in the Expo Go sandbox, because those APIs don't exist there.

❌ DON'T — importing a browser-only/DOM API (window, document, localStorage)
   into a package NestJS consumes. This will crash the API process on startup.

✅ DO — packages/contracts contains only pure zod schemas and z.infer types,
   with zero runtime dependency on Node or DOM globals, so it's safe to import
   from all three apps without any of them pulling in code they can't run.
```

Every shared package documents (in its README, per `14-documentation.md`) which runtimes it's safe for and which it explicitly isn't.

## API package boundaries

```text
modules/
  users/
    application/
    domain/
    infrastructure/
    presentation/
```

...rather than one global `controllers/`, `services/`, `repositories/` folder containing hundreds of unrelated files from every feature mixed together.

```text
❌ DON'T:
  src/
    controllers/
      users.controller.ts
      orders.controller.ts
      rewards.controller.ts
      ... (50 more, alphabetically sorted, no feature grouping)
    services/
      users.service.ts
      orders.service.ts
      ... (50 more)
  → finding everything related to "orders" means searching across five
    different top-level folders every time.

✅ DO:
  src/modules/orders/
    application/orders.service.ts
    presentation/http/orders.controller.ts
    domain/order.entity.ts
    infrastructure/prisma/orders.repository.ts
  → everything related to "orders" lives under one folder.
```

Don't force every feature to populate every one of `application/`, `domain/`, `infrastructure/`, `presentation/` if it genuinely doesn't need them — a tiny, simple feature with no real domain logic doesn't need an empty `domain/` folder just for consistency's sake. Empty architecture (folders that exist because the template has them, with nothing meaningful inside) is worse than simple, honest architecture that reflects what the feature actually needs.

## Feature ownership

A feature owns its schemas, DTO/contract definitions, use cases, authorization policy, persistence adapters, events, tests, and documentation — all of it, together, under that feature's module. Don't scatter one feature's pieces across unrelated global folders without a strong, explicitly stated reason (e.g. "authorization policies live in a shared `policies/` folder because three different features need to compose the same underlying rule" is a strong reason; "I put it here because that's where similar-sounding code already was" is not).

## ADRs

Record architecturally meaningful decisions in `docs/adr/` — a short, numbered file per decision. Examples of decisions that warrant one: "Why Kafka instead of RabbitMQ for this specific event," "Why we introduced an outbox pattern here," "Why Zustand owns UI state but TanStack Query owns server state," "Why this particular Prisma transaction strategy," "Why a base repository exists for entity X but not entity Y." See `14-documentation.md` for the ADR template. The point of an ADR isn't to record *what* was decided (the code already shows that) — it's to record *why*, and what alternatives were considered and rejected, so a future engineer questioning the decision doesn't have to re-litigate it from scratch or guess at the reasoning.

## Common architecture smells — a catalog for review

These are the recurring, recognizable signs that a change is drifting away from the architecture described above. Treat spotting one of these as a prompt to stop and reconsider placement, not as something to wave through because the code "works."

### Smell: an app importing directly from another app

```text
❌ DON'T:
  apps/web/src/lib/something.ts:
    import { OrdersService } from '../../../../apps/api/src/modules/orders/orders.service';

  This is a structural violation, not a style nitpick — apps/web now has
  a hard, buildable dependency on apps/api's internals, which means
  apps/api can no longer be deployed, versioned, or even have its internal
  structure refactored independently of apps/web. Turborepo's dependency
  graph doesn't expect this and your builds/caching will behave strangely.

✅ DO:
  If apps/web genuinely needs something apps/api has, that something
  belongs in packages/contracts or packages/shared, and apps/api ALSO
  imports it from there — neither app imports from the other, ever.
```

### Smell: a "utils" or "helpers" package/folder with no clear theme

```text
❌ DON'T:
  packages/shared/src/utils.ts containing: formatCurrency, validateEmail,
  debounce, a Kafka topic name constant, a React hook, and a Prisma
  query helper, all in one file with no organizing principle beyond
  "didn't know where else to put it."

✅ DO:
  packages/shared/src/currency.ts       — currency formatting only
  packages/shared/src/timing.ts          — debounce/throttle only
  A React hook does NOT belong in packages/shared at all if packages/shared
  is meant to be framework-agnostic (04-mobile-expo.md, 01 above) — it
  belongs in packages/ui (web) or apps/mobile (mobile-specific).
  A Kafka topic constant belongs in packages/contracts, next to the event
  schema it names.
```

A grab-bag "utils" file is usually the first sign that "where does this go?" stopped being asked and everything started defaulting to the same convenient dumping ground. If you're about to add a function to a file called `utils.ts`/`helpers.ts`, pause and ask which of the actual named packages/folders in this document it belongs to instead.

### Smell: a package that re-exports everything through one giant barrel file with no structure

```ts
// ❌ DON'T — packages/ui/src/index.ts re-exporting 200 components with
// no organization, making it impossible to tell what's actually meant
// to be public API versus an internal implementation detail that just
// happened to get swept into the barrel
export * from './components/button';
export * from './components/button/internal-button-icon'; // ...should this even be exported?
export * from './components/data-table';
export * from './components/data-table/internal-row-renderer'; // same problem
// ...196 more lines like this

// ✅ DO — the barrel file is a deliberate, curated public surface;
// internal implementation pieces are NOT re-exported from it
export { Button } from './components/button';
export { DataTable } from './components/data-table';
// internal-button-icon.tsx and internal-row-renderer.tsx are imported
// directly by button.tsx/data-table.tsx, never exposed to consumers
```

### Smell: version drift between a shared package and what consumes it

If `packages/contracts` changes its zod schema for `Order` in a way that's incompatible with what `apps/mobile` currently expects (a field renamed, a field's type changed), and `apps/mobile` isn't rebuilt/redeployed at the same time, you have a live version-skew bug in production — the mobile app is running old code against a new contract.

```text
✅ DO — for any change to a schema in packages/contracts that isn't purely
   additive (i.e. anything beyond "added a new optional field"), treat it
   with the same care as a breaking public API change (05-contracts-zod-api.md's
   versioning section): identify every consumer, and don't ship the
   contract change until you're confident every consumer can handle it —
   remembering that a mobile app in particular can have users running an
   old build for weeks after a new one ships, unlike a web app that
   updates on every page load.
```

### Smell: business logic creeping into `packages/config`

`packages/config` exists for build tooling configuration (eslint rules, tsconfig compiler options, tailwind theme setup) — it should never contain a runtime value that affects application behavior (a feature flag default, a business rule threshold). If you find an actual business decision living in a config package, it belongs in `packages/contracts` (if it's a shared constant/schema) or directly in the app that owns the decision.

### Smell: a `tools/scripts` script that duplicates application logic instead of importing it

```text
❌ DON'T — tools/scripts/backfill-order-totals.ts reimplements the
   "calculate order total" logic from scratch, separately from
   apps/api's actual OrderPricingService, because it was faster than
   figuring out how to import it. Now there are two implementations of
   the same business rule, and only one of them is covered by the tests
   in apps/api.

✅ DO — tools/scripts imports the real application logic from the
   relevant package/app wherever the module boundaries allow it, and
   only contains the genuinely script-specific orchestration (reading a
   CSV, looping over rows, printing progress).
```

## Workspace protocol and internal package versioning

```json
// ❌ DON'T — an app depending on an internal package via a real,
// published version range, which means every local change to that
// package requires a publish step before another app in the SAME
// monorepo can even see it
{
  "dependencies": { "@repo/contracts": "^1.4.2" }
}

// ✅ DO — the package manager's workspace protocol, so internal
// packages are always resolved to the local, in-repo source — no
// publish step needed for a monorepo-internal change to be immediately
// visible to every consumer
{
  "dependencies": { "@repo/contracts": "workspace:*" }
}
```

## Turborepo pipeline configuration — common misconfigurations

```json
// ❌ DON'T — a task with no declared `outputs`, which means Turborepo
// can't cache it correctly and every run redoes full work even when
// nothing relevant changed
{
  "tasks": { "build": { "dependsOn": ["^build"] } } // no outputs declared
}

// ✅ DO — outputs declared accurately, so Turborepo's caching actually works
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] }
  }
}
```

```json
// ❌ DON'T — a task that reads an environment variable which isn't
// declared in Turborepo's config, silently breaking cache correctness:
// Turborepo will serve a STALE cached result even after that env var
// changes, because it doesn't know the env var affects the output at all
{
  "tasks": { "build": { "outputs": ["dist/**"] } } // but build.ts reads process.env.API_URL and bakes it into the bundle!
}

// ✅ DO — declare env var dependencies explicitly so the cache key
// accounts for them
{
  "tasks": { "build": { "outputs": ["dist/**"], "env": ["API_URL"] } }
}
```

## `package.json` conventions across the monorepo

Every `apps/*` and `packages/*` package.json exposes the same standard script names (`build`, `dev`, `lint`, `typecheck`, `test`) with consistent behavior, so `turbo run <task>` works uniformly from the root regardless of which specific package it's targeting — a package that names its test script `test:unit` instead of `test` breaks the uniform pipeline and has to be special-cased, which defeats the purpose of a standardized monorepo task graph.

```text
❌ DON'T — apps/api's package.json has "test": "vitest run", while
   apps/web's has "test:vitest": "vitest run" (named differently for no
   real reason). `turbo run test` now silently skips apps/web.

✅ DO — identical script NAMES across every package, even if what they
   invoke under the hood differs per package's actual tooling.
```

## Affected-only builds and tests

For any non-trivial monorepo, running every app's full build/test suite on every single PR — regardless of what actually changed — wastes CI time and money at a scale that grows with the repo. Use Turborepo's `--filter` (often combined with a "since last merged commit" comparison) to run tasks only for packages actually affected by a given change, directly or transitively through the dependency graph documented earlier in this file.

```bash
# ✅ DO — CI runs only what's actually affected by this PR's changes
turbo run test lint typecheck --filter='...[origin/main]'
```

## A full worked example — tracing one feature's code across every package

To make "where does this go?" fully concrete across the entire monorepo, here's every file a single feature (letting a customer download an invoice, the same example used in `15-feature-development-process.md`) actually touches, and why each one lives where it does:

```text
packages/contracts/src/invoice.ts
  — the InvoiceSchema and the request/response schemas for the new
    endpoint. Lives here because BOTH apps/api (to validate/type the
    endpoint) and apps/web (to type the response it receives) need the
    identical definition (01's dependency-graph rule: neither app
    reimplements what the other already has access to).

apps/api/src/modules/invoices/
  — the actual endpoint, service, and repository. Lives entirely in
    apps/api because generating a PDF and checking access to it are
    API-only concerns; apps/web never needs this logic itself, only the
    contract describing what the endpoint returns.

packages/shared/src/currency.ts (if it doesn't already exist)
  — a formatCurrency() helper used both by the PDF-generation code in
    apps/api (formatting amounts inside the PDF) AND by apps/web
    (formatting the same amounts in an on-screen preview). Framework-
    agnostic, genuinely used by 2+ consumers — exactly what
    packages/shared is for.

apps/web/src/app/orders/[id]/_components/invoice-download-button.tsx
  — a DUMB component (03-web-nextjs.md): takes an onClick prop, shows a
    loading/error state, knows nothing about how the PDF is generated
    or where it's stored. Specific to this one page, not promoted to
    packages/ui, because nothing else in the app currently needs an
    "invoice download button" — see 01's promotion rule (used by
    exactly one app/feature stays local).

apps/web/src/app/orders/[id]/page.tsx
  — the SMART component wiring the mutation (that calls the API) to the
    dumb button above.

NOT created: apps/mobile/src/... for this feature, because the initial
  request only covers web — per 15-feature-development-process.md's
  Definition of Ready, scope was clarified up front rather than
  assumed, and mobile PDF download was explicitly out of scope for this
  particular change.
```

Every single file placement decision above is a direct, mechanical application of the decision table and dependency graph earlier in this document — which is the entire point of having them written down explicitly rather than relying on each contributor's individual intuition.

## What happens when a package boundary is violated and nobody notices for months

A concrete cautionary illustration, because "why does this matter so much" is easier to internalize with a story than with abstract rules: imagine `packages/ui`'s `OrderStatusBadge` component quietly grows a direct import of an API client function, because it seemed convenient at the time and nothing broke immediately. Eighteen months later, `apps/mobile` wants to reuse `OrderStatusBadge` for visual consistency with web — and discovers it can't, because it transitively pulls in a Node-only API client meant for server-side use, which crashes instantly in the Expo runtime (`04-mobile-expo.md`'s runtime-boundary rule). Untangling this now requires carefully extracting the badge's actual presentational logic from eighteen months of accumulated, tangled assumptions about its environment — work that would have taken minutes if the boundary had simply been respected at the time the violation was introduced, and that nobody caught in the intervening year and a half because the violation never caused a visible problem until the exact moment someone tried to do the thing the architecture was supposed to make easy.

## Architecture fitness checks (automate the rules)

Rules that only live in documents decay. Encode the structural ones as automated checks in CI:

```text
- dependency-cruiser / eslint-plugin-boundaries: forbid apps → apps imports, packages → apps imports, and cycles
- a script asserting every apps/* and packages/* has a README and the standard turbo scripts
- a check that packages/contracts has no Node/DOM-only imports (build it for the Expo runtime in CI)
- a check that migrations changed ⇒ seed.ts changed in the same PR (or an explicit override label)
- a check that every controller method has an explicit permission decorator (custom lint rule)
- a check that no `prisma.*.delete(` / `deleteMany(` appears outside an allowlisted retention-purge job
```

A rule enforced by CI is a rule that survives team turnover; a rule enforced by memory is a rule waiting to be forgotten.
