---
title: "Dependency Hygiene (syncpack)"
tags: ["dependencies", "syncpack", "tooling"]
description: "How syncpack keeps shared dependencies on the exact same version across every workspace."
order: 7
author: "Platform Team"
lastUpdated: 1792886400000
coverImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80"
---

# Dependency Hygiene (syncpack)

> [!NOTE] How this monorepo keeps shared dependencies **on the exact same version** across
> all workspaces, so "works in web, breaks in admin" bugs never happen.
> Written for a junior developer with 6 months of experience.

---

## Table of Contents

1. [Why we need this](#1-why-we-need-this)
2. [What syncpack does](#2-what-syncpack-does)
3. [The config (`.syncpackrc.json`)](#3-the-config-syncpackrcjson)
4. [Commands](#4-commands)
5. [How to update a shared dependency](#5-how-to-update-a-shared-dependency)

---

## 1. Why we need this

This monorepo has **10 `package.json` files** (root, `apps/api`, `apps/web`,
`apps/admin`, `packages/shared`, `packages/ui`, `packages/client`,
`packages/tooling`, plus the `oxlint-config` and `typescript-config` packages). If
someone bumps `zod` to
`4.5.0` in `apps/web` but leaves `^4.4.3` in `apps/admin`, the two apps ship
**different Zod versions**. That causes confusing bugs:

- A schema validates in the admin app but fails in the web app.
- Types disagree between FE apps even though they import the same shared package.

**The rule we enforce:** shared dependencies (`react`, `react-dom`, `zod`,
`typescript`, `next`) must be the **exact same version, written the exact same way**
(pinned, no `^` or `~`) in every workspace that uses them.

---

## 2. What syncpack does

[syncpack](https://syncpack.dev) is a CLI that reads **all** `package.json` files
in the repo and compares how each dependency is declared:

- **`syncpack lint`** — scans for drift and **exits with code 1** if any is found.
  This is what a CI pipeline runs to fail the build on drift.
- **`syncpack fix-mismatches`** — rewrites `package.json` files to the correct
  version so the drift is fixed automatically.
- **`syncpack list`** — prints every dependency version per workspace.

---

## 3. The config (`.syncpackrc.json`)

The config lives at the **repo root** in `.syncpackrc.json`:

```json title=".syncpackrc.json"
{
	"$schema": "https://unpkg.com/syncpack@15.3.3/dist/schema.json",
	"versionGroups": [
		{
			"label": "Shared deps must be the same version across all workspaces",
			"dependencies": ["react", "react-dom", "zod", "typescript", "next"],
			"packages": ["**"],
			"policy": "sameRange"
		}
	],
	"semverGroups": [
		{
			"label": "Shared deps are pinned to exact versions (no ^ or ~)",
			"dependencies": ["react", "react-dom", "zod", "typescript"],
			"packages": ["**"],
			"range": ""
		}
	]
}
```

Two rules are configured:

1. **`versionGroups` → `policy: "sameRange"`** — for the 5 listed dependencies,
   every workspace must declare **the same version string**. If one workspace
   drifts to a different version, `deps:check` fails.
2. **`semverGroups` → `range: ""`** — for `react`, `react-dom`, `zod`, and
   `typescript`, the version must be **exact** (no `^` / `~` prefix). This is the
   "pin" part — floating ranges are banned for shared deps.

> [!NOTE] Why `range: ""`? An empty range means "no semver range allowed" — syncpack
> rejects `^4.4.3` and accepts `4.4.3`.

**Peer ranges are not pinned.** A `peerDependencies` range says what a *consumer* may provide
(`react: ">=19.0.0"`, `react: "*"`), so forcing it to equal the exact dev version would reject
valid consumers. The first version group in `.syncpackrc.json` ignores the `peer` dependency
type; instead `deps:check` runs **`pnpm peers check`**, which proves every peer range accepts the
version the workspace actually installs. (An accepted mismatch is recorded, with its reason, in
`peerDependencyRules` in `pnpm-workspace.yaml`.)

**One `@types/pg`.** `pnpm-workspace.yaml` overrides `@types/pg` to one exact version for the whole
tree (the adapter's and the app's `Pool` must be the same declarations), and a pinned version
group makes every workspace declare that same exact version. Bump the override and the pin
together.

**One TypeScript exception: `apps/docs`.**

The real `.syncpackrc.json` has an earlier version group (shown in the file, omitted above) that
pins `typescript` to `6.0.3` for `@workspace/docs` only: `astro check` runs on Volar, which needs
the TypeScript JS API that TypeScript 7 removed. Every other workspace declares the same exact
TypeScript 7 version. See `docs/technical/tooling/typescript.md` → "TypeScript 7, and the two
places TypeScript 6 remains".

---

## 4. Commands

Run from the **repo root**:

| Command           | What it does                                                     | Exit code                                 |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| `pnpm deps:check` | Lint all versions/ranges against the config. Prints drift if any | `0` = clean, `1` = drift found (fails CI) |
| `pnpm deps:fix`   | Auto-align all `package.json` files to the configured versions   | —                                         |
| `pnpm deps:list`  | Show every dependency version per workspace                      | —                                         |

Examples:

```bash
# Check for drift (CI-safe — exits 1 on problems)
pnpm deps:check

# Auto-fix drift, then verify
pnpm deps:fix
pnpm deps:check
```

> [!NOTE] **`deps:check` / `deps:fix` / `deps:list` ARE turbo tasks.** turbo 2.x does not
> execute scripts defined only in the **root** `package.json` (it would report
> "0 tasks"), so the commands live in the **`packages/tooling`** workspace, and each one
> starts with `cd ../..`: syncpack discovers the workspace and `.syncpackrc.json` from its
> working directory, and run inside `packages/tooling` it saw only that one package (the check
> passed while drift sat everywhere else). `__tests__/deps-check-coverage.test.mjs` in
> `packages/tooling` proves it now sees every workspace manifest and the pnpm overrides.
>
> ```bash
> pnpm deps:check          # → turbo run deps:check → cd ../.. && syncpack lint && pnpm peers check
> pnpm turbo run deps:check   # same thing, invoked directly through the pipeline
> ```

---

## 5. How to update a shared dependency

To bump a shared dependency (e.g. `zod`):

1. **Find the current version** everywhere it's used:
   ```bash
   grep '"zod"' apps/*/package.json packages/*/package.json package.json
   ```
2. **Update every occurrence to the new exact version** (no `^`):
   ```bash
   pnpm --filter ... add zod@4.5.0        # or edit each package.json
   ```
3. **Install & verify no drift:**
   ```bash
   pnpm install
   pnpm deps:check
   ```
4. If syncpack reports drift you didn't intend to keep, use `pnpm deps:fix`.

> [!NOTE] **Non-shared dependencies** (e.g. `@nestjs/common`, `lucide-react`) may use carets —
> only the 5 deps in `.syncpackrc.json` are pinned exact — but syncpack's default group still
> requires every workspace that uses one to declare the **same** range.

---

_Last updated: October 25, 2026_

