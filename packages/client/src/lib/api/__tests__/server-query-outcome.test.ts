// ============================================
// lib/api/server-query-outcome.test.ts - expected vs unexpected SSR failures
// ============================================
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import type * as ServerApi from "./server-api";
import { expectedFailureKind, settleServerQuery, UnexpectedServerQueryError } from "./server-query-outcome";

// `server-only` throws outside React Server Components; stub it for tests.
vi.mock("server-only", () => ({}));

/**
 * The SSR pipeline's error classes are private to `server-request` (its own
 * suite covers how a response becomes a `PrefetchFailure`); here a rejection
 * only needs to carry "the query failed with this failure", and the
 * classifier reports it while every other export stays real.
 */
class ClassifiedQueryError extends Error {
	public readonly failure: ServerApi.PrefetchFailure;

	public constructor(failure: ServerApi.PrefetchFailure) {
		super(`test query failure: ${failure.kind}`);
		this.name = "ClassifiedQueryError";
		this.failure = failure;
	}
}

vi.mock("./server-api", async (importOriginal) => {
	const actual = await importOriginal<typeof ServerApi>();
	return {
		...actual,
		classifyError: (error: Error | undefined): ServerApi.PrefetchFailure => (error instanceof ClassifiedQueryError ? error.failure : actual.classifyError(error)),
	};
});

function httpFailure(status: number): ServerApi.PrefetchFailure {
	return { kind: "http", status };
}

const LABEL = "claims.list";
const PAYLOAD = { items: ["a"] };

function rejected(failure: ServerApi.PrefetchFailure): PromiseSettledResult<typeof PAYLOAD> {
	return { status: "rejected", reason: new ClassifiedQueryError(failure) };
}

let errorSpy: MockInstance<typeof console.error>;

beforeEach((): void => {
	errorSpy = vi.spyOn(console, "error").mockImplementation((): void => {
		// asserted per case
	});
});

afterEach((): void => {
	vi.restoreAllMocks();
});

describe("expectedFailureKind", () => {
	it("maps 401 and a missing access cookie to unauthenticated, 403 to forbidden, 404 to not-found", () => {
		expect(expectedFailureKind(httpFailure(401))).toBe("unauthenticated");
		expect(expectedFailureKind({ kind: "no-cookie" })).toBe("unauthenticated");
		expect(expectedFailureKind(httpFailure(403))).toBe("forbidden");
		expect(expectedFailureKind(httpFailure(404))).toBe("not-found");
	});

	it("treats server errors, outages, timeouts and contract violations as unexpected", () => {
		expect(expectedFailureKind(httpFailure(500))).toBeUndefined();
		expect(expectedFailureKind(httpFailure(429))).toBeUndefined();
		expect(expectedFailureKind({ kind: "unreachable", cause: "ECONNREFUSED" })).toBeUndefined();
		expect(expectedFailureKind({ kind: "timeout" })).toBeUndefined();
		expect(expectedFailureKind({ kind: "schema", message: "data.0.id: Invalid UUID" })).toBeUndefined();
	});
});

describe("settleServerQuery", () => {
	it("returns the data of a fulfilled query", () => {
		expect(settleServerQuery({ status: "fulfilled", value: PAYLOAD }, { label: LABEL, expected: [] })).toEqual({ kind: "ok", data: PAYLOAD });
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("returns each failure the page declared as expected, without logging it", () => {
		const expected: ("unauthenticated" | "forbidden" | "not-found")[] = ["unauthenticated", "forbidden", "not-found"];

		expect(settleServerQuery(rejected(httpFailure(401)), { label: LABEL, expected })).toEqual({ kind: "unauthenticated" });
		expect(settleServerQuery(rejected(httpFailure(403)), { label: LABEL, expected })).toEqual({ kind: "forbidden" });
		expect(settleServerQuery(rejected(httpFailure(404)), { label: LABEL, expected })).toEqual({ kind: "not-found" });
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("logs and rethrows an API failure instead of swallowing it", () => {
		const outage = rejected({ kind: "unreachable", cause: "ECONNREFUSED" });

		expect(() => settleServerQuery(outage, { label: LABEL, expected: ["unauthenticated", "forbidden"] })).toThrow(UnexpectedServerQueryError);
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(errorSpy.mock.lastCall?.[LIST_SLOT_INDEX.first]).toBe("claims.list failed during server render: network (ECONNREFUSED)");
	});

	it("rethrows a 5xx with the original error as its cause", () => {
		const cause = new ClassifiedQueryError(httpFailure(503));
		const result: PromiseSettledResult<typeof PAYLOAD> = { status: "rejected", reason: cause };

		const thrown = ((): Error | undefined => {
			try {
				settleServerQuery(result, { label: LABEL, expected: ["unauthenticated"] });
				return undefined;
			} catch (error: unknown) {
				return error instanceof Error ? error : undefined;
			}
		})();

		expect(thrown).toBeInstanceOf(UnexpectedServerQueryError);
		expect(thrown?.message).toBe("claims.list failed during server render: HTTP 503");
		expect(thrown?.cause).toBe(cause);
	});

	it("rethrows an expected-looking status the page did NOT declare (a 404 from a list endpoint is a bug)", () => {
		expect(() => settleServerQuery(rejected(httpFailure(404)), { label: LABEL, expected: ["unauthenticated", "forbidden"] })).toThrow(UnexpectedServerQueryError);
		expect(() => settleServerQuery(rejected(httpFailure(403)), { label: LABEL, expected: ["not-found"] })).toThrow(UnexpectedServerQueryError);
	});

	it("rethrows a rejection that is not an Error", () => {
		expect(() => settleServerQuery({ status: "rejected", reason: "boom" }, { label: LABEL, expected: ["unauthenticated"] })).toThrow(UnexpectedServerQueryError);
		expect(errorSpy).toHaveBeenCalledTimes(1);
	});

	it("classifies a non-Error rejection as an unexplained failure and records a synthetic Error as its cause", () => {
		const thrown = ((): Error | undefined => {
			try {
				settleServerQuery({ status: "rejected", reason: "boom" }, { label: LABEL, expected: ["unauthenticated", "forbidden", "not-found"] });
				return undefined;
			} catch (error: unknown) {
				return error instanceof Error ? error : undefined;
			}
		})();

		expect(thrown).toBeInstanceOf(UnexpectedServerQueryError);
		expect(thrown?.message).toBe("claims.list failed during server render: network (non-Error rejection)");
		expect(thrown?.cause).toBeInstanceOf(Error);
		expect(thrown?.cause).toHaveProperty("message", "the request rejected with a non-Error value");
		expect(errorSpy.mock.lastCall?.[LIST_SLOT_INDEX.second]).toBe(thrown?.cause);
	});
});
