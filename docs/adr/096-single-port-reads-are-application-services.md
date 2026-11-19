---
title: "ADR 096: A Read Through One Read Port Is an Application-Service Method"
tags: ["adr", "cqrs", "ddd", "application-service", "queries"]
description: "A read that checks its caller or input and then reads one read port is a method of that read model's application service, not a Query, a QueryHandler and a bus dispatch. A read that composes several collaborators stays a Query + QueryHandler. Applies ADR 059 and replaces the migration plan's 'queries always get a handler'."
author: "Platform Team"
category: "Architecture decisions"
date: 1795046400000
lastUpdated: 1795046400000
editedAt: 1795046400000
coverImage: "/images/covers/adr/096-single-port-reads-are-application-services.webp"
order: 96
---

# ADR 096: A Read Through One Read Port Is an Application-Service Method

## Status

Accepted (2026-11-19, the owner's decision). Applies [ADR 059](./059-selective-cqrs-and-event-mechanisms.md) point 1
to reads. Replaces the read branch of the DDD/CQRS migration plan §4.4 ("Query + QueryHandler, always; even trivial
reads") and the matching line of `rules/23`. Commands are unchanged.

## Context

ADR 059 says: "A CRUD read that validates input and returns one query is an application service", and "use a query
when the read model is not the aggregate". The migration plan then made every read a Query + QueryHandler, to give
each read one explicit place for authorization, projection and N+1 discipline.

119 query handlers followed that rule. 64 of them hold exactly one collaborator, a read port, an application service
that already existed (an assembler, a credentials or status reader), or nothing at all. Their `execute` checks the
caller or the input, calls that one collaborator once, and at most turns `null` into a not-found error. Each of those
reads cost a query class, a handler class, a provider entry and a `QueryBus` dispatch, and none of the four said
anything the collaborator did not already say. A reader followed three files to find one call.

## Decision

A read is classified by how many collaborators it needs:

| The read needs | It is |
|---|---|
| One read port (or none), with any precondition on the caller or input, not-found handling, or mapping of that one result | A method of that read model's **application service**: `application/services/<name>.application-service.ts`, `<Name>ApplicationService`, `actor` first, like catalog's |
| Two or more collaborators: several ports, another context, credentials, merchant access, the clock, crypto, a unit of work | A **Query + QueryHandler**: composing them is the use case, and the handler is where it lives |

| Rule | Meaning |
|---|---|
| One application service per read model | Its reads are its methods. When a write of the same resource is a simple-path method too, it joins the same class. |
| The application service is the only door | A controller calls the application service, never the read port; presentation does not reach past the application layer. |
| Authorization, projection and N+1 discipline stay explicit | The precondition the handler held moves into the method, unchanged; the read port and its N+1 tests are unchanged. |
| A read that already goes through an application service | The controller calls that service; no wrapper is added around it. |

## Consequences

- 64 query handlers become application-service methods; their Query classes, handler classes, provider entries and
  handler specs go, and each method gets a spec of the same behaviour. A precondition the handler ran on the actor
  (a signed-in customer, a signed-in GitHub user) moves into the method, which is `async` so a refusal stays a
  rejected promise.
- The 55 handlers that compose collaborators stay, among them every merchant-scoped read (merchant access plus the
  read), every export (renderer plus audit), the role-assignment preview and validation (catalog plus conflict
  rules), the authorization decision (kernel plus grants), and the sign-in reads that need crypto, the clock or the
  session cache.
- The migration plan §7 rows of the converted reads say `S` with the service that holds them.
- No endpoint, response, authorization decision or SQL statement changes.
