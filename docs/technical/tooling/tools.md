---
title: "Tooling reference"
description: "Every tool in packages/tooling, who runs it, the settings it reads, and the config files that keep their own format."
author: "Platform Team"
lastUpdated: 1793923200000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
order: 20
tags: ["tooling"]
---

# Tooling reference

Every tool lives in `packages/tooling/src/<tool>/` as an engine, a `cli.ts` and `__tests__/`, and runs on Node directly.
Tools that only fit this starter's architecture are in `src/starter/`. This repository's own values are in the root
`tooling.config.ts`. A test fails when a tool exists that this page doesn't list.

## Tools

| Entry point (in `packages/tooling/src/`) | What it does | Who runs it | Settings it reads |
|---|---|---|---|
| `api-ci-env/cli.ts` | Writes the API env file CI and `ci:local` use. | GitHub CI, `ci:local` | `ports` |
| `app-secrets/cli.ts` | Generates app secrets, or adds them to an env file. | You | — |
| `bundle-budget/cli.ts` | Checks bundle sizes against `budgets/bundle.json`. | GitHub CI, you | `budgets`, `nextApps` |
| `ci-changes/cli.ts` | Decides whether a pull request touches anything but documentation. | GitHub CI | — |
| `ci-local/cli.ts` | Runs CI's jobs on this machine. | You | `folders`, `workspaces`, `ports`, `artifacts` |
| `dependency-exceptions/cli.ts` | Checks dated dependency exceptions. | GitHub CI | — |
| `deploy/gate-cli.ts` | Gates a deploy on the previous release. | Deploy | `deploy` |
| `deploy/release-cli.ts` | Activates a release on the server. | Deploy | `deploy` |
| `dev-timing/cli.ts` | Measures how fast `pnpm dev` comes up. | You | `ports`, `workspaces`, `artifacts` |
| `env-example-secrets/cli.ts` | Fails when a `.env.example` holds a real secret. | GitHub CI, `ci:local` | `envExampleFiles` |
| `load-baseline/cli.ts` | Runs the load test and checks it against `budgets/load.json`. | Nightly CI | `budgets`, `ports` |
| `migration-history/cli.ts` | Fails when committed migration history changes. | GitHub CI, `ci:local` | `migrations` |
| `playwright-in-docker/cli.ts` | Runs a Playwright suite in Playwright's Linux image. | You, `ci:local`, GitHub CI | — |
| `playwright-in-docker/docker-forward-and-run.ts` | Forwards ports inside that container. | Inside the container | — |
| `pre-push/cli.ts` | The git pre-push check. | Git hook | — |
| `project-identity/cli.ts` | Applies or checks `project.json` everywhere. | You | `folders` |
| `run-in-workspace/cli.ts` | Runs a command inside a workspace (lint-staged). | Git hook (lint-staged) | — |
| `starter/certification-check/cli.ts` | Checks a sample field went through every layer. | You | — |
| `starter/mobile-cold-start/cli.ts` | Measures the Android cold start. | Nightly CI | — |
| `starter/mobile-device-tests/cli.ts` | Runs the Maestro flows on a device. | Nightly CI, you | — |
| `starter/mobile-route-types/cli.ts` | Writes the mobile app's route types, or checks them with `--check`. | You | `folders` |
| `starter/mobile-readme-screenshots/cli.ts` | Retakes the README's phone screenshots. | You | — |
| `starter/scaffold-context/cli.ts` | Creates a new bounded context. | You | — |
| `tools/cli.ts` | The `pnpm tools` menu. | You | `tools` |
| `wait-for-http/cli.ts` | Waits until URLs answer. | GitHub CI, `ci:local` | — |
| `watch-runner/cli.ts` | Runs package watchers together. | `pnpm dev` | — |

`pnpm tools` lists the occasional commands; their names and commands are `tools` in `tooling.config.ts`.

## Not converted yet

`apps/docs/scripts/capture-api-samples.mjs` is still JavaScript: 1,500 lines of untyped API responses need real schemas.

## Config files that keep their own format

| File | What it is for |
|---|---|
| `postcss.config.mjs` (×4) | Tailwind's build step in each web app and the docs site |
| `rspack.config.mjs` | The API's bundler |
| `jest.resolver.cjs` (×2) | Jest's module resolution for the mobile app and `packages/ui-native` |
| The Babel config | Expo's transform for the mobile app |
| `lint-staged.config.mjs` | Which checks run on staged files |
