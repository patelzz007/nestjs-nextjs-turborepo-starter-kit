# 13 — CI/CD & Quality Gates

## Pull request gates

A production PR should pass: formatting, lint, typecheck, unit tests, integration/contract tests where applicable, build, migration validation where applicable, and dependency/security checks. Every one of these runs in CI, so nothing depends on anyone remembering it. Separately, the **completion gate** (`pnpm run lint` and `pnpm run test`, zero errors and zero warnings) must also pass locally before any task, human or AI, is called done — see `AGENTS.md`.

```text
❌ DON'T merge a PR because "I ran the tests locally and they passed" if
   CI hasn't independently confirmed it — local environments drift
   (a different Node version, an uncommitted local env var, a stale
   node_modules) in ways that quietly hide real failures.

✅ DO treat a green CI run as the actual gate. A local pass is a useful
   fast feedback loop, not the thing that authorizes a merge.
```

## Branch protection

Main/release branches should not depend on local developer discipline. Enforce every gate above through CI, not through trust — branch protection rules should make it structurally impossible to merge a PR with a failing check, not just discouraged.

## Monorepo CI

Use Turborepo's dependency graph to avoid rebuilding/retesting unrelated packages — a change to `apps/mobile` shouldn't need to rebuild and retest `apps/api` if nothing `apps/api` depends on changed. Cache package manager artifacts, Turborepo task outputs, and build artifacts where safe, so CI feedback stays fast as the monorepo grows.

## Environment separation

Distinguish, at minimum: local, test, staging, production. Never use production credentials locally — not even "just to debug one thing quickly." A local environment is a place mistakes happen (an accidental script run against the wrong table, a debug log that prints a secret to a terminal history) that production credentials make catastrophic instead of harmless.

## Database deployments

Migrations deploy in a controlled sequence. For risky/breaking changes, use expand/contract rather than a destructive one-step change:

```text
expand → deploy compatible code → migrate/backfill → switch behavior → contract
```

```text
❌ DON'T — a single migration that renames a column AND deploys code
   that only knows the new name, all at once. During the deploy window,
   old code (still running on some instances) and new code (already
   deployed on others) disagree about the schema, and requests fail
   unpredictably depending on which instance handled them.

✅ DO — expand/contract:
   1. Expand: add the new column, keep the old one, backfill data.
   2. Deploy code that writes to BOTH columns, reads from the new one.
   3. Once fully rolled out and verified, deploy code that only uses
      the new column.
   4. Contract: drop the old column in a LATER migration, once nothing
      references it anymore.
```

## Rollbacks

Application rollback and database rollback are not always the same operation. Prefer backward-compatible migrations over relying on a destructive rollback script — a rollback that tries to reverse a completed data migration is often riskier than rolling forward with a fix, because "undoing" a migration that other systems may have already reacted to (a downstream consumer that read the new schema) can itself cause new problems.

## Pre-commit hooks — fast, local, non-negotiable checks

```text
❌ DON'T rely purely on CI to catch a trivial formatting/lint issue —
   this burns a full CI cycle (often several minutes) to tell a
   developer something that could have been caught, and often
   auto-fixed, in under a second, locally, before the commit even happened.

✅ DO run fast checks (formatting, lint on changed files, type-check on
   changed files) via a pre-commit hook (e.g. husky + lint-staged),
   so the feedback loop for the CHEAPEST class of mistake is effectively instant.
```

Keep pre-commit hooks fast and narrow (changed files only, not the whole repo) — a slow pre-commit hook gets bypassed with `--no-verify` out of frustration, which defeats the entire point. Anything that genuinely needs the full codebase (a full test suite, a full build) belongs in CI, not in a pre-commit hook a developer is waiting on for every single commit.

## Semantic versioning and changesets

For any package published/consumed with a version number (an internal `packages/*` package if it's ever published, or the API's own public version), follow semantic versioning meaningfully — a patch bump is a true bug fix with no behavior change a consumer would notice, a minor bump adds capability without breaking anything, and a major bump is the ONLY place a breaking change is allowed to happen. Use a changeset-based workflow (e.g. Changesets) so every PR that changes a published package's behavior is required to explicitly declare its version-bump intent at review time, rather than the bump being guessed after the fact by whoever cuts the release.

## Feature flags

```text
❌ DON'T ship a large, risky feature as one big-bang deploy with no way
   to turn it off independently of a full rollback/redeploy if something
   goes wrong.

✅ DO gate meaningfully risky or large features behind a feature flag,
   so they can be disabled instantly (without a deploy) if a problem
   surfaces, and so they can be rolled out gradually (a percentage of
   users/tenants first) rather than to everyone simultaneously.
```

A feature flag is temporary scaffolding, not a permanent piece of the codebase — once a feature is fully rolled out and stable, remove the flag and the now-dead alternate code path in a follow-up cleanup. A codebase littered with stale, permanently-on feature flags nobody ever cleaned up is its own form of accumulated complexity debt (`00-non-negotiables.md`'s "no dead code" rule applies to flag cleanup too).

## Dependency update automation

Run automated dependency update tooling (e.g. Renovate/Dependabot) so dependency updates arrive as small, individually-reviewable PRs on a regular cadence, rather than accumulating for months and then landing as one enormous, high-risk "update everything" PR that's nearly impossible to review or bisect if something breaks.

## Preview deployments

```text
❌ DON'T — review a frontend PR by reading a diff alone and trusting
   that it "looks right" in your head, for anything involving real UI
   changes.

✅ DO — every PR touching apps/web or apps/mobile (where the mobile
   equivalent is feasible, e.g. an Expo preview build) gets an automatic
   preview deployment, so a reviewer can click through the ACTUAL running
   change rather than imagining it from a diff. This is especially
   important for verifying the responsive/dark-mode/accessibility
   requirements elsewhere in this rule set (03-web-nextjs.md,
   07-ui-system.md) — those are much easier to actually check by looking
   at a live preview than by reading JSX.
```

## Artifact retention

Build artifacts, test reports, and coverage reports produced by CI should be retained for a deliberate, bounded period (long enough to investigate a regression discovered a few weeks later; not indefinitely, which becomes a storage cost with no ongoing value) — set this explicitly in CI configuration rather than accepting whatever the CI provider's undocumented default happens to be.

## Build reproducibility

```text
❌ DON'T — a build that can produce different output from the same
   commit depending on when/where it's run (an unpinned dependency
   version, a build step that reaches out to the network for something
   that should be vendored/locked).

✅ DO — pin dependency versions via the lockfile (committed, never
   gitignored), and treat any build step with non-deterministic output
   as a bug to fix, not an accepted quirk — reproducible builds are what
   make "which exact code is running in production right now" an
   answerable question during an incident, rather than a guess.
```

## What blocks a merge vs what's a warning

```text
BLOCKING (CI fails, PR cannot merge):
- Lint errors (not warnings — see below)
- Type errors
- Any failing test
- Failed build
- A migration that fails to apply cleanly against a copy of production-shaped data
- A detected secret in the diff (via secret-scanning in CI)
- A dependency with a known critical/high vulnerability newly introduced

WARNING (visible in CI output, does not block merge, but should not be
ignored indefinitely):
- A lint WARNING (as opposed to error) — e.g. a complexity-threshold
  warning suggesting a function is getting large
- A bundle-size increase within budget but trending upward
- A coverage decrease that stays above the enforced floor but is moving
  the wrong direction release over release
```

Keep this distinction explicit in the CI configuration itself (which checks are `continue-on-error` vs hard failures) so it's not a matter of individual judgment each time whether something "really" needs fixing before merge.

## Staging environment parity

```text
❌ DON'T — let staging drift meaningfully from production's
   configuration (different database version, different resource
   limits, different feature-flag defaults) to the point that "it
   worked in staging" stops being meaningful evidence that it'll work
   in production.

✅ DO — keep staging as close to a true production mirror as
   practically achievable (same infrastructure versions, same
   scaling/connection-limit configuration proportionally, production-shaped
   — though appropriately anonymized/synthetic, per this document's PII
   guidance elsewhere — data volume), specifically so a staging
   verification is actually predictive of production behavior, not
   theater that happens to run in a different environment name.
```

## Deployment windows and freeze periods

For any change with elevated risk (a major migration, a change to authentication/payment flows), avoid deploying immediately before a period with reduced on-call coverage (late Friday, a holiday) — not because of superstition, but because the actual mean-time-to-recovery for a bad deploy is directly tied to how quickly a fully-staffed, alert team can respond, and that response capacity is exactly what's reduced during those windows. This is a deliberate scheduling decision, documented as project policy, not an individual judgment call made differently by whoever happens to be deploying that day.

## A reference CI pipeline

```yaml
# .github/workflows/ci.yml (illustrative — adapt to your CI provider)
name: ci
on: { pull_request: {}, push: { branches: [main] } }

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres: { image: 'postgres:16', env: { POSTGRES_PASSWORD: test }, ports: ['5432:5432'] }
      redis:    { image: 'redis:7',     ports: ['6379:6379'] }
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }                # needed for --filter=...[origin/main]
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile     # lockfile is law; CI never rewrites it
      - run: pnpm turbo run format:check lint typecheck --filter='...[origin/main]'
      - run: pnpm --filter @repo/database prisma migrate deploy   # migration validation on a clean DB
      - run: pnpm --filter @repo/database prisma db seed          # seed must still run after schema changes
      - run: pnpm turbo run test build --filter='...[origin/main]'
      - run: pnpm audit --audit-level=high      # dependency vulnerability gate
      - uses: gitleaks/gitleaks-action@v2       # secret scanning
```

Note the two database steps: running `migrate deploy` then `db seed` on every PR is what makes "seed.ts must be updated with the schema" **mechanically enforced** rather than a review-time hope — a migration that breaks the seed fails CI.

## Required status checks (branch protection)

`verify` must pass, at least one approving review with no outstanding "request changes," branch up to date with `main`, no force-pushes, no direct commits to `main`. These are configured in the repository settings, not left to individual discipline.

## Release checklist (production)

- [ ] All required checks green on the exact commit being released
- [ ] Migrations reviewed for lock/duration risk and applied in the agreed order (expand before code, contract after)
- [ ] Feature flags set to the intended rollout state
- [ ] Runbooks and alerts exist for anything new operationally
- [ ] Rollback plan stated (app rollback vs roll-forward; DB is not blindly reversible)
- [ ] Someone with authority and time is watching the dashboards for the post-deploy window
- [ ] Mobile: minimum-supported-version and API compatibility with older builds confirmed


## The completion gate — how the commands are wired

The gate is only as strong as what `pnpm run lint` actually checks, so the scripts and the ESLint config are part of the guardrails and are changed only with maintainer review.

```json
// root package.json
{
  "scripts": {
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  }
}
```

```json
// every apps/* and packages/* package.json — same script names everywhere (01-repository-architecture.md)
{
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "test": "vitest run"
  }
}
```

`--max-warnings=0` makes a warning fail the command. A gate that lets warnings through trains everyone to ignore it.

## Reference ESLint configuration

Illustrative flat config (typescript-eslint v8 style). Adapt file names and versions to your setup, then **prove it works with the canary below** rather than trusting it.

```js
// packages/eslint-config/base.mjs
import tseslint from 'typescript-eslint';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';

const FORBIDDEN_SYNTAX = [
  { selector: 'TSUnknownKeyword', message: '`unknown` is forbidden. Parse the value with a zod schema at the boundary (00-non-negotiables.md).' },
  { selector: 'TSNeverKeyword', message: '`never` is only allowed in the shared assertNever helper (00-non-negotiables.md).' },
  { selector: "TSAsExpression[typeAnnotation.typeName.name='const']", message: '`as const` is forbidden. Use a typed tuple or z.enum([...]) (00-non-negotiables.md).' },
  { selector: 'TSTypeAssertion', message: 'Angle-bracket type assertions are forbidden.' },
  { selector: "CallExpression[callee.object.name='z'][callee.property.name=/^(any|unknown|never)$/]", message: 'z.any(), z.unknown(), z.never() are forbidden.' },
  { selector: "CallExpression[callee.property.name=/^(delete|deleteMany)$/][callee.object.object.name=/^(prisma|tx)$/]", message: 'Hard delete is forbidden. Use soft delete (08-database-prisma.md).' },
  { selector: "CallExpression[callee.property.name=/^(delete|deleteMany)$/][callee.object.object.property.name='prisma']", message: 'Hard delete is forbidden. Use soft delete (08-database-prisma.md).' },
];

export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { '@eslint-community/eslint-comments': eslintComments },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: false, allowTypedFunctionExpressions: true }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-magic-numbers': ['error', { ignore: [0, 1, -1], ignoreEnums: true, ignoreNumericLiteralTypes: true, ignoreReadonlyClassProperties: true, ignoreTypeIndexes: true }],
      '@eslint-community/eslint-comments/no-use': ['error', { allow: [] }], // no eslint-disable comments at all
      'no-restricted-syntax': ['error', ...FORBIDDEN_SYNTAX],
    },
  },
  {
    // the ONE place `never` is allowed
    files: ['**/assert-never.ts'],
    rules: { 'no-restricted-syntax': ['error', ...FORBIDDEN_SYNTAX.filter((rule) => rule.selector !== 'TSNeverKeyword')] },
  },
  {
    // test literals are expectations, not configuration; everything else still applies
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: { '@typescript-eslint/no-magic-numbers': 'off' },
  },
);
```

Notes on what this does and does not do:

- `consistent-type-assertions` does not flag `as const`, which is why the explicit selector exists.
- Type-aware rules (`projectService`) are slower. Keep lint fast with Turborepo caching and per-package runs; do not switch them off to gain speed.
- Lint cannot enforce everything. It will not catch a missing authorization guard, a missing test, or a missing `seed.ts` update. Those remain review and CI checks (`01-repository-architecture.md`, "Architecture fitness checks").
- The `delete` selectors are a heuristic and may miss unusual access paths. The retention-purge job is the only allowlisted exception, added per file with a reviewed override, never with an inline comment.
- Configuration changes to this file, `ignores` additions, and rule downgrades are maintainer-reviewed. An AI agent must not make them to get a task green.

## Prove the gate works: a lint canary

A gate that silently stopped checking is worse than none. Keep a fixture of deliberate violations and a test asserting that lint reports every one.

```ts
// packages/eslint-config/canary/violations.ts
// Skipped by the package's normal lint script via the CLI flag ("lint": "eslint . --max-warnings=0 --ignore-pattern canary/"),
// NOT via `ignores` in the config, so the test below can still lint it. Include it in that package's tsconfig for type-aware rules.
export const anyValue: any = 1;
export const unknownValue: unknown = 1;
export const constValue = ['a'] as const;
export function noReturnType(value: number) { return value + 42; }
export class NoModifier { method(): void {} }
export async function hardDelete(prisma: { order: { delete(input: { where: { id: string } }): Promise<void> } }): Promise<void> {
  await prisma.order.delete({ where: { id: 'x' } });
}
```

```ts
// packages/eslint-config/canary.spec.ts
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

describe('lint canary', () => {
  it('reports every forbidden construct', async (): Promise<void> => {
    const eslint = new ESLint();
    const [result] = await eslint.lintFiles(['canary/violations.ts']);
    const ruleIds = result?.messages.map((message) => message.ruleId) ?? [];
    expect(ruleIds).toContain('@typescript-eslint/no-explicit-any');
    expect(ruleIds).toContain('@typescript-eslint/explicit-function-return-type');
    expect(ruleIds).toContain('@typescript-eslint/explicit-member-accessibility');
    expect(ruleIds).toContain('no-restricted-syntax'); // unknown, as const, hard delete
    expect(ruleIds).toContain('@typescript-eslint/no-magic-numbers');
  });
});
```

If the canary test fails, the gate is broken. Fix the config before doing anything else.

## Enforcing the gate outside the AI tool

Prompts and rule files ask an agent to run the gate; they cannot force it. Add enforcement that does not depend on which tool wrote the code:

- **CI required check:** the `verify` job runs lint and test; branch protection blocks merge on failure. This is the real gate for every tool.
- **Git hook:** a `pre-push` hook (husky) that runs `pnpm run lint && pnpm run test`, so a broken push fails before it leaves the machine. Keep `pre-commit` fast and narrow (staged files only).
- **Tool-level hooks (optional):** some agent tools can run a command when the agent tries to finish and send failures back to it (Claude Code supports hooks in `.claude/settings.json`). Check the tool's current documentation for the exact configuration, and treat this as a bonus on top of CI, not a replacement.
