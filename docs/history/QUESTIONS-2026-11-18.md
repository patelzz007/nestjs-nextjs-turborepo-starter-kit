# Overnight work 2026-11-18: decisions made and questions for the owner

Work done while you slept: Plan A (security SQL generated from TypeScript), Plan B (tenant-table tightening),
Plan C (CASL on the frontend). Nothing is committed or pushed. Each entry says what I decided, why, and what you may
want to change. Answer inline or tell me in chat.

## Decisions I made (change any of them)

| # | Decision | Why | Your call |
|---|---|---|---|
| D1 | `db:apply-security` applies the **committed** generated SQL; it does not regenerate. Developers run `pnpm --filter @workspace/api db:security` (generate + apply) | Generating needs the Prisma client (the system-operation registry reads `Prisma.ModelName`), which a deploy step may not have; and a deploy should run exactly the reviewed SQL | Keep, or make `db:apply-security` regenerate locally |
| D2 | The comparison container uses `postgres:18.6` (already pulled); your local server is 18.7 | Same major version; the catalog shapes compared are identical across minor versions | Pull 18.7 if you want an exact match |
| D3 | The TypeScript tooling moved from `apps/api/prisma/rls/` to `apps/api/prisma/security/` (file names unchanged) so `prisma/rls/` holds only generated SQL | Your "rls/ is output only" rule | — |
| D4 | `standard-policies.ts` was folded into `generator/index.ts` (it rendered only the old 97 file) | One renderer for all policies | — |
| D5 | The generated `04-policies.sql` drops any policy on a listed table that `table-policies.ts` no longer declares (and names it in the apply log) | Otherwise a renamed policy lives on forever in old databases | — |
| D6 | Without an `AbilityProvider`, `@casl/react`'s `<Can>`/`useAbility()` throw rather than deny | That is the library's behaviour; every app mounts the provider at its root, and an empty capability list denies everything | Accept, or ask for a deny-all default context |
| D7 | The CASL vocabulary is the catalogue's own, upper-case: `<Can I="UPDATE" a="REWARD">` | No second naming scheme to keep in sync (ADR 067: subjects come only from catalogue nouns) | Prefer lower-case aliases? |
| D8 | The navigation registry stays on capability slugs (independent of CASL), as you asked | — | — |
| D9 | Tenant-table tightening follows the API's route checks (ADR 090). Where a route checks a different verb than the catalogue's natural one, the table accepts both | So no custom role passes the API and then fails at the database | See Q2 |
| D10 | `Location`, `TenantAsset`, `TenantMerchantProfile` and `Tenant` stay readable by every member | The merchant shell (`GET /tenants/:slug/context`) shows them to every role; filtering them breaks the Cashier's home screen and store picker | — |
| D11 | Tables no member reads (`TenantEncryptionKey`, lifecycle, placements, slug history, support grants, appeals, payment events, broadcasts) became system-only | Tightest possible; no user path exists today | Re-open one if a screen will read it as a member |
| D13 | CASL adds about 5 KiB to every page that mounts the provider. I raised **only** the 28 pages (web 3, admin 14, merchant 11) that went over, to measured × 1.1 (the repo's own headroom rule, `budgets/bundle.json`) — not a full re-baseline. I also switched from `createMongoAbility` to the plain `Ability` (no condition matcher is ever needed) | The repo's rule: a deliberate increase is an edit of `budgets/bundle.json` in the same change | Review the 28 numbers |
| D14 | Four headings of `docs/technical/authorization/frontend.md` changed, so their old anchors are listed in `apps/docs/src/lib/baseline.ts` `RENAMED_ANCHORS` (the docs' sanctioned mechanism; the baseline itself is untouched). Nothing in the repo linked to them | The docs build fails on a lost anchor | — |
| D15 | The security declarations are now fully typed (follow-up "make it type-safe with autocomplete"). `table-policies.ts` is a mapped type over `Prisma.ModelName`, so a missing model fails to compile. Each policy is a discriminated union on `rule`, which demands exactly that rule's inputs. `column`/`storeColumn` are that table's own columns, `resource`/`action` come from the catalogue, `operations` from the registry, and one-off rules are allowed only on their own table. `roles.ts` (column grants), `triggers.ts` and `withheld-privileges.ts` are typed the same way. The `permission()`/`runtimePermission()` helpers became plain object literals so the editor completes every field. Generated SQL is byte-identical (`db:generate-security`: all 5 files unchanged) | Your "typesafe + IDE autocomplete" ask; types are compile-time only, and the generator still re-checks values at runtime | — |
| D16 | Q3 handled the D9 way: `Reward` gained `rewards_managers_insert` (`reward.update` may INSERT), because the create route checks `reward.update`. A new e2e test proves it: it fails without the policy and passes with it | A custom role holding `reward.update` but not `reward.create` passed the API and then got a database error. Aligning the route itself is part of Q2 | Fix the route instead (then drop the policy) |
| D12 | Two e2e expectations changed on purpose: a Cashier no longer reads terminals (`rls-hardening`) or the tenant's own roles (`tenant-access`) | The Cashier template holds neither `terminal.read` nor `role.read`; no screen needed it | — |

## Questions

| # | Question | My default until you answer |
|---|---|---|
| Q1 | **StoredFile / FileVariant** are still readable by any member of the tenant. Tightening needs a rule per file category (reward image → `reward.*`, logo → `location.*`, KYB → `kyb.*`, broadcast image → `broadcast.*`). Do it next? | Left as is (deferred in ADR 090) |
| Q2 | Several routes check an odd verb: terminals/keys check `api_key.create` for reads, payments `payment.create` for reads, the team `member.update` for reads, webhooks `webhook.update` for everything, `GET /kyb` `kyb.update`, broadcasts `broadcast.update` for reads. Align the routes to the catalogue verbs (then drop the extra policies)? | Database accepts both verbs |
| Q3 | Reward create is gated on `reward.update` at the route, but the database's `rewards_write` needs `reward.create` (this predates tonight). Fix the route? | The database now accepts both verbs (D16); the route is untouched |
| Q4 | A member may now update their **own** membership row (needed by `PATCH /members/me`). Row security can't limit which columns, so at the database level they could also change their own `roleId`/`status`; the API prevents it. Move the rename to a system operation so members get no UPDATE at all? | Own-row UPDATE kept (still far tighter than before: any member could update any membership) |
| Q5 | **Per-row capabilities on rewards (C3) were NOT built.** The reward edit and publish routes authorize at tenant level only (`assertCapability(manageRewards)` in `revise-reward.handler.ts`): the API never honours a share or ownership for a merchant reward edit, so a per-row `capabilities` field would say exactly what `<Can I="UPDATE" a="REWARD">` already says. Build it once a route decides per record (through `AccessControlPort.decide` with the record), so the UI can show what that one record allows? | Not built; the type-level checks are correct today |
| Q6 | `<Can>` / `useAbility()` throw outside an `AbilityProvider` (D6). Want a deny-all default context instead? | Throw (library behaviour) |

## Afternoon round (your answers: split routes, create_rewards, per-category files, prod drop flag, deny-all, all four optional items, per-row rewards, Postgres 18.7)

Every question above is now answered and built. Details are in ADR 092 and ADR 093.

| # | What was built | Notes for you |
|---|---|---|
| A1 | **Q2: one verb per route.** 24 new merchant capabilities, one per catalogue verb a route needs (view/create/update/delete/publish for rewards, bans, keys, tills, team, invitations, join requests, verification, payments, webhooks, broadcasts). Every handler checks its own verb. Pages and buttons use the same verbs | Owner and Manager templates already hold them all, so seeded roles keep what they had. A custom role holding only a write verb now loses the matching *read route* |
| A2 | **Q3: `merchant:create_rewards`** (reward.create) gates reward creation; the `reward.update` insert policy is gone | — |
| A3 | **Q4: renaming yourself runs as `tenant.membership.rename_own`.** No member holds UPDATE on Membership | Proved in e2e: the Cashier's own-row UPDATE is now refused by the database |
| A4 | **Q1: files follow their feature** (logo/banner every member; KYB kyb.read/kyb.update; reward images reward.*; broadcast images broadcast.*; anything else system-only) | Uploaders of a tenant file no longer keep access after losing the permission |
| A5 | **Q5: per-record reward decisions.** Reward read, edit, minimum tier and publish decide for that reward (an EDIT share counts); `viewerCapabilities: { update, publish }` on the single-reward read drives "Submit for review" and the minimum tier | The full editor still needs `reward.update`: it also rewrites the audience and images (tenant data a share does not reach) |
| A6 | **Q6: deny-all outside a provider** on web and mobile | — |
| A7 | **The database follows the same verbs**: read-back policies for writers; dead hard-DELETE policies removed (reward.delete, reward audience); image and store-scope writes narrowed to INSERT and UPDATE | `db:security-explain <Table>` prints the result in plain words |
| A8 | **Performance found and fixed (ADR 093).** The new benchmark showed the per-row permission function made counting 100 000 sales 261× slower (2.6 s). Policies now ask once per statement: 47 ms. Proved equivalent over 2 160 combinations | `pnpm --filter @workspace/api db:security-benchmark [--rows N] [--max-overhead X]` |
| A9 | **Guard rails**: route-vs-policy drift test, `@map` test, any-member-write test, SQL column-reference test, typed function grants, `RULE` hover catalogue, single source for one-off rules, pre-commit security check, production apply refuses to drop undeclared policies without `--allow-policy-drops` | — |
| A10 | **403 refresh**: a capability refusal makes each app re-read the session's capabilities | — |
| A11 | **Postgres 18.7** everywhere: CI services, nightly workflows, compose (commented), the backup `pg_dump` image, the throwaway container, **and the production droplet** (`infra/droplet/data-services.compose.yml`) | Production is a minor-version upgrade (same data format): the next `docker compose up -d` there restarts Postgres on 18.7. Do it in a quiet window |
| A12 | **Self-contained e2e**: the tightening tests moved to `e2e/rls/` and run on the two-tenant fixture, building custom roles, shares and files inside a rolled-back transaction (also on the single-tenant CI job) | — |

### Open items (my honest notes)

| # | Item | Status |
|---|---|---|
| O1 | **Lazy-loading CASL on auth pages: no measurable win in the merchant app.** I moved `new Ability(…)` out of `@workspace/shared` (the right layering: the shared package no longer loads CASL at runtime), but Turbopack still puts CASL in a shared chunk every merchant route loads (about 44 KB, together with other modules the loading skeletons need). Shrinking it further means restructuring the skeletons' imports or the chunking config | Not done; budgets unchanged by this |
| O2 | `@workspace/shared` keeps one public entry point (your lint rule). I did not add a deep import to work around O1 | By design |
| O3 | Broadcast composer helpers (audience preview, customer picker, weekly allowance) are reads, so they need `view_broadcasts`. A role with only `create_broadcasts` cannot attach a picture (that is `manage_broadcasts`, as uploads are file writes) | Tell me if a "create only" role should upload pictures |
| O4 | `turbo dev` was running while I worked; I did not stop it. Targeted e2e runs used a scratch database (`starter_e2e_scratch`, local only), which you can drop: `dropdb starter_e2e_scratch` | — |
