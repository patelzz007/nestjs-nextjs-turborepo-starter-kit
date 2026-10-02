import type { SessionPermissionsResponse, UserResponse } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionPermissionsFixture, userFixture } from "../../../test/auth-fixtures";
import { ApiError, NO_HTTP_RESPONSE_STATUS, REQUEST_ABORTED_ERROR, type ApiFailure, type ApiResponse, type RefreshResult } from "../../api/api-request";
import { ApiResponseContractError } from "../../api/response-contract";
import {
	checkSession,
	classifySessionFailure,
	classifySessionResponses,
	findSessionCheckProblems,
	SESSION_CHECK_RETRY_BASE_DELAY_MS,
	SESSION_CHECK_RETRY_MAX_DELAY_MS,
	SESSION_CHECK_TIMEOUT_MS,
	SESSION_RECHECK_JITTER_MS,
	sessionCheckRetryDelayMs,
	sessionRecheckJitterMs,
	type SessionCheckDependencies,
	type SessionCheckProblem,
	type SessionCheckResponses,
	type SessionResponseClass,
} from "./session-check";

const ME_URL = "http://api.test/api/v1/auth/me";

function failure(status: number, error: ApiFailure["error"] = new Error("failed")): ApiFailure {
	return { ok: false, status, data: null, error };
}

function apiError(status: number, code: string): ApiError {
	return new ApiError({ message: code, error: code, statusCode: status });
}

function contractError(status: number): ApiResponseContractError {
	return new ApiResponseContractError({ method: "GET", url: ME_URL, status }, [{ path: "data.id", message: "Invalid input" }]);
}

function meAnswer(profile: UserResponse): ApiResponse<{ readonly data: UserResponse }> {
	return { ok: true, status: 200, data: { data: profile } };
}

function permissionsAnswer(permissions: SessionPermissionsResponse): ApiResponse<{ readonly data: SessionPermissionsResponse }> {
	return { ok: true, status: 200, data: { data: permissions } };
}

function responses(me: SessionCheckResponses["me"], permissions: SessionCheckResponses["permissions"] = failure(401)): SessionCheckResponses {
	return { me, permissions };
}

describe("classifySessionFailure", () => {
	const cases: readonly (readonly [label: string, failure: ApiFailure, expected: SessionResponseClass])[] = [
		["a 401 for an expired access token", failure(401, apiError(401, "ACCESS_TOKEN_EXPIRED")), { kind: "expired-access-token" }],
		["a 401 without a cookie", failure(401, apiError(401, "ACCESS_TOKEN_MISSING")), { kind: "expired-access-token" }],
		["a 401 with an unreadable body", failure(401, "Unauthorized"), { kind: "expired-access-token" }],
		["a 401 for a revoked token version", failure(401, apiError(401, "TOKEN_VERSION_MISMATCH")), { kind: "no-session" }],
		["a 401 for a revoked refresh token", failure(401, apiError(401, "REFRESH_TOKEN_REVOKED")), { kind: "no-session" }],
		["a 401 after token theft", failure(401, apiError(401, "TOKEN_THEFT_DETECTED")), { kind: "no-session" }],
		["a 403 (authenticated, then refused)", failure(403, apiError(403, "FORBIDDEN")), { kind: "unavailable", reason: "unexpected-status" }],
		["a 404", failure(404), { kind: "unavailable", reason: "unexpected-status" }],
		["a 400", failure(400), { kind: "unavailable", reason: "unexpected-status" }],
		["a 429", failure(429), { kind: "unavailable", reason: "rate-limited" }],
		["a 500", failure(500), { kind: "unavailable", reason: "server-error" }],
		["a 502 from the gateway", failure(502), { kind: "unavailable", reason: "server-error" }],
		["a 503 during a deploy", failure(503), { kind: "unavailable", reason: "server-error" }],
		["a 504", failure(504), { kind: "unavailable", reason: "server-error" }],
		["a network error", failure(NO_HTTP_RESPONSE_STATUS, new TypeError("fetch failed")), { kind: "unavailable", reason: "network" }],
		["an aborted request", failure(NO_HTTP_RESPONSE_STATUS, REQUEST_ABORTED_ERROR), { kind: "unavailable", reason: "aborted" }],
		["a 2xx body the contract rejects", failure(200, contractError(200)), { kind: "unavailable", reason: "contract-violation" }],
	];

	it.each(cases)("classifies %s", (_label: string, input: ApiFailure, expected: SessionResponseClass) => {
		expect(classifySessionFailure(input)).toEqual(expected);
	});
});

describe("classifySessionResponses", () => {
	it("restores a session from /auth/me with the /auth/permissions answer", () => {
		const profile = userFixture();
		const permissions = sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" });

		expect(classifySessionResponses(responses(meAnswer(profile), permissionsAnswer(permissions)))).toEqual({ kind: "valid", profile, permissions });
	});

	it("still restores the session when only /auth/permissions failed — /auth/me decides", () => {
		const profile = userFixture();

		expect(classifySessionResponses(responses(meAnswer(profile), failure(503)))).toEqual({ kind: "valid", profile, permissions: null });
	});

	it("never reads a malformed /auth/me as signed in", () => {
		expect(classifySessionResponses(responses(failure(200, contractError(200)), permissionsAnswer(sessionPermissionsFixture())))).toEqual({
			kind: "unavailable",
			reason: "contract-violation",
		});
	});

	it("follows /auth/me when it failed, whatever /auth/permissions said", () => {
		expect(classifySessionResponses(responses(failure(503), permissionsAnswer(sessionPermissionsFixture())))).toEqual({ kind: "unavailable", reason: "server-error" });
	});
});

describe("findSessionCheckProblems", () => {
	it("reports contract violations and unexpected statuses of either endpoint, with the issue list and never the body", () => {
		const problems = findSessionCheckProblems(responses(failure(200, contractError(200)), failure(403)));

		expect(problems).toEqual([
			{ kind: "contract-violation", endpoint: "me", status: 200, issues: [{ path: "data.id", message: "Invalid input" }] },
			{ kind: "unexpected-status", endpoint: "permissions", status: 403 },
		]);
	});

	it("reports nothing for an outage, a 401 or a success — they are expected", () => {
		expect(findSessionCheckProblems(responses(failure(503), failure(NO_HTTP_RESPONSE_STATUS)))).toEqual([]);
		expect(findSessionCheckProblems(responses(failure(401), failure(429)))).toEqual([]);
		expect(findSessionCheckProblems(responses(meAnswer(userFixture()), permissionsAnswer(sessionPermissionsFixture())))).toEqual([]);
	});
});

describe("retry policy", () => {
	const lowest = (): number => 0;
	const highest = (): number => 0.999_999;

	it("doubles the backoff per failure, waiting at least half of each step", () => {
		expect([1, 2, 3, 4, 5].map((attempt: number): number => sessionCheckRetryDelayMs(attempt, lowest))).toEqual([500, 1_000, 2_000, 4_000, 8_000]);
		expect([1, 2, 3].map((attempt: number): number => sessionCheckRetryDelayMs(attempt, highest))).toEqual([1_000, 2_000, 4_000]);
	});

	it("caps one step at the maximum delay", () => {
		expect(sessionCheckRetryDelayMs(12, highest)).toBe(SESSION_CHECK_RETRY_MAX_DELAY_MS);
		expect(sessionCheckRetryDelayMs(12, lowest)).toBe(SESSION_CHECK_RETRY_MAX_DELAY_MS / 2);
	});

	it("treats a count below one as the first retry", () => {
		expect(sessionCheckRetryDelayMs(0, highest)).toBe(SESSION_CHECK_RETRY_BASE_DELAY_MS);
	});

	it("spreads trigger re-checks across the jitter window", () => {
		expect(sessionRecheckJitterMs(lowest)).toBe(0);
		expect(sessionRecheckJitterMs((): number => 0.5)).toBe(SESSION_RECHECK_JITTER_MS / 2);
	});
});

describe("checkSession", () => {
	const profile = userFixture();

	interface Harness {
		readonly dependencies: SessionCheckDependencies;
		readonly reads: SessionCheckResponses[];
		readonly refreshes: { count: number };
		readonly problems: SessionCheckProblem[];
	}

	function harness(answers: readonly (SessionCheckResponses | Promise<SessionCheckResponses>)[], refreshResult: RefreshResult | Promise<RefreshResult> = "ok"): Harness {
		const queue = [...answers];
		const reads: SessionCheckResponses[] = [];
		const refreshes = { count: 0 };
		const problems: SessionCheckProblem[] = [];
		return {
			reads,
			refreshes,
			problems,
			dependencies: {
				readSession: async (): Promise<SessionCheckResponses> => {
					const next = queue.shift();
					if (next === undefined) {
						throw new Error("unexpected read");
					}
					const answer = await next;
					reads.push(answer);
					return answer;
				},
				refresh: (): Promise<RefreshResult> => {
					refreshes.count += 1;
					return Promise.resolve(refreshResult);
				},
				report: (problem: SessionCheckProblem): void => {
					problems.push(problem);
				},
				timeoutMs: SESSION_CHECK_TIMEOUT_MS,
			},
		};
	}

	/** An answer that never arrives (a hung API). */
	function pending<T>(): Promise<T> {
		return new Promise<T>((): void => undefined);
	}

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("restores a live session with one read and no refresh", async () => {
		const { dependencies, refreshes } = harness([responses(meAnswer(profile))]);

		await expect(checkSession(dependencies, new AbortController().signal)).resolves.toEqual({ kind: "valid", profile, permissions: null });
		expect(refreshes.count).toBe(0);
	});

	it("ends a revoked session without refreshing", async () => {
		const { dependencies, refreshes, reads } = harness([responses(failure(401, apiError(401, "TOKEN_VERSION_MISMATCH")))]);

		await expect(checkSession(dependencies, new AbortController().signal)).resolves.toEqual({ kind: "no-session" });
		expect(refreshes.count).toBe(0);
		expect(reads).toHaveLength(1);
	});

	it("refreshes an expired access token once, then reads the session again", async () => {
		const { dependencies, refreshes, reads } = harness([responses(failure(401)), responses(meAnswer(profile))]);

		await expect(checkSession(dependencies, new AbortController().signal)).resolves.toEqual({ kind: "valid", profile, permissions: null });
		expect(refreshes.count).toBe(1);
		expect(reads).toHaveLength(2);
	});

	it("concludes no session when the second read is still 401 — and never refreshes twice", async () => {
		const { dependencies, refreshes } = harness([responses(failure(401)), responses(failure(401))]);

		await expect(checkSession(dependencies, new AbortController().signal)).resolves.toEqual({ kind: "no-session" });
		expect(refreshes.count).toBe(1);
	});

	it("reads once more after a refresh that says expired — another tab may have rotated the token first", async () => {
		const { dependencies, reads } = harness([responses(failure(401)), responses(meAnswer(profile))], "expired");

		await expect(checkSession(dependencies, new AbortController().signal)).resolves.toEqual({ kind: "valid", profile, permissions: null });
		expect(reads).toHaveLength(2);
	});

	it("reaches no verdict when the refresh could not run right now", async () => {
		const { dependencies, reads } = harness([responses(failure(401))], "transient");

		await expect(checkSession(dependencies, new AbortController().signal)).resolves.toEqual({ kind: "unavailable", reason: "refresh-unavailable" });
		expect(reads).toHaveLength(1);
	});

	it("times out a read that never answers, and aborts it", async () => {
		let readSignal: AbortSignal | undefined;
		const { dependencies } = harness([]);
		const hanging: SessionCheckDependencies = {
			...dependencies,
			readSession: (signal: AbortSignal): Promise<SessionCheckResponses> => {
				readSignal = signal;
				return pending<SessionCheckResponses>();
			},
		};

		const verdict = checkSession(hanging, new AbortController().signal);
		await vi.advanceTimersByTimeAsync(SESSION_CHECK_TIMEOUT_MS);

		await expect(verdict).resolves.toEqual({ kind: "unavailable", reason: "timeout" });
		expect(readSignal?.aborted).toBe(true);
	});

	it("times out a refresh that never answers", async () => {
		const { dependencies } = harness([responses(failure(401))], pending<RefreshResult>());

		const verdict = checkSession(dependencies, new AbortController().signal);
		await vi.advanceTimersByTimeAsync(SESSION_CHECK_TIMEOUT_MS);

		await expect(verdict).resolves.toEqual({ kind: "unavailable", reason: "timeout" });
	});

	it("aborts the read in flight when the caller's signal fires (a newer check, an unmount)", () => {
		let readSignal: AbortSignal | undefined;
		const { dependencies } = harness([]);
		const caller = new AbortController();

		const hanging: SessionCheckDependencies = {
			...dependencies,
			readSession: (signal: AbortSignal): Promise<SessionCheckResponses> => {
				readSignal = signal;
				return pending<SessionCheckResponses>();
			},
		};
		void checkSession(hanging, caller.signal);
		caller.abort();

		expect(readSignal?.aborted).toBe(true);
	});

	it("reports a contract violation and gives no verdict", async () => {
		const { dependencies, problems } = harness([responses(failure(200, contractError(200)))]);

		await expect(checkSession(dependencies, new AbortController().signal)).resolves.toEqual({ kind: "unavailable", reason: "contract-violation" });
		expect(problems).toEqual([{ kind: "contract-violation", endpoint: "me", status: 200, issues: [{ path: "data.id", message: "Invalid input" }] }]);
	});
});
