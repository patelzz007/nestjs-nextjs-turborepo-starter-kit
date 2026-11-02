# Skill: Independent Two-Pass Code Review

## When to use
Use after implementation and before declaring a non-trivial change complete. Read `16-code-review-checklist.md` and all applicable rules. Review the diff from a fixed base (the task's starting commit or agreed merge base), not just the last file edited.

## Pass 1: Standards
Review architecture, ownership, package dependencies, type safety, Zod contracts, security, authorization, tenancy, audit, persistence, concurrency, idempotency, errors, performance, observability, tests, docs, genericity, and extensibility.

Report findings with severity, exact file/line, violated rule or invariant, concrete impact, and a specific correction. Distinguish blocking violations from judgement calls. Repository rules override general style preferences.

## Pass 2: Specification
Read the original request and acceptance criteria independently of the implementation summary. For every criterion, identify evidence in code/tests/manual verification. Find omissions, accidental scope changes, incorrect edge cases, and behavior that was not requested.

## Review discipline
- Do not assume the author's explanation is correct; inspect the code and tests.
- Do not report speculative smells as certain bugs.
- Do not invent issues to fill a quota.
- Do not silently fix unrelated code during review.
- Do not claim an independent reviewer/subagent was used unless one actually was.
- Check whether regression tests fail on the pre-fix behavior.
- Reconcile findings with ADRs and precedence rules.

## Output
1. Blocking findings.
2. Important non-blocking findings.
3. Judgement calls / design opportunities.
4. Acceptance-criteria coverage.
5. Verification status and unverified areas.
6. Overall recommendation: approve, request changes, or unable to assess.
