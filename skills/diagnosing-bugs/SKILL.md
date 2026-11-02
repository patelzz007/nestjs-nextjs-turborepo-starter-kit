# Skill: Diagnose Bugs at the Root Cause

## When to use
Use for bugs, regressions, flaky tests, performance regressions, production incidents, and unexplained failures. Read `rules/16-bug-fixing-and-debugging.md` first. This skill is a workflow, not permission to bypass any repository rule.

## Outcome
Produce a verified correction at the owning layer, a regression test, and an evidence-based report. If root cause cannot be established, produce a diagnosis and next experiment, not a speculative permanent patch.

## Workflow

### 1. Orient
- Read `AGENTS.md`, `00-non-negotiables.md`, the debugging rule, and the relevant domain rules.
- Inspect git status. Preserve all pre-existing changes.
- Identify installed package versions and relevant runtime environment.
- Find the issue's originating report, expected behavior, contracts, and recent relevant changes.

### 2. Reproduce
- Write exact steps, inputs, state, environment, expected output, and actual output.
- Reproduce with the smallest reliable test or manual procedure.
- Save the failure signal, but redact secrets and sensitive user/tenant data.
- If it is intermittent, characterize frequency and triggering conditions rather than adding sleeps or blind retries.

### 3. Minimize and trace
- Reduce unrelated variables while preserving the trigger.
- Trace the path from entry boundary to symptom.
- Inspect callers, tests, schemas, logs/traces, DB state, queue/job state, configuration, and installed dependency docs as applicable.
- Identify the violated contract/invariant and the layer that owns it.

### 4. Hypothesize and test
- List plausible causes, ranked by evidence.
- For each leading cause, define a discriminating experiment.
- Change one variable at a time where practical.
- Do not treat a stack-trace location or temporal correlation as proof of cause.

### 5. Establish regression coverage
- Add a test that fails on the original behavior for the intended reason.
- Prefer a public contract test; add lower-level tests for domain logic and integration tests for cross-boundary behavior.
- Include denied/cross-tenant, concurrency, retry, or failure cases when relevant.
- Never mock away the behavior under investigation.

### 6. Correct the owning layer
- Restore the invariant where it belongs.
- Avoid caller-side compensating logic, silent catch blocks, fake success, arbitrary delays, and unbounded retries.
- Preserve auth, validation, tenant isolation, audit, soft delete, transactions, idempotency, and observability.
- If only a mitigation is safe now, label it as mitigation with owner, expiry/review date, monitoring, rollback, and permanent follow-up.

### 7. Verify and report
- Run focused regression tests, relevant suites, and repository completion gates after the final edit.
- Inspect the complete diff and adjacent consumers.
- Report observed/expected behavior, root cause, evidence, correction, test coverage, exact commands/results, and remaining uncertainty.

## Stop conditions
Stop and ask for human input if expected behavior is ambiguous, the root cause remains uncertain and a change would guess, production data could be harmed, security/tenant controls would change, or an irreversible action lacks authorization.

## Redaction
Before showing logs, commands, traces, request/response samples, or captured artifacts, redact tokens, passwords, cookies, API keys, personal data, and tenant-sensitive identifiers. Preserve only the signal needed to diagnose. Never place secrets in test fixtures, shell history, or reports.
