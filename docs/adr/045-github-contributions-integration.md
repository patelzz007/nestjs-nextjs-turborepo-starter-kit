---
title: "ADR 045: GitHub Contributions — Server Token, Repository Allowlist, In-Memory Stale-on-Failure Cache"
tags: ["adr", "api", "integration", "github", "resilience"]
description: "The API reads a configured list of GitHub repositories with one read-only token, refuses any other repository, and serves answers from a per-instance cache that stands in for GitHub when it fails."
author: "Platform Team"
lastUpdated: 1791590400000
coverImage: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=1200&h=630&fit=crop"
order: 45
---

# ADR 045: GitHub Contributions — Server Token, Repository Allowlist, In-Memory Stale-on-Failure Cache

## Status

Accepted (2026-10-10). Implemented — see [GitHub contributions](../technical/github-contributions.md).

## Context

The product needs to show contributions to GitHub repositories (commits, lines added and deleted,
contributors) in the mobile Profile now, and in a portfolio site and a project management system
later. It is the API's first outbound integration with a third-party HTTP API. GitHub needs a token
for its GraphQL API (one request returns a page of commits *with* line counts) and rate-limits each
token to 5,000 requests per hour.

## Decision

- **One server-held token, a server-decided repository list.** `GITHUB_TOKEN` (a fine-grained,
  read-only token) turns the integration on. The list is pinned by `GITHUB_REPOSITORIES` (at most 20
  `owner/repository`) or, when that is empty, **discovered** from the token's account: its own
  public non-fork repositories and the public repositories it recently contributed to (amended
  2026-10-10; public only, because every signed-in user sees the list). Every per-repository
  request is matched against the list first; anything else is a 404 and GitHub is never called for
  it. Clients never send or see a token.
- **Read-only, `READ:GITHUB`.** A new `GITHUB` permission resource; `READ` is granted to every
  platform role. It is a GLOBAL grant on the customer `User` role — the documented exception to its
  OWN-only rule, because the repositories are shared configuration nobody owns.
- **One client owns GitHub.** `GithubApiClient` sends every request with the token, an explicit
  timeout, and GitHub's API version; parses every body with zod wire schemas; and translates GitHub's
  failures into typed errors: not found → 404, timeout / network / rate limit → 503, anything else
  → 502.
- **In-memory cache per instance, single flight, stale on failure.** Answers are reused for
  `GITHUB_CACHE_TTL_MS` (5 min); concurrent misses share one request; for up to one hour after that,
  the last good answer stands in when GitHub fails.
- **Contributor totals never wait on GitHub** (amended 2026-10-12). GitHub's contributor statistics
  are used when ready (`basis: statistics`). GitHub recomputes them after every push and answers
  202 "still computing" meanwhile — observed for 15+ minutes on a 173-commit repository — so the
  API then counts the default branch's latest commits itself (at most 1,000, ten GraphQL pages;
  merge commits and commits without an account credited to no one, as GitHub does) and answers
  `basis: history` with `commitsCounted` and `complete`. The answer is cached like any other; after
  the cache lifetime GitHub's statistics are asked for again. Originally the 202 was passed on as
  `{ status: "computing" }` and the app polled every 5 s, which left the section empty for as long
  as GitHub took.

## Alternatives

- **Clients name any repository (open proxy)**: anyone with the permission could spend the API's
  token and rate limit on arbitrary repositories, including private ones the token can read.
- **Per-user GitHub OAuth now**: the right model for a multi-user project management system, but it
  needs an encrypted token table, an OAuth flow and token refresh — far beyond showing the owner's
  repositories. The contract and client are written so it can be added later.
- **Redis cache**: shared across instances, but the data is public metadata and a cold cache costs
  one GitHub read per instance per key; Redis would add a dependency on the request path without a
  correctness benefit. Revisit if the instance count grows enough to matter against the rate limit.
- **Circuit breaker**: the cache already bounds traffic to GitHub to one request per key per cache
  lifetime per instance, so a failing GitHub is not hammered; the stale fallback is the degradation.
- **REST only**: one request per commit to get line counts (N+1 against a rate-limited API).

## Consequences

- Adding a repository is a config change and a restart; removing one makes it a 404 immediately.
- An outage at GitHub shows data up to ~65 minutes old instead of an error; beyond that the client
  sees 503 / 502 with a retry.
- A token that expires or loses access surfaces as 502 for every repository and an error log naming
  `GITHUB_TOKEN`.
- The capture run for the API reference cannot sample the GitHub-backed routes (no token there).
