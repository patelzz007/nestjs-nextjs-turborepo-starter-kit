// ============================================
// lib/auth/session/session-check.ts - what a session check concluded
// ============================================
// The auth facade asks the API "is this tab still signed in?" with
// `GET /auth/me` + `GET /auth/permissions`, OUTSIDE the 401 → refresh →
// redirect pipeline (docs/token-refresh.md, "Client session state"). This
// module turns those answers into a verdict:
//
//   valid                → the session is live (restore it)
//   no-session           → the API says there is none (sign the tab out, no redirect)
//   expired-access-token → a 401 a refresh can fix (refresh ONCE, then read again)
//   unavailable          → no verdict: network, timeout, 5xx, 429, a broken answer
//
// Only `no-session` may end a session. An unreachable API never does — the
// tab keeps what it knew and the facade retries with backoff (policy below).

import type { SessionPermissionsResponse, UserResponse } from "@workspace/shared";
import { z } from "zod";

import { isDeadSessionError, NO_HTTP_RESPONSE_STATUS, REQUEST_ABORTED_ERROR, type ApiFailure, type ApiResponse, type RefreshResult } from "../../api/api-request";
import { ApiResponseContractError, type ApiResponseContractIssue } from "../../api/response-contract";

// ── Policy ──────────────────────────────────────────────────────────────────

/**
 * Each read of the session (both requests) and the refresh it may need get
 * this long. Without it a hung API kept the tab `unknown` forever. Longer than
 * the proxy's 3 s refresh budget: the page is already on screen, so waiting
 * costs a placeholder, not a blank page.
 */
export const SESSION_CHECK_TIMEOUT_MS = 10_000;

/** Automatic retries after a check found the API unreachable, before the tab waits for a trigger (back online, tab visible, "Try again"). */
export const SESSION_CHECK_MAX_RETRIES = 6;

/** Backoff of the first retry; each later one doubles it, up to the cap. */
export const SESSION_CHECK_RETRY_BASE_DELAY_MS = 1_000;

/** Upper bound for one backoff step. With 6 retries the series spans roughly 30–60 s — a typical deploy restart. */
export const SESSION_CHECK_RETRY_MAX_DELAY_MS = 30_000;

/** Each retry waits this many times longer than the previous one. */
const SESSION_CHECK_RETRY_BACKOFF_FACTOR = 2;

/**
 * "Equal jitter": a retry waits at least this share of its backoff step, plus
 * a random part of the rest. The floor keeps retries from hammering; the
 * random part spreads tabs and members that failed at the same moment.
 */
const SESSION_CHECK_RETRY_FIXED_SHARE = 0.5;

/**
 * A re-check started by an event every tab sees at the same moment (the
 * browser came back online) waits a random 0..this long, so the tabs of one
 * browser do not hit the API together.
 */
export const SESSION_RECHECK_JITTER_MS = 1_000;

/**
 * How long to wait before retry number `failedAttempts` (1-based: the delay
 * after the first failure is `sessionCheckRetryDelayMs(1, …)`). Exponential,
 * capped, with equal jitter; `random` returns [0, 1) (`Math.random` in the
 * browser, a fixed value in tests).
 */
export function sessionCheckRetryDelayMs(failedAttempts: number, random: () => number): number {
	const step = Math.max(failedAttempts, 1) - 1;
	const backoff = Math.min(SESSION_CHECK_RETRY_BASE_DELAY_MS * SESSION_CHECK_RETRY_BACKOFF_FACTOR ** step, SESSION_CHECK_RETRY_MAX_DELAY_MS);
	const fixed = backoff * SESSION_CHECK_RETRY_FIXED_SHARE;
	return Math.round(fixed + random() * (backoff - fixed));
}

/** A random delay in [0, `SESSION_RECHECK_JITTER_MS`) for a re-check every tab starts at once. */
export function sessionRecheckJitterMs(random: () => number): number {
	return Math.round(random() * SESSION_RECHECK_JITTER_MS);
}

// ── Verdicts ────────────────────────────────────────────────────────────────

/**
 * Why a check reached no verdict — a category for the DevTools timeline and
 * the logs; never a body, a message or a token.
 */
export const SessionCheckFailureReasonSchema = z.enum([
	/** No HTTP answer at all: offline, DNS, connection reset, CORS. */
	"network",
	/** No answer within `SESSION_CHECK_TIMEOUT_MS`. */
	"timeout",
	/** The browser cancelled the request. */
	"aborted",
	/** 5xx: the API (or its database) is down, restarting or overloaded. */
	"server-error",
	/** 429: the API or a gateway is shedding load. */
	"rate-limited",
	/** Any other non-2xx, e.g. 403 or 404 — the API answered outside the endpoint's contract. */
	"unexpected-status",
	/** A 2xx whose body the shared response contract rejects. */
	"contract-violation",
	/** The access token needed a refresh, and the refresh could not be done right now (network, 5xx, cooldown). */
	"refresh-unavailable",
]);

export type SessionCheckFailureReason = z.output<typeof SessionCheckFailureReasonSchema>;

/** What the session answers say, read once. */
export type SessionResponseClass =
	| { readonly kind: "valid"; readonly profile: UserResponse; readonly permissions: SessionPermissionsResponse | null }
	| { readonly kind: "no-session" }
	| { readonly kind: "expired-access-token" }
	| { readonly kind: "unavailable"; readonly reason: SessionCheckFailureReason };

/** What the whole check concluded. After its one refresh, "the access token expired" is no longer an answer. */
export type SessionCheckResult = Exclude<SessionResponseClass, { readonly kind: "expired-access-token" }>;

/** The two answers one session read gets, as the transport returned them. */
export interface SessionCheckResponses {
	readonly me: ApiResponse<{ readonly data: UserResponse }>;
	readonly permissions: ApiResponse<{ readonly data: SessionPermissionsResponse }>;
}

const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;
/** The first server-error status (5xx). */
const HTTP_SERVER_ERROR = 500;

const NO_SESSION: SessionCheckResult = { kind: "no-session" };
const EXPIRED_ACCESS_TOKEN: SessionResponseClass = { kind: "expired-access-token" };

function unavailable(reason: SessionCheckFailureReason): SessionCheckResult {
	return { kind: "unavailable", reason };
}

/**
 * Classifies one failed session request.
 *
 * - 401 is about the session: the API only answers it when authentication
 *   failed. A revoked session (`isDeadSessionError`) is gone for good; any
 *   other 401 (expired, missing or invalid access token) may be fixed by a
 *   refresh.
 * - 403 is NOT "no session": the API answers 403 only after authentication
 *   succeeded (`AuthGuard` runs first), restricted sessions are allowlisted for
 *   both endpoints, and neither has an authorization requirement. A 403 here
 *   comes from something between the browser and the API, or a contract
 *   break. Signing out would be wrong and a refresh cannot fix it.
 * - Everything else gives no verdict.
 */
export function classifySessionFailure(failure: ApiFailure): SessionResponseClass {
	if (failure.error instanceof ApiResponseContractError) {
		return unavailable("contract-violation");
	}
	if (failure.status === HTTP_UNAUTHORIZED) {
		return isDeadSessionError(failure.error) ? NO_SESSION : EXPIRED_ACCESS_TOKEN;
	}
	if (failure.status === HTTP_TOO_MANY_REQUESTS) {
		return unavailable("rate-limited");
	}
	if (failure.status >= HTTP_SERVER_ERROR) {
		return unavailable("server-error");
	}
	if (failure.status === NO_HTTP_RESPONSE_STATUS) {
		return unavailable(failure.error === REQUEST_ABORTED_ERROR ? "aborted" : "network");
	}
	return unavailable("unexpected-status");
}

/**
 * Classifies one session read. `/auth/me` decides whether there is a session;
 * `/auth/permissions` only refines its scope, so when it did not answer the
 * session is still restored (scope from the profile) and the live permissions
 * query fills the scope in later.
 */
export function classifySessionResponses({ me, permissions }: SessionCheckResponses): SessionResponseClass {
	if (!me.ok) {
		return classifySessionFailure(me);
	}
	return { kind: "valid", profile: me.data.data, permissions: permissions.ok ? permissions.data.data : null };
}

// ── Reporting ───────────────────────────────────────────────────────────────

/** The session endpoint an answer came from. */
export type SessionCheckEndpoint = "me" | "permissions";

/**
 * An answer that broke the API contract — an API/client drift or a bug, never
 * an outage, so it is worth reporting. Carries the bounded issue list of the
 * contract error, never the body (it may hold personal data).
 */
export type SessionCheckProblem =
	| { readonly kind: "contract-violation"; readonly endpoint: SessionCheckEndpoint; readonly status: number; readonly issues: readonly ApiResponseContractIssue[] }
	| { readonly kind: "unexpected-status"; readonly endpoint: SessionCheckEndpoint; readonly status: number };

function problemOf(endpoint: SessionCheckEndpoint, response: ApiResponse<{ readonly data: UserResponse | SessionPermissionsResponse }>): SessionCheckProblem | null {
	if (response.ok) {
		return null;
	}
	if (response.error instanceof ApiResponseContractError) {
		return { kind: "contract-violation", endpoint, status: response.status, issues: response.error.issues };
	}
	const failure = classifySessionFailure(response);
	return failure.kind === "unavailable" && failure.reason === "unexpected-status" ? { kind: "unexpected-status", endpoint, status: response.status } : null;
}

/** The contract problems in one session read (none for an outage or a 401). */
export function findSessionCheckProblems({ me, permissions }: SessionCheckResponses): readonly SessionCheckProblem[] {
	return [problemOf("me", me), problemOf("permissions", permissions)].filter((problem: SessionCheckProblem | null): problem is SessionCheckProblem => problem !== null);
}

// ── The check ───────────────────────────────────────────────────────────────

export interface SessionCheckDependencies {
	/** Reads `/auth/me` and `/auth/permissions` once, outside the 401 pipeline, aborting on `signal`. */
	readonly readSession: (signal: AbortSignal) => Promise<SessionCheckResponses>;
	/**
	 * The tab's single-flight silent refresh (shared with the 401 pipeline, so
	 * the refresh token rotates once). Resolves `"expired"` without a call when
	 * this check may not refresh (the tab invalidated its session, or the check
	 * is stale).
	 */
	readonly refresh: () => Promise<RefreshResult>;
	/** Called for each answer that broke the contract. */
	readonly report: (problem: SessionCheckProblem) => void;
	readonly timeoutMs: number;
}

type Timed<T> = { readonly kind: "settled"; readonly value: T } | { readonly kind: "timed-out" };

/** `work`, or `timed-out` when it takes longer than `timeoutMs` (then `onTimeout` runs, e.g. to abort it). */
async function settleWithin<T>(work: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<Timed<T>> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timedOut = new Promise<Timed<T>>((resolve): void => {
		timer = setTimeout((): void => {
			onTimeout();
			resolve({ kind: "timed-out" });
		}, timeoutMs);
	});
	try {
		return await Promise.race([work.then((value: T): Timed<T> => ({ kind: "settled", value })), timedOut]);
	} finally {
		clearTimeout(timer);
	}
}

/** One read of the session, bounded by the timeout and aborted with `signal` (a newer check, an unmount). */
async function readSessionOnce(dependencies: SessionCheckDependencies, signal: AbortSignal): Promise<SessionResponseClass> {
	const controller = new AbortController();
	const abortRead = (): void => {
		controller.abort();
	};
	signal.addEventListener("abort", abortRead);
	try {
		const read = await settleWithin(dependencies.readSession(controller.signal), dependencies.timeoutMs, abortRead);
		if (read.kind === "timed-out") {
			return unavailable("timeout");
		}
		for (const problem of findSessionCheckProblems(read.value)) {
			dependencies.report(problem);
		}
		return classifySessionResponses(read.value);
	} finally {
		signal.removeEventListener("abort", abortRead);
	}
}

/**
 * Runs one session check to a verdict.
 *
 * An access token that only needs a refresh gets ONE refresh through the
 * tab's single-flight refresh, then one more read without refreshing. The
 * check can run long after the page loaded — after an outage, when the tab
 * becomes visible, when another tab signs in — when the access token has
 * expired but the refresh token is fine; concluding "signed out" then would
 * drop a live session. The second read also runs after a failed (`expired`)
 * refresh: another tab may have rotated the shared refresh token first
 * (`REFRESH_TOKEN_SUPERSEDED` is a 401), leaving this tab a valid new pair.
 * Whatever that read says is final; a 401 now means no session.
 */
export async function checkSession(dependencies: SessionCheckDependencies, signal: AbortSignal): Promise<SessionCheckResult> {
	const first = await readSessionOnce(dependencies, signal);
	if (first.kind !== "expired-access-token") {
		return first;
	}

	const refreshed = await settleWithin(dependencies.refresh(), dependencies.timeoutMs, (): void => undefined);
	if (refreshed.kind === "timed-out") {
		return unavailable("timeout");
	}
	if (refreshed.value === "transient") {
		return unavailable("refresh-unavailable");
	}

	const second = await readSessionOnce(dependencies, signal);
	return second.kind === "expired-access-token" ? NO_SESSION : second;
}
