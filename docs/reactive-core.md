---
title: "Reactive Core (Subscription-based, no rxjs)"
description: "Design for replacing promise-based flows with a tiny in-house rxjs-like reactive core — 50 items to implement, pitfalls, unsubscribe guarantees, and full operator coverage."
order: 14
author: "Acme Inc."
lastUpdated: "2026-08-05"
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
---

# Reactive Core — Subscription-based, no rxjs

> **The vision:** replace the promise-based data flow (React Query + `useApi` + `useEffect`
> bookkeeping) with a tiny, **in-house rxjs-like** reactive core — `packages/reactive` — built
> with zero dependencies. Same mental model as Angular/rxjs (`Observable`, `Subject`,
> `subscribe`, `pipe`, `map`, `switchMap`, `forkJoin`, `combineLatest`, …) but **no rxjs
> library**. Every subscription is **guaranteed unsubscribable**.
>
> **Implementation status (2026-08-05):** the **scoped-down core ships** as
> `packages/reactive` — items 1–6, 9–10 (primitives), 11–15 (creation), 19–20, 27–28, 31–32,
> 33 (map / switchMap / filter / take* / debounceTime / throttleTime / **startWith** /
> **distinctUntilChanged** / **merge** / **shareReplay(1)**), plus the `TestScheduler` and
> marble helpers, the
> **leak detector** (`assertNoActiveSubscriptions` — every live `Subscription` is registered
> and asserted-absent after a test), and a `filter` type-guard overload that narrows
> discriminated unions through pipelines. **71 tests green** (incl. synchronous-source
> teardown regressions, operator marbles, leak-registry checks), **lint + typecheck clean**.
>
> **React binding ships too:** `useObservable` (the Part 7½ async-pipe port, on
> `useSyncExternalStore`) lives at `packages/ui/src/hooks/use-observable.ts` and is used by
> the **rewritten `SessionStatusBadge`** (`apps/admin/lib/session-badge.ts` + the component) —
> the Phase-1 "kill-switch" proof. The badge's imperative `setInterval` + `visibilitychange` +
> `useRef` mess is now a declarative pipeline (visibility gate → poll → rotation pulse →
> countdown), with **zero React Query involvement** and **zero leaks after unmount** (asserted
> by the leak detector in the badge's own test suite).
>
> **Zero-polling by default.** The badge (now in the admin **topbar**, so it mounts once in
> the persistent `(panel)` shell and survives SPA navigations) fetches `GET /session` once
> on mount and computes the countdown **locally** from the JWT `exp` claim (served as
> `expiresAt`) with a client timer — no steady poll required. `NEXT_PUBLIC_SESSION_POLL_MS`
> is an **opt-in** steady-poll interval (unset/`0` = disabled); it is the **observation
> cadence** for proactive rotation/session-death detection, NOT the token lifetime — the
> two are deliberately unrelated. `shareReplay(1)` is what makes the
> badge correct: the component subscribes `sessionState$` three ways (directly + via the
> countdown and pulse streams), and the share operator collapses those into ONE fetch
> pipeline — a regression test asserts exactly one fetch per cycle despite three subscribers.
> The rest of this
> document remains the design for the deferred surface (see the kill/keep/cut rubric below
> the migration plan) — this section explains what would be built and why the remaining
> items were cut or deferred.
>
> **Ground truth (checked 2026-08-05):** today the web/admin apps fetch via
> `packages/client/src/lib/use-api.ts` (TanStack React Query wrapper — `useQuery`/`useMutation`
> return promises/state), the auth context (`auth.tsx`) manages login/logout/cross-tab sync
> with promises + `useEffect`, and the API endpoints are declared in the typed registry
> `packages/client/src/lib/endpoints.ts`. The NestJS API already uses rxjs internally for
> interceptors (`Observable`, `throwError`) — that stays untouched; this design is about the
> **client-side** data flow (and optionally the API's service layer later).
>
> Repo rules apply throughout: no `any`/`unknown`/`never`, no type casting, infer from zod,
> generics first, explicit access modifiers + return types, every component dumb/data-driven,
> and all subscriptions unsubscribable.

---

# 🧩 Part 1 — The core primitives (items 1–10)

> The foundation. Everything else is built from these ~500 lines of TypeScript. All types are
> generic, all methods have explicit return types, and every `subscribe` returns something you
> can `unsubscribe`.

## 1. `Observable<T>` — the cold, lazy source

**What:** the heart of the system. A generic class wrapping a **subscriber function** that is
invoked *per subscription* (cold semantics — each subscriber gets its own execution).

```typescript
export interface Observer<T> {
	next(value: T): void;
	error(err: unknown): void;
	complete(): void;
}

export type Teardown = () => void;

export class Observable<T> {
	private readonly subscribeFn: (observer: Observer<T>) => Teardown | void;

	public constructor(subscribeFn: (observer: Observer<T>) => Teardown | void) {
		this.subscribeFn = subscribeFn;
	}

	/** Returns a Subscription — the ONLY way to stop this observable. */
	public subscribe(observer: Partial<Observer<T>>): Subscription;
	public subscribe(next?: (value: T) => void, error?: (err: unknown) => void, complete?: () => void): Subscription;
	public subscribe(...): Subscription { /* wire partial observer to full observer */ }

	/** Compose operators. `pipe` IS the operator chain — see item 10. */
	public pipe<A>(op1: Operator<T, A>): Observable<A>;
	public pipe<A, B>(op1: Operator<T, A>, op2: Operator<A, B>): Observable<B>;
	public pipe(...ops: Operator<any, any>[]): Observable<unknown> { /* reduce */ }
}
```

**Rules:** `subscribe` returns `Subscription` **always** (never `void` — item 3 enforces this).
`Observer.error`/`complete` are optional at the call site but always invoked internally when the
source emits them.

## 2. `Partial<Observer<T>>` subscription contract

**What:** subscribers may pass only `next`, only `error`, or nothing. Missing handlers are
no-ops internally — but **the internal observer always has all three**, so sources can always
call `.error()` safely even if the subscriber didn't provide one (the error is re-thrown
asynchronously to avoid silent swallowing — see pitfalls).

```typescript
export interface PartialObserver<T> {
	readonly next?: (value: T) => void;
	readonly error?: (err: unknown) => void;
	readonly complete?: () => void;
}
```

## 3. `Subscription` — the universal handle (unsubscribe is non-negotiable)

**What:** every `subscribe()` returns one of these. Tracks `closed`, supports **child
subscriptions** (`add`), and guarantees teardown runs exactly once.

```typescript
export class Subscription {
	private readonly teardowns: Set<Teardown> = new Set();
	private closed = false;

	public get isClosed(): boolean { return this.closed; }

	public add(child: Subscription | Teardown): void;      // compound teardown
	public remove(child: Subscription | Teardown): void;   // detach before parent closes
	public unsubscribe(): void;                            // idempotent, runs all teardowns once
}
```

**Why this shape:** a `forkJoin` of 3 observables returns **one** Subscription whose `unsubscribe`
tears down all 3 children — that's how "every subscription is unsubscribable" scales to nested
operators (each operator's inner source is added as a child).

## 4. `Subscriber<T>` — the internal observer that owns the teardown

**What:** the concrete `Observer` implementation created per subscription. It:
- tracks `closed` (once error/complete/unsubscribe fires, all further calls are no-ops);
- captures the teardown returned by the source;
- makes `unsubscribe()` idempotent.

**Why it exists:** operators need to *check* `isClosed` and *detach* children mid-stream
(`switchMap` unsubscribes the previous inner). The user never sees `Subscriber` — it's
internal to the implementation of `Observable.subscribe`.

## 5. `Subject<T>` — hot, multicast

**What:** an `Observable` that is **also an `Observer`** — you can call `next/error/complete`
on it, and every current subscriber receives the value (hot: late subscribers miss earlier
values). This is the in-app **event bus** primitive.

```typescript
export class Subject<T> extends Observable<T> implements Observer<T> {
	public next(value: T): void;
	public error(err: unknown): void;
	public complete(): void;
	// Internal: keeps the subscriber set; subscribe() adds; teardown removes.
}
```

**Key guarantee:** `subscribe()` on a `Subject` returns a `Subscription` whose teardown removes
the subscriber from the set — **unsubscribing a Subject subscription actually stops delivery**
(no leak).

## 6. `BehaviorSubject<T>` — current value + push

**What:** a `Subject` that holds the **latest value** and replays it to every new subscriber.
The workhorse for app state (auth state, theme, settings).

```typescript
export class BehaviorSubject<T> extends Subject<T> {
	private currentValue: T;
	public constructor(initialValue: T);
	public getValue(): T;                       // sync read (careful — see pitfalls)
	public next(value: T): void;                // stores + notifies
}
```

**Why:** `useBehaviorSubject` (item 46) reads `getValue()` for the initial React state and
subscribes for updates — this is how a "store" works without a library.

## 7. `ReplaySubject<T>` — replay a buffer

**What:** a `Subject` that records the last `n` emissions and replays them to late subscribers.
`new ReplaySubject<X>(1)` is effectively a BehaviorSubject without a required initial value.

## 8. `AsyncSubject<T>` — last value, only on complete

**What:** emits **only the final value, only when `complete()` fires**. Perfect for
promise-like one-shot work (e.g. `lastValueFrom` interop). Included for rxjs parity even if
rarely used.

## 9. Scheduler-lite (sync + async + interval)

**What:** rxjs's `SchedulerLike` is a big concept; we need only a **subset**:

```typescript
export interface SchedulerLike {
	readonly now: () => number;
	schedule(action: () => void, delayMs?: number): Subscription;  // returns a cancelable handle
}

export const syncScheduler: SchedulerLike;      // run action immediately
export const asyncScheduler: SchedulerLike;     // queueMicrotask
export const intervalScheduler: SchedulerLike;  // setInterval-based, returns cancelable sub
```

**Why:** `debounceTime`, `throttleTime`, `interval`, `timer`, `retryWhen` all need delay +
cancellation. `intervalScheduler.schedule` returning a `Subscription` means even a pending
timer can be unsubscribed (no orphaned `setInterval`).

## 10. `pipe()` — the operator composition core

**What:** variadic composition. An **Operator** is just `(source: Observable<A>) => Observable<B>`.

```typescript
export type Operator<A, B> = (source: Observable<A>) => Observable<B>;

// pipe is a standalone function AND a method (item 1):
export function pipe<A, B>(op1: Operator<A, B>): Operator<A, B>;
export function pipe<A, B, C>(op1: Operator<A, B>, op2: Operator<B, C>): Operator<A, C>;
export function pipe(...ops: Operator<unknown, unknown>[]): Operator<unknown, unknown> { /* right-to-left reduce */ }
```

**Why:** every operator is a **pure function** `source => new Observable(...)` — no classes for
operators, no hidden state, trivially unit-testable, and `pipe` gives the familiar
`source$.pipe(map(...), filter(...))` ergonomics.

---

# 🏭 Part 2 — Creation operators (items 11–18)

> Functions that produce observables from values, events, promises, and timers. Every one
> returns an `Observable` whose teardown cleans up its resources (event listeners, timers,
> AbortController).

## 11. `of(...values)` — emit known values then complete

```typescript
export function of<T extends readonly unknown[]>(...values: T): Observable<T[number]> {
	return new Observable<T[number]>((observer) => {
		for (const value of values) observer.next(value);
		observer.complete();
	});
}
```

**Why:** the simplest cold observable — the bread-and-butter for tests and defaults
(`of(initialValue).pipe(startWith(...))`).

## 12. `from(value)` — array / iterable / promise / observable

**What:** accepts an array, an `Iterable`, a `Promise`, or another `Observable` and normalizes it
into an `Observable<T>`.

```typescript
export function from<T>(value: Iterable<T> | PromiseLike<T> | Observable<T>): Observable<T> {
	// PromiseLike → fromPromise (item 13); Iterable → per-item next; Observable → passthrough
}
```

**Why:** this is the interop shim that lets existing promise-based services be wrapped without
rewriting them (see item 13).

## 13. `fromPromise(promise)` + `fromFetch(url, init)` — promise + fetch wrappers

**What:** two crucial interop functions:

- `fromPromise` — wraps a `Promise<T>` so it emits the resolved value then completes; a
  rejection becomes `.error(err)`. **Unsubscribe before resolution = the value is dropped and
  the promise result is ignored** (no double-processing).
- `fromFetch` — wraps `fetch` and **creates an `AbortController` per subscription**; the
  teardown calls `controller.abort()`. Unsubscribing a fetch actually **cancels the HTTP
  request** — something promises can't do.

```typescript
export function fromFetch(url: string, init?: RequestInit): Observable<Response> {
	return new Observable<Response>((observer) => {
		const controller = new AbortController();
		fetch(url, { ...init, signal: controller.signal })
			.then((res) => { if (!observer.isClosed) observer.next(res); })
			.catch((err) => { if (!observer.isClosed) observer.error(err); });
		return () => controller.abort();
	});
}
```

**Why:** this is the single most valuable feature vs promises — **real cancellation**. `switchMap`
(item 20) relies on it to abort stale requests.

## 14. `fromEvent(target, type)` — DOM events with automatic cleanup

**What:** wraps `addEventListener`; teardown calls `removeEventListener`.

```typescript
export function fromEvent<K extends keyof HTMLElementEventMap>(target: EventTarget, type: string): Observable<Event> {
	return new Observable<Event>((observer) => {
		target.addEventListener(type, handler);
		return () => target.removeEventListener(type, handler);
	});
}
```

**Why:** every `useEffect` that manually adds/removes a listener becomes a one-liner
`fromEvent(...).pipe(takeUntil(dispose$))` — and the listener can never leak.

## 15. `interval(ms)` / `timer(delay, period?)` — timers with cancelable teardown

**What:** `interval(1000)` emits 0, 1, 2, … every second forever; `timer(5000)` emits once after
5s; `timer(0, 1000)` is `interval` with a leading zero tick. **Both use the interval scheduler
(item 9), so the teardown clears the timer** — no orphaned `setInterval` in the app.

```typescript
export function interval(periodMs: number): Observable<number> {
	return new Observable<number>((observer) => {
		let count = 0;
		const handle = intervalScheduler.schedule(() => observer.next(count++), periodMs);
		return () => handle.unsubscribe();
	});
}
```

**Why:** polling (session status, health checks), countdowns, and the existing `setInterval`
usages in the apps all become unsubscribable streams.

## 16. `EMPTY`, `NEVER`, `throwError` — the three sentinel sources

**What:**

- `EMPTY` — completes immediately, emits nothing (identity for `merge`, `concat`).
- `NEVER` — emits nothing, never completes (identity for `race`, useful in `takeUntil`).
- `throwError(factory)` — immediately errors with a lazily-created error.

```typescript
export const EMPTY: Observable<never> = new Observable<never>((o) => { o.complete(); });
export const NEVER: Observable<never> = new Observable<never>(() => undefined);
export function throwError(factory: () => Error): Observable<never> { /* next() is illegal after error */ }
```

**Why:** rxjs parity + they make `defaultIfEmpty` / `catchError` semantics expressible without
special-casing.

## 17. `defer(factory)` — a cold source whose setup runs per subscription

**What:** `defer(() => observableFactory())` — the factory is **not** called until someone
subscribes, and runs again for every subscriber. Perfect for HTTP calls that must be
cold/re-run per subscriber.

```typescript
export function defer<T>(factory: () => Observable<T>): Observable<T> {
	return new Observable<T>((observer) => factory().subscribe(observer));
}
```

**Why:** this is how the API client (item 48) makes every endpoint cold — each subscriber gets
its own fresh request.

## 18. `range(start, count)` / `generate(...)` — loop sources

**What:** `range(1, 5)` emits 1–5; `generate(seed, condition, iterate)` is the general loop
form. Included for rxjs parity; used for pagination math and test fixtures.

---

# 🔄 Part 3 — Transformation operators (items 19–26)

> The higher-order flattening operators (`switchMap`/`mergeMap`/`concatMap`/`exhaustMap`) are the
> reason to adopt this system — they encode race handling that promises can't. Each one
> subscribes to inner observables **as children of the outer Subscription**, so unsubscribing
> the outer tears down every inner.

## 19. `map(fn)` / `mapTo(value)` — transform values

```typescript
export function map<A, B>(fn: (value: A) => B): Operator<A, B> {
	return (source) => new Observable<B>((observer) =>
		source.subscribe({
			next: (value) => observer.next(fn(value)),
			error: (err) => observer.error(err),
			complete: () => observer.complete(),
		}),
	);
}
export function mapTo<A, B>(value: B): Operator<A, B> { return map(() => value); }
```

**Why:** the most-used operator; zod parsing (`responseSchema.parse`) belongs in a `map` at the
end of a chain.

## 20. `switchMap(fn)` — cancel the previous inner on new outer value

**What:** for each outer emission, **unsubscribes the previous inner** and subscribes the new
one. Only the *latest* inner's emissions flow downstream.

```typescript
export function switchMap<A, B>(fn: (value: A) => Observable<B>): Operator<A, B> {
	return (source) => new Observable<B>((observer) => {
		let inner: Subscription | null = null;
		const outerSub = source.subscribe({
			next: (value) => {
				inner?.unsubscribe();            // cancel the stale request
				inner = fn(value).subscribe({
					next: (v) => observer.next(v),
					error: (e) => observer.error(e),
					complete: () => { inner = null; },
				});
			},
			error: (err) => observer.error(err),
			complete: () => observer.complete(),
		});
		return () => { outerSub.unsubscribe(); inner?.unsubscribe(); };
	});
}
```

**Why:** this is the **search-as-you-type** operator — each keystroke cancels the in-flight
request. With `fromFetch` (item 13), the stale request is actually **aborted**, not just
ignored.

## 21. `mergeMap(fn, concurrency?)` — flatten with optional concurrency cap

**What:** subscribes to **every** inner concurrently and interleaves emissions. An optional
`concurrency` limit (default `Infinity`) queues extras — critical for fan-out that shouldn't
overwhelm the API.

**Why:** bulk operations (refresh all sessions, upload many files) where you want N-at-a-time
with an interleaved stream.

## 22. `concatMap(fn)` — ordered queue (slow, safe)

**What:** waits for each inner to **complete** before starting the next. Strict ordering.

**Why:** sequential mutations — "create user, then assign role, then notify" — where order
matters and parallelism would corrupt state.

## 23. `exhaustMap(fn)` — ignore outer while inner runs

**What:** the opposite of `switchMap`: if an inner is still active when the outer emits, the new
outer value is **dropped** (not queued, not canceled).

**Why:** debounced-by-construction actions — "refresh once, ignore spam clicks until it
finishes". Perfect for the refresh-button pattern.

## 24. `scan(accumulator, seed)` — running accumulator (state machine)

**What:** emits the running result of `(acc, value) => acc` for every input, seeded with an
initial value. `reduce` (item 25) is the same but only emits at `complete`.

```typescript
export function scan<A, B>(fn: (acc: B, value: A) => B, seed: B): Operator<A, B> {
	// per subscription: let acc = seed; next: acc = fn(acc, value); observer.next(acc);
}
```

**Why:** building a list/counter/stream-of-accumulated-state without a mutable variable outside
the stream.

## 25. `reduce(fn, seed)` — final aggregate on complete

**What:** accumulates like `scan`, but emits **once**, on `complete`. Mirrors `Array.prototype.reduce`.
**Why:** "sum all responses" style batch jobs, and interop with `lastValueFrom`.

## 26. `pairwise()` / `bufferCount(n)` / `bufferTime(ms)` — windowing

**What:**

- `pairwise()` — emits `[previous, current]` tuples (drag deltas, scroll direction).
- `bufferCount(n)` — collects `n` values, emits the array, repeats.
- `bufferTime(ms)` — collects values within a time window, emits the array each window.

**Why:** batching (flush logs/events in chunks) and delta tracking — the reactive equivalent of
an accumulator that promises would need a mutable `useRef` for.

---

# 🧹 Part 4 — Filtering operators (items 27–32)

## 27. `filter(predicate)` — keep matching values

```typescript
export function filter<A>(predicate: (value: A) => boolean): Operator<A, A> {
	return (source) => new Observable<A>((observer) =>
		source.subscribe({ next: (value) => { if (predicate(value)) observer.next(value); } }),
	);
}
```

## 28. `take(n)` / `takeWhile(pred)` / `takeUntil(notifier)` — bounded lifetimes

**What:**

- `take(n)` — emit exactly `n` values then `complete()` (and unsubscribe upstream).
- `takeWhile(pred)` — emit while predicate is true, then complete.
- `takeUntil(notifier)` — **the cleanup workhorse**: emit until `notifier` emits, then
  unsubscribe upstream and complete. This is how every UI subscription gets its "dispose"
  hook (see `useObservable`, item 45).

```typescript
export function takeUntil<A>(notifier: Observable<unknown>): Operator<A, A> {
	return (source) => new Observable<A>((observer) => {
		const sourceSub = source.subscribe(observer);
		const notifierSub = notifier.subscribe({ next: () => {
			sourceSub.unsubscribe();
			observer.complete();
		}});
		return () => { sourceSub.unsubscribe(); notifierSub.unsubscribe(); };
	});
}
```

## 29. `skip(n)` / `skipWhile(pred)` / `skipUntil(notifier)` — ignore the leading part

**What:** drop the first `n` values / values while a predicate holds / everything until a
notifier fires. The mirror of item 28.

## 30. `first()` / `last()` / `single()` — take exactly one

**What:**

- `first()` — first value then complete (error if none? no — completes; `single` errors on
  ambiguity).
- `last()` — last value, emitted on complete.
- `single()` — exactly one value expected; **errors** if zero or >1 (strictness for invariants
  like "the only active session").

## 31. `distinctUntilChanged(comparator?)` — suppress repeats

**What:** skips emissions equal to the previous one (`===` by default, or a custom comparator).
**Why:** prevents React re-renders when the store re-emits an unchanged value — the core
"don't set state if nothing changed" filter.

## 32. `debounceTime(ms)` / `throttleTime(ms)` / `auditTime(ms)` / `sampleTime(ms)` — rate control

**What:**

- `debounceTime(ms)` — emit only after `ms` of silence (search inputs, save-on-idle).
- `throttleTime(ms)` — emit at most once per `ms`, leading edge (scroll listeners).
- `auditTime(ms)` — emit the latest value at the *end* of each window (trailing edge).
- `sampleTime(ms)` — emit the latest value on a fixed interval, regardless of input timing.

**Why:** all four are built on the cancelable scheduler (item 9), so unsubscribing mid-window
clears the pending timer — no stale callbacks after unmount. These replace a whole family of
hand-rolled `setTimeout`/`setInterval` effects.

---

# 🔗 Part 5 — Combination operators (items 33–40)

> These are the multi-source operators — the ones that replace `Promise.all`, event-handler
> coordination, and hand-rolled state merging.

## 33. `merge(...sources)` — emit from all, interleaved

**What:** subscribes to all sources at once; every emission from any source flows through. The
resulting `Subscription` tears down **all** child subscriptions on unsubscribe. `mergeAll()`
is the flattening version (one observable-of-observables).

**Why:** the event-bus pattern — listen to `auth$`, `network$`, and `settings$` with one
handler.

## 34. `concat(...sources)` — one after another, in order

**What:** subscribes to source 1, waits for its `complete`, then source 2, etc. `concatAll()`
is the flattening version. **Ordering is guaranteed** — no interleaving.

**Why:** sequential multi-step flows where each step must finish before the next starts (the
onboarding wizard, staged uploads).

## 35. `combineLatest(...sources)` — emit when ANY source changes, with all latest values

**What:** waits for **every** source to emit once, then re-emits a tuple `[a, b, c]` whenever
*any* of them emits. This is the classic "depends on multiple states" operator.

```typescript
export function combineLatest<T extends readonly Observable<unknown>[]>(...sources: T): Observable<{ [K in keyof T]: T[K] extends Observable<infer V> ? V : never }> {
	// per subscription: keep latest per source; when all have emitted once, emit the tuple;
	// teardown unsubscribes every child.
}
```

**Why:** "show the dashboard only when auth AND settings AND user-profile are all loaded" —
the exact job React Query's `useQueries` does today, but with real per-source cancellation.

## 36. `withLatestFrom(...sources)` — take a snapshot, don't wait

**What:** emits on the **primary** source's rhythm, attaching the latest values of the others
as a tuple — but only after they've all emitted once. Unlike `combineLatest`, secondary
sources don't *trigger* emissions.

**Why:** "on every click, read the current auth state" — the click drives, state is sampled.

## 37. `forkJoin(...sources)` — the `Promise.all` equivalent

**What:** subscribes to all sources, waits for **all to complete**, then emits one array of their
last values and completes. If **any** errors, the whole thing errors (and everything is
teared down).

```typescript
export function forkJoin<T extends readonly Observable<unknown>[]>(...sources: T): Observable<{ [K in keyof T]: T[K] extends Observable<infer V> ? V : never }> {
	// subscribe all; collect last value per source; on last complete → emit array + complete
}
```

**Why:** the direct replacement for `Promise.all([...])` — "load profile + sessions + settings
in parallel, then render" — with cancellation: unsubscribing mid-flight aborts all three
requests (via `fromFetch`, item 13).

## 38. `zip(...sources)` — pairwise sync (not supported by `combineLatest`)

**What:** emits tuples of the **nth** value from each source together (0,0), (1,1), (2,2)… and
completes when any source completes. Strictly synchronized streams.

**Why:** pairing streams that advance in lockstep (e.g. a list of ids with their
corresponding timestamps).

## 39. `race(...sources)` — first to emit wins

**What:** subscribes to all; the **first** source to emit becomes the winner — the others are
immediately unsubscribed and all further output comes from the winner.

**Why:** timeout races ("API or 5s timer, whichever first") and primary/failover source
selection.

## 40. `startWith(...values)` / `endWith(...values)` — prepend / append

**What:** `startWith(v)` emits `v` immediately on subscription, then the source's emissions.
`endWith(v)` emits `v` after the source completes. Complements `defaultIfEmpty`.

**Why:** `startWith` is the standard "give me the initial value now" trick that makes
`BehaviorSubject`-less streams render immediately — paired with `useObservable` (item 45) it
replaces `useState(initial)` initialization patterns.

---

# 🛠 Part 6 — Utility & error operators (items 41–44)

## 41. `tap(fn)` — side-effect peek (no transformation)

**What:** invokes `fn` on every emission **without changing the value** flowing downstream.

```typescript
export function tap<A>(fn: (value: A) => void): Operator<A, A> {
	return (source) => new Observable<A>((observer) =>
		source.subscribe({ next: (value) => { fn(value); observer.next(value); } }),
	);
}
```

**Why:** logging, analytics, console.debug — side effects that belong in the stream, not in
components. (Pair with `LogService`/`fromFetch` telemetry.)

## 42. `catchError(fn)` — recover from errors mid-stream

**What:** when the source errors, `fn(error)` returns a **replacement observable** that takes
over (stream continues, doesn't die). If `fn` itself throws, the error propagates.

**Why:** fallbacks — "if `/auth/me` fails, emit the cached profile instead of erroring the
UI". This is where promise `try/catch` becomes stream-level recovery.

## 43. `retry(n)` / `retryWhen(fn)` / `repeat(n)` — retry and repeat

**What:**

- `retry(n)` — resubscribe to the source up to `n` times after errors.
- `retryWhen(fn)` — `fn(errors)` returns a notifier; retry on each notifier emission (enables
  backoff: `errors.pipe(delay(1000))`).
- `repeat(n)` — resubscribe after `complete`.

**Why:** transient-failure handling without promises' awkward recursive retry loops — and it
composes with the existing 30s/60s cooldown logic (auth-roadmap #28/#29) as the stream-level
analog.

## 44. `finalize(fn)` / `timeout(ms)` — guaranteed cleanup and deadlines

**What:**

- `finalize(fn)` — `fn` runs **exactly once** when the stream ends *for any reason* (error,
  complete, or unsubscribe). The universal "cleanup" operator — the stream version of
  `useEffect`'s return.
- `timeout(ms)` — errors with `TimeoutError` if nothing emits within `ms`. Built on the
  cancelable scheduler, so the pending deadline timer is cleared on unsubscribe.

**Why:** `finalize` guarantees resource cleanup even when the consumer forgets to unsubscribe
on one path; `timeout` turns hangs into visible errors (fetch without a timeout today just
hangs forever).

---

# ⚛️ Part 7 — App integration (items 45–50)

> The bridge between the core and the React apps — how components subscribe safely, how app
> state becomes streams, and how the existing promise-based `useApi`/React Query layer gets
> replaced.

## 45. `useObservable(observable, initialValue)` — the React subscription hook

**What:** the single hook every component uses to subscribe. Guarantees: subscribes on mount,
**unsubscribes on unmount**, keeps the latest emission in state, works with SSR.

```typescript
export function useObservable<T>(source: Observable<T>, initialValue: T): T {
	const [value, setValue] = useState<T>(initialValue);
	useEffect(() => {
		const sub = source.subscribe({ next: setValue });
		return () => sub.unsubscribe();   // ✅ guaranteed cleanup
	}, [source]);
	return value;
}
```

**Why:** this replaces every `useEffect` + `setState` + manual `setInterval` pattern. The
`useEffect` return **is** the unsubscribe — the rule "every subscription has unsubscribe" is
satisfied structurally, not by convention.

## 46. `useBehaviorSubject(subject)` — subscribe to a store

**What:** reads `subject.getValue()` for the initial state (synchronous, no flash) and
subscribes for updates.

```typescript
export function useBehaviorSubject<T>(subject: BehaviorSubject<T>): T {
	const [value, setValue] = useState<T>(subject.getValue());
	useEffect(() => {
		const sub = subject.pipe(distinctUntilChanged()).subscribe({ next: setValue });
		return () => sub.unsubscribe();
	}, [subject]);
	return value;
}
```

**Why:** this is the app-state primitive — `useBehaviorSubject(authStore.state$)` is the
"selector" that replaces React Query cache reads for non-remote state.

## 47. `createStore(initialState, reducer?)` — the mini-ngrx store

**What:** a tiny store factory on `BehaviorSubject`: `{ state$, dispatch(action), getState() }`
with optional reducer + middleware hooks.

```typescript
export interface Store<State, Action> {
	readonly state$: BehaviorSubject<State>;
	dispatch(action: Action): void;
	getState(): State;
}

export function createStore<State, Action>(
	initialState: State,
	reducer: (state: State, action: Action) => State,
): Store<State, Action> {
	const state$ = new BehaviorSubject<State>(initialState);
	return {
		state$,
		dispatch: (action) => state$.next(reducer(state$.getValue(), action)),
		getState: () => state$.getValue(),
	};
}
```

**Why:** auth state, theme, sidebar, notifications — anything app-global becomes a typed store
with a single `state$` stream. Components select via `useBehaviorSubject`, cross-tab sync
(item 49) dispatches into the same store.

## 48. `ReactiveApiClient` — replace `useApi` + React Query

**What:** every typed endpoint in `endpoints.ts` becomes a **cold observable factory**:
`api.me$()`, `api.login$(body)`, `api.refresh$()` — each returning `Observable<Resp>` that
performs the fetch on subscription (via `defer` + `fromFetch`, items 13/17) and validates with
the existing zod `responseSchema`.

```typescript
export class ReactiveApiClient {
	public me$(): Observable<UserResponse> {
		return defer(() => fromFetch(`${this.baseUrl}${authEndpoints.me.path}`, {
			credentials: "include",
		}).pipe(
			map((res) => res.json()),
			map((raw) => authEndpoints.me.responseSchema.parse(raw)),
		));
	}
	// ... login$, refresh$, logout$, every endpoint in the registry
}
```

**Why:** the 401-refresh flow (currently in `use-api.ts`'s `request()` + `auth.tsx`) becomes a
stream-level concern: a `refreshOn401()` operator wraps every call — on 401 it emits `login$()`
internally, retries the original once, all single-flighted via a shared `Subject`. React Query's
cache/staleness gets replaced by `shareReplay(1)` per endpoint (item 49's pattern) +
`switchMap` on a manual `invalidate$` subject.

## 49. `shareReplay(1)` / `share()` — the caching + multicast operator

**What:** `shareReplay(1)` makes a cold observable **hot**: the first subscriber runs the source;
subsequent subscribers get the replayed last value; when the last subscriber leaves, the
source tears down (refCount semantics). `share()` is the multicast-only variant.

```typescript
export function shareReplay<T>(bufferSize: number): Operator<T, T> {
	// internal: one source subscription shared across subscribers; replay buffer of last n;
	// teardown when subscriber count drops to 0 (unless the source completed).
}
```

**Why:** this is the **React Query replacement** — `api.me$().pipe(shareReplay(1))` caches the
user profile; every component subscribing to the same instance reads the cache; a logout
`next()`s a refresh signal and the cached stream re-fetches. No cache library needed.

## 50. `createEventBus()` + realtime channel (SSE/WebSocket as observable)

**What:** two pieces:

- **In-app event bus** — `const bus = createEventBus<AppEvent>()` returning a `Subject`-based
  publish/subscribe pair (`bus.emit(e)` / `bus.events$`) for decoupled feature communication.
- **Realtime channel** — wrap `EventSource`/`WebSocket` in an observable (like item 14 but for
  sockets): emits messages, teardown closes the connection. Replaces any future polling loop
  with a push stream.

**Why:** the app's cross-tab sync (`auth-sync.ts`), notifications, and future SSE/WebSocket
features all become `Subject`-wrapped streams with guaranteed `close()`/`unsubscribe()`
teardown — the last promise-era wiring gets retired.

---

**The 50 items are the full surface.** If you only ever ship items 1–6, 10, 13, 20, 28, 35,
37, 42, 45, 46, 48 — you already have a usable reactive core that replaces the promise flow
for 90% of the app.

---

# 🎛 Part 7½ — Angular ergonomics parity (async pipe & takeUntilDestroy)

> Two Angular features we want the same *feel* for, adapted to React. The short answer:
> **the async pipe becomes `useObservable` (item 45) + a `<Subscribe>` component, and
> `takeUntilDestroy` becomes a `useDestroy()` hook feeding the `takeUntil` operator (item 28).**
> Both keep the unsubscribe guarantee — the framework does it for us, exactly like Angular.

## 🎯 The async pipe (`{{ value | async }}`)

**In Angular:** `{{ value$ | async }}` subscribes to `value$` in the template, renders the
emitted value, and **unsubscribes automatically when the view is destroyed** — plus it renders
nothing while waiting for the first value (null-safe) and re-subscribes if the reference
changes.

**In React:** we can't put pipes in JSX, so the equivalent is a **hook** — and we already
have it: `useObservable` (item 45). The subscription lives in the component's `useEffect`,
and the cleanup *is* the unsubscribe — the hook IS the async pipe.

```tsx
// Angular:
//   <div>{{ user$ | async }}</div>
// React — same idea, same automatic unsubscribe:
export function UserName(): JSX.Element {
	const user = useObservable(api.me$().pipe(shareReplay(1)), null);
	if (user === null) return <Skeleton />;        // async pipe renders nothing while pending
	return <div>{user.fullName}</div>;
}
```

### Why `useObservable` is a faithful async-pipe port

| Async pipe behavior | Our equivalent |
| ------------------- | -------------- |
| Subscribes on view creation | Subscribes in `useEffect` on mount |
| Unsubscribes on view destroy | Cleanup calls `sub.unsubscribe()` on unmount |
| Renders null before first emission | `initialValue` default → component renders the "pending" branch |
| Re-subscribes when the source reference changes | `useEffect` dep `[source]` re-subscribes on change |
| Null-safe | `initialValue` can be `null` and the branch is explicit |

### A `<Subscribe>` render-prop for pipe-in-JSX ergonomics

For the closest possible `| async` feel — subscribing *inline in JSX* without a hook at the
top of the component — add a tiny render-prop component (fits the repo's dumb-component
rules: data comes in via props, nothing hardcoded):

```tsx
export interface SubscribeProps<T> {
	readonly source: Observable<T>;
	readonly initial?: T;
	readonly children: (value: T | undefined) => ReactNode;
}

export function Subscribe<T>({ source, initial, children }: SubscribeProps<T>): JSX.Element {
	const value = useObservable(source, initial);
	return <>{children(value)}</>;
}

// Usage:
// <Subscribe source={api.me$().pipe(shareReplay(1))} initial={null}>
//   {(user) => user === null ? <Skeleton /> : <UserCard user={user} />}
// </Subscribe>
```

**Guarantee:** it reuses `useObservable`, so the unsubscribe rule is inherited — the
component can never forget, and nothing leaks when the parent unmounts.

### Even more canonical: `useObservable` on `useSyncExternalStore` 🖥️

`useState` + `useEffect` (above) is the easy version, but the **most canonical async-pipe
port** is React's own **`useSyncExternalStore`** — the built-in hook designed *exactly* for
"subscribe to an external store, get the latest snapshot, re-render on change, tear down on
unmount". The auth hydration flag (`auth.tsx`, auth-roadmap #30) already uses this pattern.

Why it's better for our case:

- **SSR-safe by construction.** `useSyncExternalStore` takes three functions:
  `subscribe`, `getSnapshot`, and `getServerSnapshot` — the server uses `getServerSnapshot`
  (our `initialValue`/`BehaviorSubject` current value) and the client uses `getSnapshot`,
  so the server HTML and the first client paint **cannot disagree** (kills pitfall 3's
  hydration-mismatch class outright).
- **No `useEffect` timing window.** `useEffect` subscribes *after* paint; `useSyncExternalStore`
  subscribes during commit, so there's no frame where a fast-emitting source's value is
  missing — closer to the async pipe's "value is there on the first render".
- **StrictMode + tearing-safe.** React guarantees consistent snapshots across concurrent
  renders (no "tearing" — two renders seeing different values), which a hand-rolled
  `setState`-in-effect can't promise.
- **Unsubscribe is built into React's contract** — React calls our `subscribe`'s returned
  cleanup on unmount; there is no code path that forgets.

```tsx
/**
 * The canonical async-pipe equivalent: useSyncExternalStore under the hood.
 * - subscribe: attaches our observer to the observable; returns an unsubscribe closure.
 * - getSnapshot: reads the latest value (BehaviorSubject) or falls back to `initial`.
 * - getServerSnapshot: the SSR-safe snapshot (must equal the client's first paint).
 */
export function useObservable<T>(source: Observable<T>, initialValue: T): T {
	return useSyncExternalStore(
		// subscribe — React calls this on mount and the returned fn on unmount (guaranteed)
		(onStoreChange: () => void): (() => void) => {
			const sub = source.subscribe({ next: onStoreChange });
			return (): void => sub.unsubscribe();
		},
		// getSnapshot — the current value; the observable must expose it (item 6) or we
		// keep a module-level "latest value" cache updated by the subscription.
		(): T => getCurrentValue(source, initialValue),
		// getServerSnapshot — never runs effects on the server, so just the initial value.
		(): T => initialValue,
	);
}
```

**The trade-off (be honest in the code review):** `useSyncExternalStore` reads the snapshot
**synchronously during render**, so `getSnapshot` must be fast and must **not** return a new
object identity on every call (that triggers React's infinite-re-render warning). Two safe
patterns:

> ✅ **SHIPPED (2026-08-05):** `useObservable` is implemented at
> `packages/ui/src/hooks/use-observable.ts` using the `useSyncExternalStore` shape below
> (with the latest value cached in a ref — pattern 2). It is consumed by the rewritten
> `SessionStatusBadge` and is the documented way to bind streams to React.
> The subscription it creates is a plain `Subscription`, so it participates in the leak
> registry — unmounting a component empties the registry, and tests assert exactly that.

1. **Snapshot = primitive/stable reference** — e.g. a `BehaviorSubject`'s value that is a
   number/string/stable object. `getSnapshot` returns the identical reference until the
   subject actually changes.
2. **Cache the last emission** — the subscription updates a module-level `latest` map keyed
   by source identity, and `getSnapshot` returns `latest.get(source) ?? initialValue`.
   Only a real emission changes the reference.

**When to pick which (decision table):**

| Source type | Recommended hook | Why |
| ----------- | ---------------- | --- |
| `BehaviorSubject` / store `state$` | `useBehaviorSubject` (item 46) — build on `useSyncExternalStore` | snapshot is the subject's stable value |
| One-shot/cold HTTP (`api.me$()`) | `useObservable` + `useEffect` version, or `Subscribe` | the value changes once; the initial-value + effect flow is simpler and the pending branch is explicit |
| Hot event streams / time-based | `useObservable` + `useEffect` + `takeUntil` | these are imperative by nature; render-state usually comes from a `BehaviorSubject` buffer, not the raw stream |
| Any stream that must be SSR-identical | `useSyncExternalStore` version | server + client first paint guaranteed equal |

> **Bottom line:** ship **both** hook shapes behind one name. `useObservable` dispatches
> internally: if the source exposes a stable current value (`BehaviorSubject`), it uses the
> `useSyncExternalStore` path; otherwise it falls back to the `useEffect` path. Consumers write
> one line either way, and the unsubscribe guarantee never varies.

---

## 🎯 `takeUntilDestroy(this)`

**In Angular (v16+):** `source$.pipe(takeUntilDestroy(this))` completes the stream
automatically when the component is destroyed — a one-liner unsubscribe for *imperative*
subscriptions made outside the async pipe (in `ngOnInit`, event handlers, etc.).

**In React:** the equivalent is a **`useDestroy()` hook** that returns a one-shot `Subject`
which fires when the component unmounts, feeding the `takeUntil` operator (item 28):

```tsx
/**
 * A Subject that emits+completes exactly once — when the calling component unmounts.
 * Feed it to `takeUntil` for automatic teardown, Angular's takeUntilDestroy(this) style.
 */
export function useDestroy(): Observable<void> {
	const destroyRef = useRef<Subject<void> | null>(null);
	if (destroyRef.current === null) {
		destroyRef.current = new Subject<void>();
	}
	const destroy$ = destroyRef.current;

	// Fire + complete the subject on unmount. The ref is reset so a StrictMode
	// remount gets a fresh subject (pitfall 12).
	useEffect(() => {
		return () => {
			destroy$.next();
			destroy$.complete();
		};
	}, [destroy$]);

	return destroy$;
}
```

```tsx
// Usage — an imperative subscription that dies with the component:
export function PollingBadge(): JSX.Element {
	const destroy$ = useDestroy();

	useEffect(() => {
		const sub = interval(30_000)
			.pipe(switchMap(() => api.sessionStatus$()), takeUntil(destroy$))
			.subscribe({ next: setStatus });
		return () => sub.unsubscribe();   // belt-and-braces; takeUntil already covers it
	}, [destroy$]);

	return <StatusBadge status={status} />;
}
```

### Why it works (and what `takeUntil` adds)

- `takeUntil(destroy$)` **completes the stream upstream** the instant the component unmounts —
  the same semantic as Angular's `takeUntilDestroy`. The `return () => sub.unsubscribe()` is
  kept as defense-in-depth (both fire; `Subscription.unsubscribe` is idempotent, rule 8).
- **Multiple subscriptions, one hook:** every `takeUntil(destroy$)` in the component shares the
  same destroy signal — one unmount, every stream dies. Exactly like passing `this` around.
- **Hot/cold both covered:** `useObservable` (the async-pipe path) and `useDestroy` + `takeUntil`
  (the imperative path) are the two sanctioned ways to subscribe — both end in guaranteed
  teardown.

### 🖥️ SSR note

Both hooks are SSR-safe by construction: `useEffect` never runs on the server, so no
subscription is ever created server-side; `useDestroy`'s subject is only created in the
component instance (client render) and its effect only fires in the browser. Nothing to
special-case beyond what pitfall 9 already covers.

---

# ⚠️ Part 8 — Pitfalls and mitigations

> Every pitfall below is a *real* rxjs-classic footgun that we WILL hit if we build this
> naively. Each entry: the trap → why it happens → the mitigation. **SSR-specific concerns are
> marked 🖥️** — read those carefully, because going full SSR changes how every subscription
> must be created and destroyed.

## Pitfall 1 — Forgetting to unsubscribe → memory leaks 🖥️

**The trap:** a component subscribes in `useEffect` but never unsubscribes. The observable (and
its captured closures — state, DOM refs) is retained forever. On a long-lived SPA session,
repeated mounts accumulate hundreds of dead subscriptions. On SSR, a subscription created
server-side but never torn down keeps the Node process alive / retains memory between renders.

**Why it happens:** subscriptions are *by default* infinite — unlike promises they don't
self-terminate.

**Mitigations:**

1. **Structural guarantee (not convention):** `useObservable` (item 45) *always* returns the
   `unsubscribe` as the `useEffect` cleanup. Components never call `.subscribe()` directly —
   only through the hooks. One place to get it right.
2. **`takeUntil(dispose$)` as the operator-level escape hatch** for imperative subscriptions
   (outside React):
   ```typescript
   const dispose$ = new Subject<void>();
   source$.pipe(takeUntil(dispose$)).subscribe(...);
   // later / on unmount:
   dispose$.next(); // tears down every takeUntil'd stream
   ```
3. **Dev-mode leak detector:** track active subscriptions per component in dev
   (`NODE_ENV === "development"`) and `console.warn` when a component unmounts with a still-
   open subscription count > 0.
4. **🖥️ SSR:** server-side subscriptions must be created inside the request scope and torn down
   in `finally`/`finalize` — never module-scoped (a module-scoped `interval` on the server is
   a process-level leak).

## Pitfall 2 — Unhandled errors are silent killers 🖥️

**The trap:** if an observable errors and the subscriber provided no `error` handler, the error
can be **swallowed** (we made missing handlers no-ops) — or, worse, thrown asynchronously where
nobody catches it. On the server this crashes the request (or the process, if it's an
uncaught exception); on the client it breaks the stream silently and the UI freezes on the
last value.

**Why it happens:** rxjs re-throws unhandled errors via `hostReportError` (async, uncaught);
our `Partial<Observer>` design makes it tempting to skip `error`.

**Mitigations:**

1. **`hostReportError` equivalent:** when a subscriber omits `error`, re-throw the error
   asynchronously (`setTimeout(() => { throw err; })` in dev) so it surfaces in the console
   instead of vanishing. In prod, route to `LogService.error` (see logging doc).
2. **`catchError` at the boundary:** every subscription in a component should end with
   `catchError((err) => { logError(err); return of(fallbackValue); })` — the stream recovers
   AND the error is visible.
3. **🖥️ SSR:** on the server, a stream error inside a render must be caught and converted into
   the error boundary / error page — never left to crash the whole request. Wrap server-side
   stream consumption in try/catch + `lastValueFrom` (item 13) so errors become rejected
   promises the request handler can handle.

## Pitfall 3 — Sync emission before subscription completes (hot/cold confusion) 🖥️

**The trap:** a cold observable that emits synchronously inside `subscribe()` (e.g. `of(1)`)
will deliver values *before* `subscribe()` returns — so anything set up *after* the
`subscribe()` call (like a React state setter) is fine, but code that assumes "subscribe is
async" races. Worse: a **hot** `Subject` (item 5) that emitted a value *before* you subscribed
will never deliver it — `subject.next(x); subject.subscribe(...)` receives nothing.

**Why it happens:** the sync scheduler (item 9) runs actions inline; hot subjects don't
replay.

**Mitigations:**

1. Use `BehaviorSubject`/`ReplaySubject` (items 6–7) for any state a component must read on
   mount — never a plain `Subject` for app state.
2. In `useObservable`, read the initial value from the source's current value
   (`BehaviorSubject.getValue()` — item 46) and only subscribe for *updates*; don't rely on
   the first emission arriving.
3. 🖥️ **SSR hydration mismatch:** the server render produces HTML from the *initial* value;
   the client's first paint must match it. If the stream emits on the client before hydration
   completes, the client HTML differs from the server HTML → React hydration error. Mitigate
   with the same `isInitializing` pattern already used in auth (item 30 of auth-roadmap):
   render the initial snapshot on both server and client, then let streams update after mount.

## Pitfall 4 — `switchMap` cancels *too eagerly* 🖥️

**The trap:** `switchMap` unsubscribes the previous inner the moment a new outer value arrives.
If the outer fires rapidly (typing), requests get aborted mid-flight — correct for search, but
**wrong** for "submit then navigate": the user's save could be canceled by a second click, or
by an unrelated re-emission.

**Why it happens:** `switchMap`'s semantics are "latest wins", full stop.

**Mitigations:**

1. Know the four flattener personalities by heart:
   - `switchMap` — latest wins (search, tabs, route params).
   - `concatMap` — queue in order (sequential mutations).
   - `mergeMap` — all in parallel, interleaved (bulk ops, with `concurrency` cap).
   - `exhaustMap` — ignore new while busy (submit buttons, refresh).
2. For forms/buttons use `exhaustMap` — it drops the duplicate click instead of canceling the
   in-flight work.
3. **🖥️ SSR:** route param changes on the server re-render the page — `switchMap` on route
   params is a *client-navigation* concern; on the server, each request has its own params, so
   the map function must not close over request-scoped state. Keep the   inner observable constructed inside the request scope (via `defer`, item 17).

## Pitfall 5 — Shared subscription state races (multi-subscriber bugs)

**The trap:** a *cold* observable gives each subscriber its own execution — but a `Subject` or
`shareReplay` (items 5/49) gives all subscribers ONE shared execution. If one subscriber
unsubscribes and the source is shared, other subscribers lose the stream (with naive refCount)
— or, with `shareReplay`, the cached value goes stale while a *new* subscriber thinks it's
fresh.

**Why it happens:** hot/shared semantics are invisible at the call site; the subscriber can't
tell who else is listening.

**Mitigations:**

1. **Explicit sharing policy:** use `shareReplay(1)` only at the *top* of a well-known stream
   (one per endpoint — the cache boundary), never randomly mid-pipeline.
2. **`finalize` (item 44) + refCount discipline:** when the last subscriber leaves, decide
   deliberately — does the source stop (polling stops) or keep going (websocket)? Document
   the choice per stream.
3. **Test multi-subscriber scenarios explicitly** — two components subscribing to the same
   `me$()` cache, one unmounts, the other must keep receiving.

## Pitfall 6 — The `.error()` after `.complete()` / double-termination bug

**The trap:** calling `next` after `complete` (or `error` twice) silently misbehaves — some
subscribers see the late value, others don't, depending on teardown order.

**Why it happens:** the internal `Subscriber` (item 4) must guard its own state, and our
operators must forward `closed` correctly.

**Mitigations:**

1. **The `closed` guard lives in `Subscriber`** — every `next/error/complete` on a closed
   subscriber is a no-op. This is the *single invariant* all operators rely on; write one test
   that hammers it (next-after-complete, error-after-error, unsubscribe-then-next).
2. **Idempotent `unsubscribe`** (item 3) — calling it twice must not double-run teardowns.
3. **Lint rule:** flag any call site that calls `.next()` outside a `Subject`'s owner class.

## Pitfall 7 — Overly deep pipelines hurt debuggability

**The trap:** a 12-operator pipe (`mergeMap → switchMap → combineLatest → debounceTime →
filter → map → ...`) is impossible to step through mentally; a bug hides in one operator and
stack traces point at `pipe` internals.

**Why it happens:** operators compose infinitely; nothing stops you.

**Mitigations:**

1. **Name the streams:** extract named observables (`const search$ = input$.pipe(...)`) and
   comment the contract at the top (`// emits the debounced query, completed on navigation`).
2. **`tap` for debugging only** (item 41) — `tap(console.debug)` at pipeline milestones, removed
   before merge.
3. **Keep pipelines ≤ 5–6 operators** in components; push the rest into named helper
   functions.
4. **Marble-test each operator** (item in testing section) so the operator is proven correct
   in isolation and the pipeline only composes proven parts.

## Pitfall 8 — Backpressure and lost values (buffer overflow) 🖥️

**The trap:** a fast producer (websocket messages, interval) feeding a slow consumer (HTTP
requests via `mergeMap`) either queues unboundedly (`concatMap`) or drops (`exhaustMap`) —
both silently.

**Why it happens:** observables have no built-in backpressure signal; each flattening operator
picks a policy for you.

**Mitigations:**

1. **Pick the policy explicitly per stream** and write it in the comment: queue (`concatMap`),
   drop (`exhaustMap`/`sample`), latest (`switchMap`), or cap (`mergeMap` with `concurrency`).
2. **🖥️ SSR:** on the server, never subscribe to unbounded streams during render — a
   websocket/interval that never completes would stall the request. Use `firstValueFrom`/
   `lastValueFrom` (item 13) to convert "one result" streams into awaited promises for the
   server, keeping push-streams client-only.

## Pitfall 9 — 🖥️ SSR: subscriptions during render (the big one)

**The trap:** in full SSR, components render **on the server** — and `useEffect` does **not**
run there. Any subscription logic written inside `useEffect` (or worse, inline during render)
behaves completely differently server-side: `useObservable` must not subscribe during the
server render, or it will (a) run side effects on the server, (b) emit values that differ from
the client's first paint → hydration mismatch, and (c) leak if never torn down.

**Why it happens:** React's SSR renders components synchronously to strings; effects are
client-only by design. A hook that subscribes on render subscribes on the server too.

**Mitigations:**

1. **`useObservable` must be SSR-aware** — it has three phases:
   - **Server render:** don't subscribe. Read the *initial snapshot* only
     (`BehaviorSubject.getValue()` or the `initialValue` prop). This must match what the
     client's first render produces.
   - **Client hydration:** still don't subscribe until the mount effect runs (React guarantees
     effects run after hydration). The first paint uses the initial snapshot; the effect
     subscribes immediately after, so updates arrive a tick later.
   - **Client update:** subscribe in `useEffect`, unsubscribe in cleanup. Exactly the code in
     item 45.
2. **Prefetch on the server, replay on the client:** for data the page needs to render
   (e.g. `/auth/me`), the server fetches once (`lastValueFrom`), injects the result into the
   initial props/HTML, and the client's `me$().pipe(shareReplay(1))` (item 49) replays that
   value — so server HTML and client first paint agree.
3. **Detect SSR at the hook level:** `typeof window === "undefined"` in the hook body is
   fine *inside the hook implementation* (one place), not sprinkled through components. The
   hook centralizes it.
4. **`useSyncExternalStore` for the state read** (the same primitive the auth hydration flag
   already uses — auth-roadmap #30): React's built-in SSR-safe store subscription. Build
   `useObservable` on top of it for the initial snapshot + subscription, rather than
   `useState` + `useEffect`. That's the canonical, hydration-safe pattern.

## Pitfall 10 — 🖥️ SSR: hot subjects shared across requests

**The trap:** a module-level `Subject` or `BehaviorSubject` (auth store, event bus) is fine on
one client, but **on the server it's global state shared by every request**. User A's login
emits into the same store that request B (a different user) is reading → cross-request data
leak. This is the classic "global singleton on the server" bug.

**Why it happens:** Node serves many requests in one process; module scope is process scope.

**Mitigations:**

1. **Store instances are request-scoped on the server:** create the auth/session store per
   request (`AsyncLocalStorage`-keyed, or re-created in the request handler and injected),
   and never import a module-singleton store in server-rendered components.
2. **Client-only stores:** stores that only make sense in the browser (event bus for UI
   events, cross-tab sync) should be created lazily inside `useMemo`/client components, or
   guarded so the server render never touches them.
3. **Same pattern as the existing `BroadcastChannel` sync (auth-sync.ts):** it already
   no-ops on the server — apply the same "server-safe no-op" discipline to every hot
   subject. If a store *must* be readable on the server, it must be constructed per request.
4. **Test:** render a page twice in one process (two simulated requests) and assert the
   second render never sees the first's subject state.

## Pitfall 11 — 🖥️ SSR: `fromFetch`/`interval` on the server hang or double-fetch

**The trap:** two related server issues:

- `fromFetch` (item 13) inside a server component starts a fetch per render attempt — React
  may render a component multiple times before committing, causing **duplicate API calls**
  on every SSR request.
- `interval`/`timer`/`debounceTime` on the server never fire within the render window (the
  server doesn't wait), so streams that depend on time silently produce nothing — or, if they
  hold the process open, hang the request until timeout.

**Why it happens:** server rendering is synchronous and one-shot per request; time-based and
IO-based streams assume a long-lived runtime.

**Mitigations:**

1. **One fetch per request, not per render:** hoist the data fetch to the server component
   boundary (`lastValueFrom` once, pass data down as props) — never subscribe inside child
   components that might re-render.
2. **🖥️ Time-based operators are client-only:** `interval`, `timer`, `debounceTime`,
   `throttleTime` must never be subscribed server-side. Guard at the hook level (`typeof
   window === "undefined" → return initialValue`), and enforce with a dev-mode warning when a
   scheduler-based subscription starts on the server.
3. **`timeout(ms)` on every server fetch** (item 44): the server cannot wait forever — a
   hanging API must fail the request fast and render the error page.

## Pitfall 12 — React StrictMode double-subscribing (dev only, but real)

**The trap:** React 18+ StrictMode mounts, unmounts, and remounts every component in dev. A
naive `useObservable` subscribes twice, and if cleanup is wrong, the first subscription
leaks and the stream emits twice per update.

**Why it happens:** StrictMode deliberately double-invokes effects to surface missing
cleanups.

**Mitigations:**

1. **Correct cleanup is the fix:** `useEffect(() => { const sub = ...; return () =>
   sub.unsubscribe(); }, [source])` is StrictMode-safe — the cleanup runs between the two
   mounts, so the second subscribe is clean. Never subscribe without a cleanup.
2. **Cold sources re-run per subscription** — that's *correct*; the double-mount just means
   two fetches in dev. Use `shareReplay(1)` (item 49) at the cache boundary so the second
   subscription replays instead of re-fetching.
3. **Test in StrictMode:** the test suite should render components inside `<StrictMode>` and
   assert subscription counts return to zero after unmount.

## Pitfall 13 — Error inside a flattening operator kills the whole chain

**The trap:** one inner request erroring inside `mergeMap`/`switchMap`/`concatMap` propagates
up and **terminates the entire outer stream** — even when the outer source was healthy. The
UI loses *all* updates, not just the failed one.

**Why it happens:** operators forward `error` upstream by design; there's no per-item isolation
unless you add it.

**Mitigations:**

1. **Isolate inner errors:** wrap inner observables with `catchError(() => of(fallback))`
   (item 42) so a failing item emits a fallback instead of killing the stream. For "collect
the ones that succeeded" semantics, let each inner complete with `EMPTY` on error and
   collect the successes.
2. **`materialize`/`dematerialize` equivalent:** if full rxjs parity is wanted, emit
   `{ kind: "next" | "error" | "complete", value? }` wrappers instead of raw values so the
   pipeline can filter errors instead of dying on them.
3. **Document per-stream error policy** in the named-stream comment (item 7 of pitfalls):
   "errors isolated per item" vs "first error kills the batch".

## Pitfall 14 — 🖥️ SSR: fetching inside the reactive store (double source of truth)

**The trap:** if the new store (item 47) also triggers API calls (`state$.pipe(switchMap(() =>
api.me$()))`), then on the server the store's fetch and the server component's own prefetch
(item 9 of pitfalls) both fire → duplicate requests, and the two results may disagree →
hydration mismatch.

**Why it happens:** two mechanisms (store-driven fetching + render-driven prefetch) competing
for the same data.

**Mitigations:**

1. **Single source of truth:** decide who fetches — either the server prefetches and seeds the
   store, or the store fetches and the page waits. Do not do both.
2. **Seed-then-subscribe:** the server prefetch result seeds the `BehaviorSubject`
   (`store.seed(data)`), and the store's fetch path only runs client-side on invalidation.
3. **Hydration-safe initial value:** the seeded value is exactly what both server HTML and
   client first paint render — then live updates arrive post-hydration.

## Pitfall 15 — Testing: time-based operators are flaky without a virtual scheduler

**The trap:** `debounceTime(300)` in a unit test either waits real 300ms (slow, flaky) or, if
the test mocks timers crudely, breaks the operator's internal scheduling. CI turns into a
coin-flip.

**Why it happens:** time operators depend on wall-clock scheduling (item 9) unless injected.

**Mitigations:**

1. **`TestScheduler` (virtual time):** build a test scheduler that advances time manually
   (`scheduler.advance(300)`). The production scheduler is injected via the operator
   signatures (default = real scheduler; tests pass the virtual one). This is how rxjs does
   marble testing — replicate the *concept*, not the library.
2. **Marble syntax:** represent streams as strings (`"a-b--(c|)"`) and assert output
   (`expect(actual).toBeMarble("a-b--(c|)")`). A tiny `toMarble` helper in the test utils
   makes every operator test readable.
3. **Coverage rule:** every time-based operator (items 15, 32, 44) must have a virtual-time
   test; never test them with real timers.

---

# 🧪 Part 8½ — Testing strategy (marble syntax, virtual scheduler, leak detector)

> Testing is not an afterthought for a reactive core — **it's the mechanism that makes the 8
> unsubscribe rules (Part 9) enforceable**. Pitfall 7 and pitfall 15 already point at "the
> testing section"; this is it. Three pillars: **marble syntax** for readable stream
> assertions, a **virtual scheduler** (`TestScheduler`) so time-based operators test in
> milliseconds instead of wall-clock seconds, and a **leak-detector test pattern** that proves
> every subscription dies. All tests run under **vitest** (already in the repo — see
> `apps/admin/vitest.config.ts`); `packages/reactive` gets its own vitest config wired into
> the turbo pipeline.

> ✅ **SHIPPED (2026-08-05):** all three pillars are real code. `TestScheduler` (virtual
> time, `TEST_MAX_FRAME`, pending-action flush check), `cold`/`hot`/`toMarble`/`parseMarble`,
> and the **leak detector** — a module-scope registry in `subscription.ts` that every live
> `Subscription` joins on construction and leaves on `unsubscribe()` (which `Subscriber`'s
> `error`/`complete` run automatically). Exported from `@workspace/reactive/testing`:
>
> - `activeSubscriptionCount()` — live subscriptions right now.
> - `activeSubscriptionSnapshot()` — newest-first, for diagnostics.
> - `assertNoActiveSubscriptions(label?)` — **throws with the leak count + offender sample
>   if any subscription is still alive.**
>
> **Scheduler leak contract (important):** every scheduler's handle must self-close when
> its action FIRES, not just when cancelled — otherwise a fired timer leaves a
> registered-but-dead subscription and the registry never empties. `asyncScheduler`,
> `syncScheduler` and `TestScheduler.advanceTo` all honor this (the `TestScheduler` closes
> the handle right before running the action, so a self-rescheduling `interval` leaves only
> the newest handle live). The badge's own pipeline test ends with
> `assertNoActiveSubscriptions("session badge streams")` after unsubscribing all three
> streams — the kill-switch proof that a well-formed stream graph tears down to zero.

## 🧭 Test file layout

```
packages/reactive/
  src/
    observable.ts                # item 1
    ...
    __tests__/
      observable.test.ts         # one spec per public API
      subject.test.ts
      operators-map.test.ts
      operators-flattening.test.ts
      operators-time.test.ts     # virtual-scheduler only
      operators-combination.test.ts
      hooks.test.tsx             # useObservable / useBehaviorSubject / useDestroy
      stores.test.ts
      leak-detector.test.ts
      ssr.test.tsx               # renderToString scenarios
      marbles.test.ts            # the marble engine itself
```

**The contract:** every public symbol in `src/index.ts` has at least one spec. Every operator
gets **two** tests — a behavior test (what it emits) and a teardown test (what it cleans
up). Every time-based operator (items 15, 32, 43–44) is tested **only** with the virtual
scheduler.

## 1️⃣ Marble syntax — streams as strings

A marble string is a **timeline**: each character is one virtual frame (1 frame = 1 ms of
virtual time; our `TestScheduler`'s `frameTimeFactor` is 1, unlike rxjs's 10 — simpler to
reason about).

| Character | Meaning |
| --------- | ------- |
| `-` | one empty frame (time passes, nothing emits) |
| `a` `b` `c` | a value emission (single character; real values go in the `values` map) |
| `(ab|)` | multiple events on the **same frame** (a group) |
| `|` | `complete()` |
| `#` | `error()` |
| `^` | the subscription point (hot sources only) |
| `!` | the unsubscription point (hot sources only) |

Values that aren't single characters use the `values` map — `cold("a-b", { a: 1, b: 2 })` —
so tests read as `a`/`b` instead of raw objects.

```typescript
// packages/reactive/src/__tests__/helpers/marbles.ts (sketch)
export function cold<T>(marbles: string, values?: Record<string, T>): Observable<T>;
export function hot<T>(marbles: string, values?: Record<string, T>): Subject<T>;
export function toMarble<T>(source: Observable<T>, scheduler: TestScheduler): string;
```

- `cold(marbles)` — a **cold** observable: each subscription re-runs the timeline (per-item
  independence, like the real cold sources in items 1/17).
- `hot(marbles)` — a `Subject` driven by the timeline: late subscribers miss earlier frames;
  use `^` to place the subscription point.
- `toMarble(actual, scheduler)` — subscribes, records `{frame, kind, value}`, and formats the
  result back into a marble string so assertions read top-to-bottom as timelines.

**Example 1 — `debounceTime` (item 32), including the complete-flush subtlety:**

```typescript	test("debounceTime(2) emits the last value after silence, and drops the pending one on complete", () => {
		const scheduler = new TestScheduler();
		const input = cold("--a--b--c|", scheduler);    // a@2, b@5, c@8, complete@9
		const output = input.pipe(debounceTime(2, scheduler));
		expect(toMarble(output, scheduler)).toBe("----a--b-|");
		//                     frames: 0123456789
		//  a@2 waits 2 silent frames → emitted @4; b@5 → @7;
		//  c@8 is still pending when | arrives @9 → DROPPED (rxjs-faithful:
		//  debounceTime does NOT flush the trailing value on completion).
	});
```

**Example 2 — `switchMap` cancellation is *visible* in the marbles (item 20):**

```typescript
test("switchMap subscribes a fresh inner per outer value", () => {
	const scheduler = new TestScheduler();
	const outer = cold("--a-b-|");
	const inner = (v: string): Observable<string> => cold(`-${v}-|`, { [v]: v.toUpperCase() });
	const output = outer.pipe(switchMap(inner));
	expect(toMarble(output, scheduler)).toBe("---A--B-|");
});
```

> **Marble hygiene rules:** (1) one marble string = one timeline — never assert with real
> timers. (2) Add the frame ruler as a comment for non-trivial expectations. (3) Use `#` and
> `(x|)` groups deliberately — they document error and simultaneous-emission semantics. (4)
> For hot sources always mark `^`/`!` — an unmarked hot test silently asserts the *wrong*
> subscription window.

## 2️⃣ Virtual scheduler — time without waiting

**Why:** pitfall 15. `debounceTime(300)` under real timers makes CI a coin-flip. The fix is a
`TestScheduler` that owns virtual time — and the design decision that makes this possible is
**scheduler injection**: every time-based operator takes an optional `scheduler` as its **last
argument**, defaulting to the real scheduler. That injection seam is item 9's `SchedulerLike`.

```typescript
// packages/reactive/src/schedulers/test-scheduler.ts (sketch)
export class TestScheduler implements SchedulerLike {
	public now(): number { return this.currentFrame; }
	public schedule(action: () => void, delayMs?: number): Subscription {
		// queue the action at (currentFrame + delayMs); return a Subscription whose
		// teardown de-queues it — canceling a pending timer is free in virtual time.
	}
	public advanceTo(frame: number): void { /* run all actions ≤ frame, in order */ }
	public advanceBy(frames: number): void { this.advanceTo(this.currentFrame + frames); }
	public flush(): void { /* run everything, then assert zero pending actions */ }
}
```

**The seam that makes marble tests possible — operator signatures:**

```typescript
export function debounceTime<T>(ms: number, scheduler?: SchedulerLike): Operator<T, T>;
export function interval(periodMs: number, scheduler?: SchedulerLike): Observable<number>;
export function timeout<T>(ms: number, scheduler?: SchedulerLike): Operator<T, T>;
// same for timer, throttleTime, auditTime, sampleTime, retryWhen's backoff, and the
// future delay() operator
```

Production code never passes a scheduler (defaults kick in); tests pass `new TestScheduler()`.
This is exactly the trick rxjs itself uses — replicate the concept, not the library.

**Rules for virtual-time tests:**

1. **Synchronous execution:** `advanceTo`/`advanceBy` run actions inline — never `await`
   inside a marble test. An `await` escapes virtual time and the test silently becomes
   real-time and flaky.
2. **Never mix real + virtual in one test:** a test that needs real promises (`fromFetch`
   with a mocked `fetch`, item 13) runs in **two phases** — real microtasks first, virtual
   time second — never interleaved.
3. **End with `flush()`:** it asserts **zero pending actions**. That single assertion is the
   scheduler-level leak check — an `interval` whose subscription wasn't torn down fails the
   test automatically (ties into Rule 3/7, Part 9).
4. **Cooldown/backoff tests** (the stream-level analog of auth-roadmap #28/#29) use virtual
   time — assert the stream re-attempts exactly after the cooldown, without waiting real
   seconds.

**Which tests get the virtual scheduler:**

| Test target | Scheduler |
| ----------- | --------- |
| `interval`, `timer` (item 15) | `TestScheduler` |
| `debounceTime`/`throttleTime`/`auditTime`/`sampleTime` (item 32) | `TestScheduler` |
| `timeout` + `retryWhen` backoff (items 43–44) | `TestScheduler` |
| everything else (pure operators) | none |
| `fromFetch`/`fromPromise` (item 13) | real microtasks + mocked `fetch`/promise |

## 3️⃣ Leak-detector test pattern

The dev leak detector (unsubscribe Rule 7) tracks live subscriptions per hook instance and
warns on unmount with a non-zero count. To test **it** — and to prove every subscription
dies — use these escalating patterns:

**Pattern A — operator teardown contract (unit, applied to every operator):**

```typescript
// packages/reactive/src/__tests__/helpers/teardown.ts
export function assertTeardown<T>(build: (src: Observable<T>) => Observable<T>): void {
	const teardown = vi.fn();
	const source = new Observable<T>((observer) => {
		observer.next();
		return teardown;                        // the source's cleanup
	});
	const sub = build(source).subscribe({ next: vi.fn() });
	sub.unsubscribe();
	expect(teardown).toHaveBeenCalledTimes(1);  // cleanup ran exactly once
	expect(sub.isClosed).toBe(true);            // Rule 8
}
```

Flattening operators (items 20–23) get a stronger variant that asserts **every inner
subscription is closed** after one outer `unsubscribe`:

```typescript
test("switchMap tears down the active inner on outer unsubscribe", () => {
	const innerSubs: Subscription[] = [];
	const source = new Observable<string>((o) => { o.next("a"); return () => {}; });
	const output = source.pipe(switchMap((v) => {
		const inner = cold("a-b-|").subscribe();
		innerSubs.push(inner);
		return cold("a-b-|");
	}));
	const sub = output.subscribe();
	sub.unsubscribe();
	expect(innerSubs.every((s) => s.isClosed)).toBe(true);   // Rule 3
});
```

**Pattern B — StrictMode render pass (integration, hooks, Rule 2/7):**

```typescript
// hooks.test.tsx
test("useObservable subscribes once and unsubscribes on unmount (StrictMode)", () => {
	const tracker = new SubscriptionTracker();                 // dev leak detector
	renderHook(() => useObservable(interval(1000), 0), { wrapper: StrictMode });
	expect(tracker.activeCount).toBe(1);                       // one live sub, not two
	unmount();
	expect(tracker.activeCount).toBe(0);                       // returned to zero
});
```

**Pattern C — the leak detector tests itself (Rule 7):**

```typescript
test("leak detector warns when a subscription survives unmount", () => {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const tracker = new SubscriptionTracker();
	const badHook = (): void => { tracker.track(interval(1000).subscribe()); };  // forgets
	renderHook(badHook);
	unmount();
	expect(warn).toHaveBeenCalledWith(expect.stringContaining("unsubscribed"));
});
```

**Pattern D — SSR: no cross-request leakage (pitfalls 9–10, Rule 6):**

```typescript
// ssr.test.tsx
test("two renderToString passes never share subject state", () => {
	// render pass 1 with store A → dispatch user A → capture HTML1
	// render pass 2 with a FRESH store (per-request, pitfall 10) → assert HTML2
	// contains no trace of user A — proves request-scoped stores, Rule 6
});
```

Plus the **scheduler flush assertion** (rule 3 above) and a **timer-leak scan**: after the
suite, assert the process holds no pending `setInterval`/`setTimeout` handles originating
from the library (`vi.getTimerCount()` under vitest fake timers, or equivalent).

**How the patterns enforce the 8 unsubscribe rules (Part 9):**

| Rule | Enforcing test |
| ---- | -------------- |
| 1. `subscribe()` always returns `Subscription` | type-level compile-fail fixture + lint rule |
| 2. Hooks own subscriptions | Pattern B (StrictMode pass) |
| 3. Operators add children | Pattern A (inner-sub closed assertions) |
| 4. `takeUntil(dispose$)` imperative | test: `dispose$.next()` completes the stream and closes the sub |
| 5. `finalize` resource cleanup | test: `finalize` fires on error, complete, AND unsubscribe |
| 6. 🖥️ Server subs are request-scoped | Pattern D (render twice, fresh stores) |
| 7. Dev leak detector | Pattern C |
| 8. `closed` after unsubscribe | Pattern A's `isClosed` assertion + the pitfall-6 hammer test |

## ✅ Coverage + CI gates

1. **Per-operator:** behavior test + teardown contract test (Pattern A). An operator with
   only one test does not ship.
2. **Time-based operators (15, 32, 43–44):** virtual-scheduler tests only — the code-review
   checklist rejects real-timer tests for these (pitfall 15).
3. **Hooks (45–46, 7½):** each gets a StrictMode pass (Pattern B) + a `renderToString` SSR
   test (Pattern D).
4. **Coverage floor:** `packages/reactive` ≥ **95% branch coverage** — the core is tiny, so
   this is achievable, and it keeps the unsubscribe paths honest.
5. **CI wiring:** `pnpm --filter @workspace/reactive test` joins the turbo pipeline; the
   StrictMode + SSR passes run in CI, not just locally (Rule 7).
6. **Marble engine self-test:** `marbles.test.ts` tests the `cold`/`hot`/`toMarble` helpers
   themselves — a bug in the test harness is the worst kind of bug (green CI, broken
   streams).

---

# ✅ Part 9 — Unsubscribe guarantees (the non-negotiables)

> The requirement: **every subscription has unsubscribe**. Not "we try", not "mostly" —
> structurally guaranteed. These are the rules the implementation and review process enforce:

## Rule 1 — `subscribe()` always returns `Subscription`

`Observable.subscribe` (item 1) returns `Subscription` (item 3) in **every** overload — there is
no `void` path, no fire-and-forget API. A lint rule enforces that the return value is used or
assigned.

## Rule 2 — Hooks own their subscriptions

`useObservable` (45), `useBehaviorSubject` (46), and any future hook return `unsubscribe` as
their `useEffect` cleanup (or use `useSyncExternalStore`, whose unsubscribe is built-in).
Components **never** call `.subscribe()` directly — there's no way to forget, because there's
no API to misuse.

## Rule 3 — Operators add children to the parent Subscription

Every flattening/combination operator (19–26, 33–40) subscribes its inner sources and adds
those inner `Subscription`s as **children** (item 3's `add`). Unsubscribing the outer tears
down all inners — including pending `fromFetch` aborts and pending scheduler timers. One
unsubscribe call, everything stops.

## Rule 4 — `takeUntil(dispose$)` for imperative code

The only sanctioned way to subscribe outside React is `source$.pipe(takeUntil(dispose$))`
where `dispose$` is a `Subject` owned by the same scope that will outlive the stream. `next()`
on `dispose$` = teardown. A code-review checklist item, not a lint rule.

**In components, `dispose$` is `useDestroy()`** (Part 7½) — the Angular `takeUntilDestroy(this)`
equivalent. One hook, shared by every imperative subscription in the component; unmount fires
it and every stream completes.

## Rule 5 — `finalize` for resource cleanup

Anything that *owns a resource* (AbortController, socket, timer, event listener) cleans it in
the teardown **and** in `finalize` (item 44) so even an abnormal termination (error path)
can't leak.

## Rule 6 — 🖥️ Server subscriptions are request-scoped

On the server, every subscription lives inside the request's scope and is torn down when the
request completes (in a `finally`/`finalize`). Module-scope subscriptions on the server are a
**review-blocking** defect.

## Rule 7 — The dev leak detector

In dev, the runtime tracks live subscriptions per hook instance and warns on unmount with
non-zero counts. CI runs a StrictMode render pass asserting counts return to zero.

## Rule 8 — `closed` after unsubscribe

`Subscription.isClosed === true` after `unsubscribe()`; any further `next/error/complete` on
that path is a no-op (the `Subscriber` guard, item 4). A unit test suite asserts this for
every operator.

---

# 📊 Part 10 — rxjs coverage matrix

> Every operator/feature below maps to an item in this design. Nothing ships under the rxjs
> name; all of it is our own `packages/reactive` implementation.

| rxjs feature | Our item | Notes |
| ------------ | -------- | ----- |
| `Observable` / `subscribe` | 1 | cold, lazy, returns `Subscription` |
| `Observer` / `PartialObserver` | 2 | missing handlers are safe no-ops |
| `Subscription` (+ `add`/`remove`) | 3 | compound teardown — the unsubscribe guarantee |
| `Subscriber` | 4 | `closed` guard, internal only |
| `Subject` | 5 | hot multicast event bus |
| `BehaviorSubject` | 6 | current value + replay — app state |
| `ReplaySubject` | 7 | buffered replay |
| `AsyncSubject` | 8 | last value on complete |
| `Scheduler` / `SchedulerLike` | 9 | sync/async/interval subset + cancelable |
| `pipe` / operators | 10 | pure-function composition |
| `of` | 11 | |
| `from` | 12 | array / iterable / promise / observable |
| `fromPromise` / `fromFetch` | 13 | AbortController cancellation |
| `fromEvent` / `fromEventPattern` | 14 | auto `removeEventListener` |
| `interval` / `timer` | 15 | cancelable timers |
| `EMPTY` / `NEVER` / `throwError` | 16 | sentinels |
| `defer` | 17 | per-subscription setup (cold HTTP) |
| `range` / `generate` | 18 | |
| `map` / `mapTo` / `pluck` | 19 | |
| `switchMap` | 20 | cancels previous inner + aborts fetch |
| `mergeMap` / `flatMap` | 21 | concurrency cap |
| `concatMap` | 22 | ordered queue |
| `exhaustMap` | 23 | ignore while busy |
| `scan` / `reduce` | 24–25 | |
| `pairwise` / `buffer*` | 26 | windowing |
| `filter` | 27 | |
| `take` / `takeWhile` / `takeUntil` | 28 | `takeUntil` is the cleanup workhorse |
| `skip` / `skipWhile` / `skipUntil` | 29 | |
| `first` / `last` / `single` | 30 | |
| `distinctUntilChanged` | 31 | |
| `debounceTime` / `throttleTime` / `auditTime` / `sampleTime` | 32 | cancelable via scheduler |
| `merge` / `mergeAll` | 33 | |
| `concat` / `concatAll` | 34 | |
| `combineLatest` | 35 | |
| `withLatestFrom` | 36 | |
| `forkJoin` | 37 | the `Promise.all` replacement |
| `zip` | 38 | |
| `race` | 39 | |
| `startWith` / `endWith` | 40 | |
| `tap` | 41 | |
| `catchError` | 42 | stream-level recovery |
| `retry` / `retryWhen` / `repeat` | 43 | backoff retries |
| `finalize` / `timeout` | 44 | guaranteed cleanup + deadlines |
| `useObservable` (React) | 45 | the **async-pipe equivalent** — SSR-aware, auto-unsubscribe |
| `<Subscribe>` render-prop | 45b | `| async`-in-JSX ergonomics (Part 7½) |
| `useDestroy()` + `takeUntil` | 28 + 7½ | the **`takeUntilDestroy` equivalent** |
| `useBehaviorSubject` | 46 | store selector hook |
| `createStore` | 47 | mini-ngrx on `BehaviorSubject` |
| `ReactiveApiClient` | 48 | replaces `useApi` + React Query |
| `shareReplay` / `share` | 49 | the cache + multicast operator |
| `createEventBus` / SSE/WS channel | 50 | push streams + guaranteed close |

**Deliberately excluded (out of scope for v1):** `groupBy`, `window*` (full windowing),
`connectable`/`multicast` (low-level), `animationFrameScheduler`, `forkJoin` of dictionaries
(arrays are fine), and `retryWhen`'s full generality (a `delay`-based backoff helper covers
our cases). Add them later only if a real need appears — every addition must keep the
unsubscribe rules intact.

---

# 🗺 Part 11 — Migration plan (from promises to streams)

> How to move the existing app over without a big-bang rewrite. The key insight: **the core
> ships first as an additive library; apps migrate endpoint-by-endpoint.**

## Phase 0 — Build `packages/reactive` (items 1–10)

Core primitives + `pipe` + tests (including the virtual scheduler). ~500 lines. Land as a new
workspace package; no app code depends on it yet.

## Phase 1 — Operators + hooks (items 11–46)

Creation/transformation/filtering/combination/utility operators + `useObservable`/
`useBehaviorSubject` + tests. Still additive — nothing in the apps changes.

## Phase 2 — Wire the first real stream (item 48, one endpoint)

Pick **one** read endpoint (e.g. `sessionStatus`). Build `ReactiveApiClient.me$()` beside the
old `useApi`, use `useObservable` in one component. Prove the 401-refresh + caching behavior
in production use before scaling.

## Phase 3 — Migrate auth state (items 6, 46, 47, 49)

Move the auth context's state (`auth.tsx`) onto a `BehaviorSubject` store: `isAuthenticated`,
`isInitializing`, user profile. Keep the existing cookie/BroadcastChannel machinery — the
store observes it, components read the store.

## Phase 4 — Replace React Query cache usage endpoint-by-endpoint

Each `useQuery`/`useMutation` call site becomes `useObservable(api.x$())`. The `QueryProvider`
goes away once the last call site migrates. `shareReplay(1)` per endpoint (item 49) replaces
cache/staleTime; invalidation is a `Subject` the logout/refresh flow `next()`s.

## Phase 5 — Kill the promise plumbing in app code

Remove `use-api.ts`'s React Query wrapper (keep `request()` internals if still used), update
`auth.tsx` to stream-based refresh, retire `useEffect` + `setInterval`/`addEventListener`
patterns via `fromEvent`/`interval` + `takeUntil`.

## Phase 6 — 🖥️ Full SSR hardening (if/when we go full SSR)

Apply pitfalls 9–14 systematically: SSR-aware hooks, request-scoped stores, server prefetch +
client replay, hydration-safe initial values, and the dev leak detector in CI.

> **Exit criteria per phase:** all tests green, no regressions in the migrated components, and
> every new subscription satisfies the 8 unsubscribe rules (Part 9). Roll back a phase if the
> leak detector or StrictMode pass flags anything.

---

_Last updated: 2026-08-05._
