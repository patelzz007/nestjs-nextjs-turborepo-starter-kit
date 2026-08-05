import { Subject } from "@workspace/reactive";
import { assertNoActiveSubscriptions, TestScheduler } from "@workspace/reactive/testing";
import { ApiError } from "@workspace/client/lib/use-api";
import type { SessionStatus } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import {
	buildSessionBadgeStreams,
	didTokenRotate,
	fetchSessionState,
	resolvePollMs,
	sameSessionState,
	secondsUntil,
	toSessionErrorMessage,
	type SessionState,
} from "@/lib/session-badge";

// ── Test fixtures ───────────────────────────────────────────────────────────

const BASE = "2026-08-05T00:00:00.000Z";

function makeSession(expiresAt: string | null, fullName = "Alex Morgan", email = "admin@example.com"): SessionStatus {
	return { userId: "u1", email, fullName, expiresAt, checkedAt: BASE };
}

/** Drain the microtask queue so `fromPromise`-wrapped fetches have resolved. */
async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

// ── Pure helpers ────────────────────────────────────────────────────────────

describe("resolvePollMs", () => {
	it("defaults to null (steady polling disabled) when the env var is unset or empty", () => {
		// Zero-polling is the default: the countdown ticks locally from the
		// mount-fetched exp claim, so a timer is never required.
		expect(resolvePollMs(undefined)).toBeNull();
		expect(resolvePollMs(null)).toBeNull();
		expect(resolvePollMs("")).toBeNull();
		expect(resolvePollMs("   ")).toBeNull();
	});

	it("returns null (polling disabled) for 0, and parses positive integers", () => {
		expect(resolvePollMs("0")).toBeNull();
		expect(resolvePollMs("60000")).toBe(60_000);
		expect(resolvePollMs(" 300000 ")).toBe(300_000);
	});

	it("returns null for garbage input", () => {
		expect(resolvePollMs("abc")).toBeNull();
		expect(resolvePollMs("-5")).toBeNull();
		expect(resolvePollMs("NaN")).toBeNull();
	});
});

describe("secondsUntil", () => {
	it("returns whole seconds remaining, floored at 0", () => {
		const now = new Date("2026-08-05T00:00:00.000Z");
		expect(secondsUntil("2026-08-05T00:01:30.000Z", now)).toBe(90);
		expect(secondsUntil("2026-08-05T00:00:00.400Z", now)).toBe(0);
		expect(secondsUntil("2026-08-04T00:00:00.000Z", now)).toBe(0);
	});
});

describe("didTokenRotate", () => {
	it("only counts a strictly-later expiry as a rotation", () => {
		expect(didTokenRotate(null, null)).toBe(false);
		expect(didTokenRotate(null, BASE)).toBe(false);
		expect(didTokenRotate(BASE, BASE)).toBe(false);
		expect(didTokenRotate(BASE, "2026-08-05T00:10:00.000Z")).toBe(true);
		expect(didTokenRotate("2026-08-05T00:10:00.000Z", BASE)).toBe(false);
	});
});

describe("sameSessionState", () => {
	it("ignores identical poll results and flags any change", () => {
		const ready: SessionState = { status: "ready", session: makeSession(BASE) };
		expect(sameSessionState(ready, { status: "ready", session: makeSession(BASE) })).toBe(true);
		expect(sameSessionState(ready, { status: "ready", session: makeSession("2026-08-05T00:10:00.000Z") })).toBe(false);
		const error: SessionState = { status: "error", errorMessage: "boom" };
		expect(sameSessionState(error, { status: "error", errorMessage: "boom" })).toBe(true);
		expect(sameSessionState(error, { status: "error", errorMessage: "different" })).toBe(false);
		expect(sameSessionState({ status: "loading" }, { status: "loading" })).toBe(true);
		expect(sameSessionState(ready, error)).toBe(false);
	});
});

describe("toSessionErrorMessage", () => {
	it("maps a 401 to the session-expired message and anything else to the network message", () => {
		expect(toSessionErrorMessage(new ApiError({ message: "Unauthorized", statusCode: 401 }))).toBe("Session expired — please log in again");
		expect(toSessionErrorMessage(new ApiError({ message: "Internal Server Error", statusCode: 500 }))).toBe("Session check failed — network or server error");
		expect(toSessionErrorMessage(new Error("TypeError: fetch failed"))).toBe("Session check failed — network or server error");
	});
});

describe("fetchSessionState", () => {
	it("normalizes success and failure into states", async () => {
		const session = makeSession(BASE);
		await expect(fetchSessionState(() => Promise.resolve(session))).resolves.toEqual({ status: "ready", session });
		await expect(fetchSessionState(() => Promise.reject(new Error("down")))).resolves.toEqual({
			status: "error",
			errorMessage: "Session check failed — network or server error",
		});
	});

	it("catches synchronous throws that fromPromise alone cannot see", async () => {
		const state = await fetchSessionState(() => {
			throw new Error("sync boom");
		});
		expect(state).toEqual({ status: "error", errorMessage: "Session check failed — network or server error" });
	});
});

// ── The pipeline (virtual time + injected fetch/visibility) ─────────────────

describe("buildSessionBadgeStreams", () => {
	it("fetches immediately on mount and emits a ready state", async () => {
		const s = new TestScheduler();
		const fetchSession = vi.fn((): Promise<SessionStatus> => Promise.resolve(makeSession(BASE)));
		const streams = buildSessionBadgeStreams({ fetchSession, scheduler: s, pollMs: 1000 });

		const states: SessionState[] = [];
		const sub = streams.sessionState$.subscribe({ next: (v) => states.push(v) });
		await settle();

		expect(fetchSession).toHaveBeenCalledTimes(1);
		expect(states).toEqual([{ status: "ready", session: makeSession(BASE) }]);
		sub.unsubscribe();
	});

	it("with pollMs null, fetches only on mount + tab-return (no steady polling)", async () => {
		const s = new TestScheduler();
		let visible = true;
		const visibility = new Subject<Event>();
		const fetchSession = vi.fn((): Promise<SessionStatus> => Promise.resolve(makeSession(BASE)));
		const streams = buildSessionBadgeStreams({ fetchSession, scheduler: s, pollMs: null, isVisible: () => visible, visibilityChanges: visibility });

		const sub = streams.sessionState$.subscribe();
		await settle(); // mount fetch
		expect(fetchSession).toHaveBeenCalledTimes(1);

		s.advanceBy(10_000); // no timer arm exists — long advance must NOT fetch
		await settle();
		expect(fetchSession).toHaveBeenCalledTimes(1);

		// Hide then return to the tab: tab-return refetch fires even without polling.
		visible = false;
		visibility.next(new Event("visibilitychange"));
		visible = true;
		visibility.next(new Event("visibilitychange"));
		await settle();
		expect(fetchSession).toHaveBeenCalledTimes(2);
		sub.unsubscribe();
	});

	it("countdown ticks locally with ZERO steady polling (the core promise)", async () => {
		// Simulate a truly unset env (NOT `vi.stubEnv(..., undefined)` — that
		// coerces to the string "undefined", which hits the garbage branch and
		// passes coincidentally). Delete + restore keeps the test honest.
		const envValue: string | undefined = process.env.NEXT_PUBLIC_SESSION_POLL_MS;
		delete process.env.NEXT_PUBLIC_SESSION_POLL_MS;

		try {
			const s = new TestScheduler();
			const fetchSession = vi.fn((): Promise<SessionStatus> => Promise.resolve(makeSession("2026-08-05T01:00:00.000Z")));
			// No pollMs → resolvePollMs(env) with unset env → null → the steady timer
			// arm is dropped entirely. Yet the countdown MUST still tick locally from
			// the mount-fetched expiresAt — that is the zero-poll promise.
			const streams = buildSessionBadgeStreams({ fetchSession, scheduler: s, tickMs: 2 });

			const ticks: (number | null)[] = [];
			const sub = streams.secondsLeft$.subscribe({ next: (v) => ticks.push(v) });
			await settle(); // mount fetch supplies the exp claim
			expect(fetchSession).toHaveBeenCalledTimes(1); // ONE mount fetch, nothing else

			s.advanceBy(2);
			s.advanceBy(2);
			await settle();
			// Countdown advanced locally without ANY further fetch.
			expect(ticks.length).toBeGreaterThanOrEqual(3);
			expect(fetchSession).toHaveBeenCalledTimes(1);

			s.advanceBy(60_000); // minutes of idle — still zero steady polls
			await settle();
			expect(fetchSession).toHaveBeenCalledTimes(1);
			sub.unsubscribe();
		} finally {
			if (envValue === undefined) {
				delete process.env.NEXT_PUBLIC_SESSION_POLL_MS;
			} else {
				process.env.NEXT_PUBLIC_SESSION_POLL_MS = envValue;
			}
		}
	});

	it("polls, suppresses identical results, and re-emits changed ones", async () => {
		const s = new TestScheduler();
		let current: SessionStatus = makeSession(BASE);
		const fetchSession = vi.fn((): Promise<SessionStatus> => Promise.resolve(current));
		const streams = buildSessionBadgeStreams({ fetchSession, scheduler: s, pollMs: 10 });

		const states: SessionState[] = [];
		const sub = streams.sessionState$.subscribe({ next: (v) => states.push(v) });
		await settle(); // mount fetch
		expect(states).toHaveLength(1);

		s.advanceBy(10); // quiet poll — identical data
		await settle();
		expect(fetchSession).toHaveBeenCalledTimes(2);
		expect(states).toHaveLength(1); // distinctUntilChanged suppressed it

		current = makeSession("2026-08-05T00:10:00.000Z"); // rotation
		s.advanceBy(10);
		await settle();
		expect(fetchSession).toHaveBeenCalledTimes(3);
		expect(states).toHaveLength(2);
		sub.unsubscribe();
	});

	it("emits an error state on failure and recovers on the next poll", async () => {
		const s = new TestScheduler();
		let shouldFail = true;
		const fetchSession = vi.fn((): Promise<SessionStatus> =>
			shouldFail ? Promise.reject(new ApiError({ message: "Unauthorized", statusCode: 401 })) : Promise.resolve(makeSession(BASE)),
		);
		const streams = buildSessionBadgeStreams({ fetchSession, scheduler: s, pollMs: 10 });

		const states: SessionState[] = [];
		const sub = streams.sessionState$.subscribe({ next: (v) => states.push(v) });
		await settle();
		expect(states).toEqual([{ status: "error", errorMessage: "Session expired — please log in again" }]);

		shouldFail = false;
		s.advanceBy(10);
		await settle();
		expect(states).toEqual([
			{ status: "error", errorMessage: "Session expired — please log in again" },
			{ status: "ready", session: makeSession(BASE) },
		]);
		sub.unsubscribe();
	});

	it("never pulses on the first sighting, and pulses for pulseMs after a rotation", async () => {
		const s = new TestScheduler();
		let expiresAt: string = BASE;
		const fetchSession = vi.fn((): Promise<SessionStatus> => Promise.resolve(makeSession(expiresAt)));
		const streams = buildSessionBadgeStreams({ fetchSession, scheduler: s, pollMs: 10, pulseMs: 5 });

		const pulses: boolean[] = [];
		const sub = streams.rotationPulse$.subscribe({ next: (v) => pulses.push(v) });
		await settle(); // mount sighting — must NOT pulse
		expect(pulses).toEqual([]);

		expiresAt = "2026-08-05T00:10:00.000Z"; // a silent refresh rotated the token
		s.advanceBy(10);
		await settle();
		expect(pulses).toEqual([true]);

		s.advanceBy(5); // pulse window closes
		expect(pulses).toEqual([true, false]);
		sub.unsubscribe();
	});

	it("emits seconds-left every tick while ready, and pauses while the tab is hidden", async () => {
		const s = new TestScheduler();
		let visible = true;
		const visibility = new Subject<Event>();
		const fetchSession = vi.fn((): Promise<SessionStatus> => Promise.resolve(makeSession("2026-08-05T01:00:00.000Z")));
		const streams = buildSessionBadgeStreams({
			fetchSession,
			scheduler: s,
			pollMs: 10,
			tickMs: 2,
			isVisible: () => visible,
			visibilityChanges: visibility,
		});

		const ticks: (number | null)[] = [];
		const sub = streams.secondsLeft$.subscribe({ next: (v) => ticks.push(v) });
		await settle();
		s.advanceBy(2);
		s.advanceBy(2);
		expect(ticks.length).toBeGreaterThanOrEqual(2); // countdown running while visible

		// Hide the tab: ticks stop AND polls stop.
		visible = false;
		visibility.next(new Event("visibilitychange"));
		const callsWhileHidden = fetchSession.mock.calls.length;
		const ticksWhileHidden = ticks.length;
		s.advanceBy(30); // spans three poll windows
		await settle();
		expect(fetchSession.mock.calls.length).toBe(callsWhileHidden); // no hidden fetches
		expect(ticks.length).toBe(ticksWhileHidden); // countdown paused

		// Return to the tab: immediate refetch (no waiting for the next poll).
		visible = true;
		visibility.next(new Event("visibilitychange"));
		await settle();
		expect(fetchSession.mock.calls.length).toBe(callsWhileHidden + 1);
		s.advanceBy(2);
		expect(ticks.length).toBeGreaterThan(ticksWhileHidden); // countdown resumed
		sub.unsubscribe();
	});

	it("emits null seconds-left when the token carries no expiry", async () => {
		const s = new TestScheduler();
		const fetchSession = vi.fn((): Promise<SessionStatus> => Promise.resolve(makeSession(null)));
		const streams = buildSessionBadgeStreams({ fetchSession, scheduler: s, tickMs: 2 });

		const ticks: (number | null)[] = [];
		const sub = streams.secondsLeft$.subscribe({ next: (v) => ticks.push(v) });
		await settle();
		// advanceBy(2) fires the tick scheduled at frame 0 AND the one at frame 2.
		s.advanceBy(2);
		expect(ticks).toEqual([null, null]);
		sub.unsubscribe();
	});

	it("shares ONE fetch pipeline across all three streams (regression: no triple-fetch)", async () => {
		const s = new TestScheduler();
		const fetchSession = vi.fn((): Promise<SessionStatus> => Promise.resolve(makeSession(BASE)));
		const streams = buildSessionBadgeStreams({ fetchSession, scheduler: s, pollMs: 10 });

		// The component subscribes sessionState$ directly AND via secondsLeft$ and
		// rotationPulse$ — shareReplay(1) must collapse them into a single source.
		const subs = [streams.sessionState$.subscribe(), streams.secondsLeft$.subscribe(), streams.rotationPulse$.subscribe()];
		await settle();
		expect(fetchSession).toHaveBeenCalledTimes(1); // ONE mount fetch, not three

		s.advanceBy(10);
		await settle();
		expect(fetchSession).toHaveBeenCalledTimes(2); // ONE poll fetch, not three

		for (const sub of subs) {
			sub.unsubscribe();
		}
	});

	it("leaves zero active subscriptions after tearing down all three streams (leak detector)", async () => {
		const s = new TestScheduler();
		const fetchSession = vi.fn((): Promise<SessionStatus> => Promise.resolve(makeSession(BASE)));
		const streams = buildSessionBadgeStreams({ fetchSession, scheduler: s, pollMs: 10, tickMs: 2, pulseMs: 5 });

		const subs = [streams.sessionState$.subscribe(), streams.secondsLeft$.subscribe(), streams.rotationPulse$.subscribe()];
		await settle();
		s.advanceBy(20);

		for (const sub of subs) {
			sub.unsubscribe();
		}
		// Every timer handle, listener and inner subscription must have
		// unregistered — including the scheduler's own pending actions.
		expect(() => {
			assertNoActiveSubscriptions("session badge streams");
		}).not.toThrow();
	});
});
