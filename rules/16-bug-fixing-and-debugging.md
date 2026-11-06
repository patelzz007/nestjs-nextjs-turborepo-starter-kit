# 16A — Bug Fixing and Root-Cause Debugging

> This document supplements `33-code-review-checklist.md`. It does not replace the numbered code-review rule or change existing precedence. The agent must load this file for bugs, regressions, flaky tests, performance defects, and unexplained operational failures.

## 1. Purpose and operating principle

A bug report describes an observation. It does not prove the cause. The agent's job is to identify the violated invariant, correct it at the owning layer, and demonstrate that the original failure is prevented. The fastest visible patch is not necessarily the correct fix.

**Root cause** is the underlying defect or incorrect assumption that makes the system violate its intended contract. **Trigger** is the input, timing, state, deployment, or environment that exposes it. **Symptom** is what a user or monitoring system observes. **Contributing condition** makes the defect more likely or more severe. Keep these concepts distinct in diagnosis and reporting.

## 2. Required diagnostic record

Before editing behavior, capture a compact diagnostic record:

- Exact observed behavior, including error text/status and affected operation.
- Expected behavior, grounded in acceptance criteria, contracts, ADRs, tests, or confirmed product requirements.
- Reproduction steps, input/state, environment, and frequency.
- Scope: affected users, tenants, roles, platforms, versions, and time window where known.
- Evidence collected: logs, traces, network requests, database state, queue state, runtime configuration, source path, and test output as relevant.
- Relevant code path and ownership boundary.
- Hypotheses ranked by evidence, with a test that would distinguish each plausible cause.

Do not invent expected behavior when the product contract is unclear. Ask for clarification if different interpretations imply different outcomes.

## 3. Investigation sequence

### 3.1 Reproduce and minimize

1. Reproduce the failure using the narrowest reliable path.
2. Preserve the original failing input and relevant state.
3. Reduce unrelated variables without removing the condition that triggers the defect.
4. Determine whether the failure is deterministic, intermittent, environment-specific, data-dependent, concurrency-dependent, or deployment-dependent.
5. If it cannot be reproduced, inspect production-safe evidence and construct the closest deterministic test. State the limits of that reproduction.

### 3.2 Trace end to end

Trace from the initiating boundary to the observed failure. Depending on the system, this may include:

- UI event, route, server/client component boundary, query/mutation, and API request.
- HTTP route, authentication, authorization, validation, application service, domain policy, repository, transaction, and database constraint.
- Outbox, broker, consumer, retry, dead-letter path, and downstream side effect.
- Job enqueue, serialization, tenant context, worker execution, idempotency, and result persistence.
- Object-storage upload, signed URL, multipart completion, metadata persistence, and download authorization.
- Build tool, package resolution, installed dependency version, config loading, and runtime environment.

At each boundary ask: what enters, what contract validates it, what state is trusted, what invariant must hold, what can fail, and how is failure represented?

### 3.3 Inspect evidence, not just code

- Read the implementation and its callers, not just the stack-trace line.
- Read the relevant tests and identify what they do not cover.
- Inspect actual runtime/configuration values without exposing secrets.
- Compare a known-good and failing case where possible.
- Check recent changes and dependency/version drift when relevant.
- Use installed package documentation and source when version-specific behavior matters.
- Redact credentials, tokens, personal data, and tenant-sensitive values before displaying logs or artifacts. Never paste secrets into reports, test fixtures, shell history, or generated files.

### 3.4 Test hypotheses deliberately

For each plausible hypothesis, define the smallest observation or experiment that would confirm or falsify it. Change one variable at a time where practical. Do not make multiple speculative code changes and then attribute success to whichever one appears relevant.

Do not confuse correlation with cause. A failure occurring after a deployment does not prove the deployment caused it; a stack trace ending in a repository does not prove the repository owns the defect; a frontend error does not prove the frontend is the correct fix location.

## 4. Root-cause classification

Classify the defect before selecting a fix. Examples include:

- Contract defect: invalid, incomplete, duplicated, or mismatched request/response/event schema.
- Ownership defect: behavior implemented in the wrong layer or bounded context.
- Domain invariant defect: invalid state transition or missing business rule.
- Authorization defect: missing or incorrect permission, ownership, relationship, or policy check.
- Tenant isolation defect: missing or untrusted tenant context, unscoped relation/query/cache/job/file, or RLS transaction leak.
- Persistence defect: incorrect transaction boundary, constraint, migration, query, mapping, or soft-delete behavior.
- Concurrency defect: race, lost update, duplicate side effect, lock misuse, or missing conditional write.
- Async defect: delivery semantics, ordering, retry, idempotency, outbox, acknowledgement, or poison-message handling.
- State ownership defect: duplicated server state, stale cache, invalidation gap, or incorrect client state transition.
- Runtime/configuration defect: wrong environment variable, package version, module resolution, build configuration, or startup lifecycle.
- Resource/performance defect: unbounded work, N+1, missing index, leak, contention, or backpressure failure.
- Observability defect: failure is hidden, misclassified, or lacks enough safe evidence to diagnose.

Multiple categories may contribute. Name the primary root cause and list contributing causes separately.

## 5. Selecting the correction

A valid correction:

1. Restores the intended contract or invariant.
2. Lives in the layer that owns that contract or invariant.
3. Handles the relevant boundary and failure modes, not only the exact reproduction string.
4. Preserves authorization, tenant isolation, validation, audit, soft-delete, concurrency, idempotency, and transaction requirements.
5. Avoids introducing hidden coupling or a new special case in unrelated callers.
6. Is compatible with existing consumers or includes a documented migration/versioning plan.
7. Is observable enough to detect recurrence without leaking sensitive information.

Do not:

- Catch and ignore an exception merely to make the request succeed.
- Return a fake success, empty object, default tenant, or fabricated record when the real operation failed.
- Add retries to a non-idempotent operation without proving duplicate side effects are impossible.
- Add arbitrary delays, sleeps, polling loops, or timeout increases without evidence that timing is the root cause and a bounded design is correct.
- Add frontend validation as a substitute for backend validation.
- Add a tenant fallback that can select another tenant or a global data scope.
- Disable a test, lint rule, authorization guard, RLS policy, constraint, or type check.
- Add a provider-specific exception branch in a domain layer to work around an adapter defect.
- Keep both the broken path and a new alternate path indefinitely without an explicit migration/removal plan.

## 6. Regression testing

The regression test should encode the invariant, not merely repeat the old implementation's internal details.

- First prefer a test that fails on the pre-fix code. Use a red/green sequence where practical.
- Test the public behavior at the narrowest layer that proves the contract.
- Add lower-level tests for domain/policy logic when the defect is in that logic.
- Add integration tests when the failure crosses persistence, transactions, queue, auth, or framework boundaries.
- For authorization and tenancy, include both allowed and denied cases, including cross-tenant access where applicable.
- For concurrency, test competing operations and assert the invariant (not just that both promises resolve).
- For async retries, test duplicate delivery and idempotent outcomes.
- For a flaky test, determine whether product behavior or test synchronization is wrong. Do not add sleeps as a substitute for deterministic synchronization.
- Preserve meaningful assertions. A test that passes because the failing behavior is mocked away is not a regression test.

If the original defect cannot be represented in an automated test, explain why and provide the strongest available repeatable verification, such as a focused integration procedure, captured trace comparison, or controlled manual test. Do not claim equivalent confidence.

## 7. Special cases

### Production incidents and temporary mitigations

A mitigation may be appropriate to reduce immediate harm, but it is not the permanent fix unless it corrects the root cause. Record scope, risk, owner, expiry/review date, monitoring, rollback, and the linked permanent work. Never expose secrets or sensitive tenant/user data in incident artifacts.

### Security and data-integrity defects

Stop any action that could worsen exposure or corrupt data. Do not test against production by performing destructive actions. Use authorized, isolated data. Preserve evidence safely. Escalate uncertain authorization, deletion, payment, and tenant-boundary decisions to a human.

### Flaky tests

Classify whether nondeterminism comes from the system, test isolation, shared mutable state, scheduling, external dependencies, time, randomness, or an invalid assumption. Stabilize the actual cause. Do not retry-until-green, quarantine, `.skip`, or weaken assertions as a default response.

### Performance regressions

Establish a baseline and representative workload. Measure before optimizing. Identify the dominant cost and the affected SLO/operation. Avoid caching or parallelizing before understanding consistency, invalidation, tenant scoping, resource limits, and backpressure. Verify the improvement with comparable measurements.

### Dependency/runtime regressions

Confirm the resolved package version and runtime. Read the installed version's documentation/source. Do not apply a fix copied from a different major version without verifying compatibility. Preserve lockfile discipline and explain dependency changes.

## 8. Completion report for a bug

```markdown
### Observed behavior
- Actual:
- Expected:
- Reproduction/evidence:

### Diagnosis
- Root cause:
- Violated invariant/contract:
- Trigger and contributing conditions:
- Evidence supporting the diagnosis:

### Correction
- Owning layer:
- What changed:
- Why this fixes the cause rather than masking the symptom:

### Regression coverage
- Test(s) added/changed:
- Why they fail on the original defect:
- Adjacent cases checked:

### Verification
- Exact commands and results:
- NOT VERIFIED items and reason:

### Remaining risk
- Known uncertainty, mitigation expiry, or follow-up:
```

## 9. Final diagnostic checklist

- [ ] I can describe the expected and actual behavior without hand-waving.
- [ ] I reproduced or documented why reproduction is unavailable.
- [ ] I traced the full relevant execution path.
- [ ] I separated symptom, trigger, contributing conditions, and root cause.
- [ ] I tested the leading hypothesis rather than guessing.
- [ ] The fix is in the owning layer.
- [ ] No workaround hides a failure or weakens a platform invariant.
- [ ] A meaningful regression test covers the original defect.
- [ ] Security, tenant, data, concurrency, idempotency, and operational effects were considered.
- [ ] Required checks passed after the final edit, or are reported NOT VERIFIED.
- [ ] The report accurately describes evidence and remaining uncertainty.
