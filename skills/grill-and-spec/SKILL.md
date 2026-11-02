# Skill: Grill Requirements into a Shared Specification

## When to use
Use when the request is broad, ambiguous, internally contradictory, or contains unresolved product/architecture choices. Do not use it to ask the user questions that repository inspection can answer.

## Separate facts from decisions
- Facts are discovered by inspecting code, ADRs, installed package docs, tests, configuration, and authoritative external sources.
- Decisions are choices about product behavior, UX, policy, risk tolerance, compatibility, and architecture that are not already settled by the repository.
- Hypotheses are uncertain technical explanations that require experiments.

Never answer a product decision autonomously merely because one option seems technically convenient. Never ask the user to supply a repository fact that can be looked up.

## Workflow

1. Restate the outcome being sought, not merely the proposed implementation.
2. Inspect the repository and collect facts before asking questions.
3. Identify ambiguity branches that materially change the solution.
4. Ask one focused question at a time, with concrete options and consequences where useful.
5. Challenge hidden assumptions, edge cases, roles, tenant boundaries, failure states, lifecycle, and operational constraints.
6. Continue until success criteria, scope, ownership, key decisions, and failure behavior are sufficiently explicit.
7. Summarize the shared understanding in a concise spec: problem, actors, behavior, acceptance criteria, constraints, non-goals, decisions, open risks, and affected boundaries.
8. Stop at the confirmation gate. Do not implement until the human confirms the shared understanding when the workflow was invoked to resolve material ambiguity.

## Quality bar
A spec must be testable. Replace “fast”, “secure”, “generic”, “easy to use”, and “scalable” with observable criteria or explicit design constraints. Do not fill unresolved decisions with invented defaults. Record deferred decisions with an owner and the point at which they must be resolved.
