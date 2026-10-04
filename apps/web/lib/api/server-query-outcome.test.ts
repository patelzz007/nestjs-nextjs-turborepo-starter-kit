import type * as ServerApi from "@workspace/client/lib/api/server-api";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { expectedFailureKind, settleServerQuery, UnexpectedServerQueryError } from "@/lib/api/server-query-outcome";
import { ClassifiedQueryError, httpFailure } from "@/test-support/server-query";

vi.mock("@workspace/client/lib/api/server-api", async (importOriginal) => {
	const { withTestFailureClassifier } = await import("@/test-support/server-query");
	return withTestFailureClassifier(await importOriginal<typeof ServerApi>());
});

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
		expect(errorSpy.mock.lastCall?.[0]).toBe("claims.list failed during server render: network (ECONNREFUSED)");
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
});
