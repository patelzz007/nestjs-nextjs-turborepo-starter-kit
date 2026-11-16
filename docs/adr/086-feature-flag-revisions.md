---
title: "ADR 086: Feature Flag Revisions"
tags: ["adr", "feature-flags", "audit"]
description: "A feature flag's or dynamic config's rules are saved as unchangeable flag revisions, never edited in place, so history, diffs, rule promotion, approvals and exposures all point at one exact rule set."
author: "Platform Team"
category: "Architecture decisions"
date: 1794528000000
lastUpdated: 1794528000000
editedAt: 1794528000000
coverImage: "/images/covers/adr/086-feature-flag-revisions.webp"
order: 86
---

# ADR 086: Feature Flag Revisions

## Status

Proposed (2026-11-13). Agreed in a design session for the feature flags v2 work (enhancement 5.6 follow-up); nothing is built yet.

Terms used below (**feature flag**, **dynamic config**, **rule**, **flag revision**, **rule promotion**, **exposure**, **environment**) are defined in `GLOSSARY.md`.

## Decision

Every save of a feature flag's or dynamic config's rules writes a new, unchangeable **flag revision**: a sequence number per flag, the complete ordered rule set, the author, the reason and the time. The previous revision is soft-deleted and kept. Exactly one revision per flag is live. Rules are never updated in place.

## Why

Four later capabilities each need to name "the exact rules that were in force":

| Capability | What it reads from a revision |
|---|---|
| History and diff in the admin console | Two revisions side by side |
| Approvals (phase D) | A pending revision that becomes live only once a second staff member approves it |
| Exposures (phase B) | The revision number and rule that decided each value |
| Rule promotion between environments (phase F) | A revision exported from one environment and imported into another as a new revision |

Editing rules in place and relying on the database change-capture audit (ADR 051) would reconstruct these from row-level change history. That is possible, but every consumer would then rebuild a rule set from scattered changes, and an approval would have nothing to point at before the change happens.

## Considered options

- **Edit in place, history from ADR 051 change capture.** Rejected: no stable identity for "the rules at time T", and no place for a pending change.
- **Event-sourced rules.** Rejected: a full event model is more machinery than a small, rarely-written configuration needs.

## Consequences

- Storage grows by one row set per save. Flags are rarely written, so this is negligible.
- The API's in-process rule cache keys on the live revision number; the SSE stream announces that number.
- A kill switch and flag overrides sit outside revisions, so an emergency off never waits on approval or creates a rule revision. Each is still audited with a reason.
