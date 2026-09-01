---
title: "Epoch Timestamps and date-fns: A Date Strategy That Won't Bite You"
description: "We standardised on epoch milliseconds in the database and date-fns on the client. Here is why that convention removed an entire class of timezone bugs."
author: "Acme Inc."
date: 1786752000000
category: "Engineering"
---

# Epoch Timestamps and date-fns: A Date Strategy That Won't Bite You

Dates are the classic silent bug factory: a `Date` string serialised in one
timezone, parsed in another, formatted in a third, and suddenly an email says
it was sent yesterday.

## The rule

**Databases store epoch milliseconds.** No `TIMESTAMP WITH TIME ZONE`
mystery, no ISO strings that some layer decides to interpret as local time —
just a number that means the same thing on every machine on the planet.

**The front end formats with date-fns.** One library, one import, tree-shaken
and type-safe. Every display goes through a tiny helper so "Aug 14, 2026" reads
identically everywhere.

## How it plays out

- The Prisma schema stores `BigInt`/`Int8` timestamps — an integer, nothing
  clever.
- The API returns them as numbers in JSON responses.
- The admin UI formats them with `formatEpochDate()` (a thin `date-fns`
  wrapper) — never `new Date(x).toString()`, never `toLocaleDateString()`.
- Seeders write epoch values, so even the dev database is honest about what a
  date *is*.

## Why not just ISO strings?

ISO 8601 strings are unambiguous *as long as* every consumer parses them with
an explicit timezone. In practice, `new Date("2026-08-14")` and
`new Date("2026-08-14T00:00:00Z")` are different moments — and someone will
always pick the wrong one. Epoch integers don't give you that footgun: there is
exactly one way to read them.

It is a boring convention. That is the point — boring conventions are the ones
you never have to debug at 2am.
