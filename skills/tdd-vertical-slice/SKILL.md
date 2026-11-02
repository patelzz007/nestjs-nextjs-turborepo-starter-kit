# Skill: Test-Driven Vertical Slice

## When to use
Use for new behavior, feature changes, contract changes, and bug fixes where a failing regression test can be established. Read `15-feature-development-process.md`, `11-testing-vitest.md`, and all domain-specific rules first.

## Workflow

1. **Understand:** state the user outcome, current behavior, expected behavior, acceptance criteria, and non-goals.
2. **Orient:** inspect router, rules, git status, installed versions, existing patterns, consumers, contracts, and tests.
3. **Map ownership:** identify domain/context, API boundary, schema, auth, tenant, persistence, async, client state, and UI owners.
4. **Design:** select the smallest correct vertical slice. Identify the seam and stable contract. Avoid speculative abstractions.
5. **Red:** write a test for one acceptance criterion and run it. Confirm it fails for the intended reason.
6. **Green:** implement only enough to satisfy the criterion while preserving all non-negotiables. Run the same test.
7. **Refactor:** improve names, cohesion, duplication, and boundaries without changing behavior. Keep tests green.
8. **Extend:** add negative, boundary, permission, tenant, concurrency, retry, and failure-path cases according to risk.
9. **Integrate:** complete the vertical slice through the actual boundaries; do not leave disconnected scaffolding.
10. **Verify:** run focused suites, affected typecheck/build/integration checks, and root completion gate after the last edit.
11. **Review:** inspect diff for standards and specification independently.
12. **Report:** list acceptance criteria, files, decisions, tests/results, docs, risks, and NOT VERIFIED items.

## Test quality rules
- Assert externally meaningful behavior and invariants, not incidental private call sequences.
- Use deterministic fixtures and synchronization.
- Do not weaken assertions, skip tests, or mock the system under test into success.
- Keep test setup proportionate and reusable only when it has real shared value.
- A passing test that never exercises the requirement is not evidence of correctness.

## Slice sizing
A slice should be independently understandable and verifiable. If a change spans API, database, and UI, define a contract first and integrate one behavior path end to end. Do not parallelize tightly coupled work before contracts and ownership are settled.
