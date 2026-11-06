# Load runner (`@workspace/load-runner`)

Takes load tests from the API's `operations.load-test` queue (BullMQ) and drives them with
[k6](https://k6.io), one run at a time, never inside the API it measures
([ADR 068](../../docs/adr/068-platform-operations-console.md)). It reports every second's
requests, failures and p50/p95/p99, and each scenario step's totals, back to the API, which records
them for the Operations console's **Load tests** screen.

| File | What it does |
| --- | --- |
| `src/main.ts` | The BullMQ worker: writes the run's script and plan, starts k6, reads its output |
| `src/run-load-test.ts` | One run, start to finish (k6, the file system, the clock and the stop flag are injected) |
| `src/k6-config.ts` | A queued job → the plan k6 reads (target, stages, scenario weights, users) |
| `src/k6-script.ts` | The k6 script: the scenarios, each request tagged with its **step** |
| `src/results.ts` | k6's JSON output → per-second points, per-step stats, totals |
| `src/env.ts` | Its configuration: `REDIS_URL`, `BULLMQ_PREFIX`, `LOAD_TEST_TARGET_URL`, `K6_BINARY`, `K6_VERBOSE` |

## Running it

| Where | How |
| --- | --- |
| Local, Docker (k6 inside the image) | `pnpm load-runner`, and `LOAD_TESTING_ENABLED=true` in `apps/api/.env` |
| Local, no Docker | Install k6, then `REDIS_URL=redis://localhost:6379 pnpm --filter @workspace/load-runner start` |
| A droplet | The `load-runner` target of `infra/docker/Dockerfile` |

Start runs from the admin panel (**Operations → Load tests**, Platform Developer or SuperAdmin), or
with `pnpm tools load:run` (below).

## The nightly load-test gate (enhancement 3.9)

`.github/workflows/load-nightly.yml` runs every night at 20:00 UTC (and on demand, *Run workflow*):

1. A CI-sized deployment on one GitHub runner (4 vCPU): the API built for production, PostgreSQL
   18.6 and Redis 8.10.1 as service containers, seeded with the `development` scenario, plus this
   runner with k6 (the same release as the Docker image, checksum-verified).
2. `pnpm tools load:run` signs in as the seeded Platform Developer (`developer@example.com`) on the
   admin client and starts **`budgets/load.json`'s run** through the API, exactly as an operator
   would: the API provisions the Load Test tenant, queues the run, and this runner drives it. The
   run's detail (`GET /admin/operations/load-tests/:runId`) is saved to `.artifacts/ci/load-baseline.json`.
3. `pnpm tools load:check` compares it with `budgets/load.json` and fails the job on a regression.
   The table goes to the job's summary; the results, the API log and the runner log are kept as an
   artifact for 30 days.

### What it checks

The run is a traffic mix of every scenario (`run` in `budgets/load.json`: 5 iterations per second
for 2 minutes with 20 virtual users, ~13 requests/s — kept well below what the runner saturates at,
so the p95s measure the service and not a queue). Each scenario step belongs to one **endpoint
group**:

| Group | Steps | Endpoints |
| --- | --- | --- |
| `auth` | `login`, `session` | `POST /auth/login`, `GET /auth/me` |
| `marketplace` | `marketplace`, `marketplace-page-2`, `reward` | `GET /rewards`, `GET /rewards?page=2`, `GET /rewards/:id` |
| `claims` | `claim`, `my-claims` | `POST /claims`, `GET /claims` |
| `merchant` | `tenant-context`, `rewards`, `analytics`, `tenant-rewards`, `tenant-reward` | `GET /tenants/:slug/{context,rewards,rewards/:id,analytics}` |

| A run fails when… | Why |
| --- | --- |
| Any step's p95 is over its group's `p95Ms` | The latency regression the gate exists for |
| A group's failed requests are over its `maxErrorPercent` | A 5xx or a refused request is a regression, however fast |
| A group carried fewer than `minRequests` | Too little traffic to mean anything (a scenario that stopped working) |
| The whole run is over `total.p95Ms` / `total.maxErrorPercent` | Also the run's own pass/fail thresholds in the console |
| A step is in no group | A new step must be put in a group (`load-baselines.spec.ts` checks the file against the scenarios too) |
| The run did not finish measuring (`ABORTED`, `ERROR`) | Nothing to compare |

Error ceilings and minimum traffic are policy (set by hand); only the p95s are measured.

### Recalibrating the thresholds

A GitHub runner is not production, and its timings vary from night to night, so every p95 threshold is
**the p95 measured on the nightly runner × `calibration.factor` (2)**, rounded up to 10 ms. The factor
absorbs the runner's noise; a real regression (an N+1 query, a missing index, a lock) moves a p95 by
much more than 2×.

1. Open a green (or only-too-slow) nightly run, download its artifact, and take `load-baseline.json`.
2. `pnpm tools load:check -- --results load-baseline.json --write-baseline --source "load-nightly run <id>"`
   rewrites every `p95Ms` from it and records the date and source in `calibration`. It refuses a run
   with errors, too little traffic or unknown steps: that run is not a baseline.
3. Review the diff and commit it. Recalibrate after a deliberate change in cost (a new feature on a
   hot path, a dependency major), never to make a regression pass.

> **Temporary (provisional) thresholds.** The committed values are `calibration.provisional: true`:
> they come from one run on a developer laptop that was also running the full dev stack (see `calibration`),
> not from the CI runner. Owner: whoever lands the first green nightly. Expiry: that first green
> nightly — recalibrate from its artifact (step 2, without `--provisional`), which sets `provisional`
> to `false`.

To run the gate yourself against a throwaway database (never your dev database: the run provisions
the Load Test tenant), start an API with `LOAD_TESTING_ENABLED=true` and Redis, start this runner on
the same `BULLMQ_PREFIX`, then:

```bash
pnpm tools load:run -- --api-url http://localhost:8080 --out .artifacts/ci/load-baseline.json
pnpm tools load:check -- --results .artifacts/ci/load-baseline.json
```

When the runner and `load:run` share an address (one machine), set `RATE_LIMIT_EXEMPT_CIDRS=127.0.0.1/32,::1/128`
on that API: k6's traffic is never refused but still counts against the address's pre-auth limit,
which would otherwise refuse the poller.

## Tests

`pnpm --filter @workspace/load-runner test` (Vitest, with coverage floors). The gate's comparison,
report and recalibration are tested in `packages/tooling/src/load-baseline/__tests__/load-baselines.test.ts`,
and the driver against a fake API in `load-baseline-run.test.mjs`.
