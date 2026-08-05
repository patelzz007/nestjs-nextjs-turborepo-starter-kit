// ============================================
// lib/session-badge.ts - Session badge stream pipeline
// ============================================
//
// The `SessionStatusBadge` rewritten on `@workspace/reactive` — the Phase-1
// "kill-switch" proof. Everything the imperative version did with two
// useEffects, a setInterval, a visibilitychange listener and two useRefs is
// now ONE declarative pipeline. The component is a thin subscriber; this
// module is pure (no React, no direct DOM access) and fully unit-testable
// with the TestScheduler + leak detector from `@workspace/reactive/testing`.

import {
	fromEvent,
	fromPromise,
	merge,
	startWith,
	shareReplay,
	distinctUntilChanged,
	filter,
	map,
	switchMap,
	timer,
	asyncScheduler,
	type Observable,
	type SchedulerLike,
} from "@workspace/reactive";
import { ApiError } from "@workspace/client/lib/use-api";
import type { SessionStatus } from "@workspace/shared";

// ── State types ────────────────────────────────────────────────────────────
// A discriminated union, not booleans: "loading | error | ready" is the full
// lifecycle of one fetch, and the stream NEVER dies on an error state (the
// next poll simply emits again — see `fetchSessionState`).

export type SessionState =
	{ readonly status: "loading" } | { readonly status: "error"; readonly errorMessage: string } | { readonly status: "ready"; readonly session: SessionStatus };

// ── Small pure helpers ─────────────────────────────────────────────────────

/** Seconds until `expiresAt` from `now`, floored at 0. */
export function secondsUntil(expiresAt: string, now: Date): number {
	const remaining = new Date(expiresAt).getTime() - now.getTime();
	return Math.max(0, Math.round(remaining / 1000));
}

/**
 * True when a silent refresh rotated the token: the new `expiresAt` is strictly
 * later than the previously observed one. Compared as epoch milliseconds rather
 * than ISO strings because the API permits offset-bearing timestamps
 * (`+08:00` etc.), which don't sort lexicographically against UTC `Z` strings.
 * The first sighting (`previous === null`) never counts as a rotation.
 */
export function didTokenRotate(previous: string | null, next: string | null): boolean {
	if (previous === null || next === null) return false;
	return new Date(next).getTime() > new Date(previous).getTime();
}

/** Map a failed fetch into a friendly error message (error shaping at the boundary). */
export function toSessionErrorMessage(err: Error): string {
	if (err instanceof ApiError && err.statusCode === 401) {
		return "Session expired — please log in again";
	}
	return "Session check failed — network or server error";
}

/**
 * Run one fetch and normalize the outcome into a `SessionState`.
 *
 * Errors are caught HERE (not via a catchError operator) so the stream stays
 * alive across transient failures: a poll that hits a dead API emits an
 * "error" state, and the NEXT poll retries automatically. The try/catch also
 * guards against a synchronous throw, which `fromPromise` alone cannot see.
 */
export async function fetchSessionState(fetchSession: () => Promise<SessionStatus>): Promise<SessionState> {
	try {
		const session = await fetchSession();
		return { status: "ready", session };
	} catch (err) {
		return { status: "error", errorMessage: toSessionErrorMessage(err instanceof Error ? err : new Error(String(err))) };
	}
}

/**
 * Poll-duplicate suppressor: identical results (same user, same expiry) don't
 * re-emit, so the view doesn't re-render on every quiet poll.
 */
export function sameSessionState(a: SessionState, b: SessionState): boolean {
	// Each branch narrows BOTH operands explicitly — TypeScript cannot relate
	// `a.status` to `b.status` through the equality check alone, so a single
	// `if (a.status === "error")` would leave `b.errorMessage` un-narrowed.
	if (a.status === "error" && b.status === "error") {
		return a.errorMessage === b.errorMessage;
	}
	if (a.status === "ready" && b.status === "ready") {
		const s = a.session;
		const t = b.session;
		return s.email === t.email && s.fullName === t.fullName && s.expiresAt === t.expiresAt;
	}
	return a.status === b.status; // loading/loading → true; anything mixed → false
}

// ── SSR-safe visibility defaults ───────────────────────────────────────────

/** Current document visibility; true on the server (nothing is hidden). */
export function isDocumentVisible(): boolean {
	if (typeof document === "undefined") return true;
	return document.visibilityState === "visible";
}

/**
 * Default visibility-event source. SSR-safe: on the server (and in Node tests)
 * there is no `document`, so we attach to a throwaway EventTarget that never
 * fires — the stream then only emits via `startWith` (the initial visibility).
 * It is never subscribed server-side anyway; this just makes construction safe.
 */
export function defaultVisibilitySource(): Observable<Event> {
	const target: EventTarget = typeof document === "undefined" ? new EventTarget() : document;
	return fromEvent(target, "visibilitychange");
}

// ── The pipeline ───────────────────────────────────────────────────────────

// ── Poll interval configuration ────────────────────────────────────────────

// ── Poll interval configuration ────────────────────────────────────────────

/**
 * Env var controlling how often the badge refetches the session while the tab
 * is visible (`NEXT_PUBLIC_*` so it is inlined into the browser bundle):
 * - Unset / empty / `0` / invalid → steady polling DISABLED (the countdown
 *   still ticks locally from the mount-fetched `expiresAt`, so a zero-poll
 *   badge is fully functional — rotation detection just waits for a
 *   mount / tab-return / navigation fetch instead of a timer).
 * - any positive int           → poll at that many milliseconds (opt-in, for
 *   proactive rotation/session-death detection while idling).
 *
 * IMPORTANT: it must be read as the LITERAL `process.env.NEXT_PUBLIC_SESSION_POLL_MS`
 * (see the default in `buildSessionBadgeStreams`) — Next.js only inlines
 * `NEXT_PUBLIC_*` vars for literal property access, never bracket access.
 */

/**
 * Resolve the poll interval from the env var. Pure + injectable for tests.
 * Returns `null` (steady polling disabled) for unset/empty/`0`/invalid input,
 * otherwise the positive millisecond value. Zero-polling is the DEFAULT — the
 * countdown is computed locally from the exp claim, so polling is an opt-in
 * extra, never a requirement.
 */
export function resolvePollMs(envValue: string | null | undefined): number | null {
	if (envValue === undefined || envValue === null || envValue.trim() === "") {
		return null;
	}
	const parsed = Number(envValue.trim());
	if (!Number.isFinite(parsed) || parsed < 0) {
		return null;
	}
	return parsed === 0 ? null : Math.round(parsed);
}

export interface SessionBadgeStreamParams {
	/** Authenticated fetch — the client's 401 → silent-refresh → retry pipeline lives here. */
	readonly fetchSession: () => Promise<SessionStatus>;
	/** Current-visibility reader (injectable for tests). Defaults to the document. */
	readonly isVisible?: () => boolean;
	/** Visibility-change events (injectable for tests). Defaults to `document`. */
	readonly visibilityChanges?: Observable<Event>;
	/**
	 * Steady-poll interval in ms. Defaults to `resolvePollMs(process.env[NEXT_PUBLIC_SESSION_POLL_MS])`
	 * (5 minutes, env-tunable). Pass `null` to disable steady polling entirely.
	 */
	readonly pollMs?: number | null;
	readonly tickMs?: number;
	readonly pulseMs?: number;
	readonly scheduler?: SchedulerLike;
}

export interface SessionBadgeStreams {
	/** The data: loading → ready/error, re-fetched on every poll. */
	readonly sessionState$: Observable<SessionState>;
	/** The countdown: seconds-left, re-emitted every second while ready + visible. */
	readonly secondsLeft$: Observable<number | null>;
	/** The pulse: `true` for `pulseMs` right after a rotation, then `false`. */
	readonly rotationPulse$: Observable<boolean>;
}

/**
 * Build the badge's three streams.
 *
 * Topology, top to bottom:
 *
 *   visible$  = visibility changes → map to boolean → startWith(current)
 *              → distinctUntilChanged          (emits only on CHANGE)
 *
 *   triggers$ = merge(
 *                timer(pollMs, pollMs) → filter(visible),   // steady poll
 *                visible$ → filter(true),                    // mount + tab-return
 *              )
 *
 *   sessionState$ = triggers$ → switchMap(fetchSessionState)
 *                  → distinctUntilChanged(sameSessionState)
 *
 *   secondsLeft$  = sessionState$ → filter(ready)
 *                  → switchMap(timer(0, tickMs) → filter(visible)
 *                             → map(secondsUntil))
 *
 *   rotationPulse$= sessionState$ → filter(ready) → map(expiresAt)
 *                  → distinctUntilChanged(!didTokenRotate) → filter(index > 0)
 *                  → switchMap(timer(pulseMs) → map(false) → startWith(true))
 *
 * Why this shape:
 * - The countdown and the poll run on different clocks; each is gated by the
 *   same cheap visibility filter, so nothing fetches or re-renders in a hidden
 *   tab — a real improvement over the old code, whose setInterval kept firing.
 * - `switchMap` gives us "latest wins" on every layer: a new poll result
 *   cancels an in-flight fetch's re-emission, a new session restarts the
 *   countdown clock, a new rotation restarts the 2s pulse window.
 * - No stream ever completes or errors: transient failures surface as "error"
 *   STATE and the next poll recovers. The badge is self-healing by design.
 */
export function buildSessionBadgeStreams(params: SessionBadgeStreamParams): SessionBadgeStreams {
	const {
		fetchSession,
		isVisible = isDocumentVisible,
		visibilityChanges = defaultVisibilitySource(),
		// NOTE: literal `process.env.NEXT_PUBLIC_*` access — Next.js only inlines
		// NEXT_PUBLIC_ vars for literal property access (bracket access with a
		// computed key is NOT replaced at build time and would crash in the browser).
		pollMs = resolvePollMs(process.env.NEXT_PUBLIC_SESSION_POLL_MS),
		tickMs = 1_000,
		pulseMs = 2_000,
		scheduler = asyncScheduler,
	} = params;

	// ── Master gate: current visibility, then only on hidden↔visible CHANGES.
	const visible$ = visibilityChanges.pipe(
		map(() => isVisible()),
		startWith(isVisible()),
		distinctUntilChanged(),
	);

	// ── Fetch triggers. The union type keeps the variadic merge happy whether
	//    the steady-poll arm is present (Observable<number>) or not (only
	//    Observable<boolean>); the value is ignored by the switchMap below.
	const pollArm: Observable<boolean | number>[] = pollMs === null ? [] : [timer(pollMs, pollMs, scheduler).pipe(filter(() => isVisible()))];
	const refetchTriggers$ = merge(
		// Steady-state poll (first fetch happens at pollMs, not immediately —
		// the mount + tab-return branch below owns the immediate fetch).
		// Skipped entirely when `pollMs` is null (steady polling disabled):
		// fetches then happen only on mount and tab-return.
		...pollArm,
		// Mount (startWith(true) → first emission) and every tab-return.
		visible$.pipe(filter((visible) => visible)),
	);

	// ── The data stream.
	// `shareReplay(1)` is CRITICAL: the component subscribes this stream directly
	// AND via secondsLeft$ and rotationPulse$ (three subscriptions). Without it,
	// each subscription would start its own cold pipeline — three poll timers,
	// three visibility listeners, three fetches per cycle. shareReplay collapses
	// them into ONE source pipeline shared by all subscribers (refCount: torn
	// down when the last subscriber leaves).
	const sessionState$ = refetchTriggers$.pipe(
		switchMap(() => fromPromise(fetchSessionState(fetchSession))),
		distinctUntilChanged(sameSessionState),
		shareReplay(1),
	);

	// ── The live countdown (ready-only, ticks while visible).
	const secondsLeft$ = sessionState$.pipe(
		// Type-guard predicate: narrows `state` to the ready variant downstream.
		filter((state): state is SessionState & { readonly status: "ready" } => state.status === "ready"),
		switchMap((state) =>
			timer(0, tickMs, scheduler).pipe(
				filter(() => isVisible()),
				map(() => (state.session.expiresAt === null ? null : secondsUntil(state.session.expiresAt, new Date()))),
			),
		),
	);

	// ── The rotation pulse. `didTokenRotate` as the distinctUntilChanged
	//    comparator means ONLY forward expiry jumps emit (first sighting and
	//    backward changes are suppressed); the index filter then skips the
	//    mount sighting, so the pulse is genuinely "a rotation just happened".
	const rotationPulse$ = sessionState$.pipe(
		filter((state): state is SessionState & { readonly status: "ready" } => state.status === "ready"),
		map((state) => state.session.expiresAt),
		distinctUntilChanged((previous, current) => !didTokenRotate(previous, current)),
		filter((_, index) => index > 0),
		switchMap(() =>
			timer(pulseMs, undefined, scheduler).pipe(
				map(() => false),
				startWith(true),
			),
		),
	);

	return { sessionState$, secondsLeft$, rotationPulse$ };
}
