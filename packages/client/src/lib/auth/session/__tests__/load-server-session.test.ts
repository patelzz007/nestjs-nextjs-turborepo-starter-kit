import { describe, expect, it, vi } from "vitest";

import { envelopeFixture, sessionPermissionsFixture, userFixture } from "../../../../test/auth-fixtures";
import type * as ServerApi from "../../../api/server-api";
import { loadServerSessionOutcome, serverRenderedSessionOf, type ServerSessionReader } from "../load-server-session";

// `server-only` throws outside React Server Components; stub it for tests.
vi.mock("server-only", () => ({}));

/** A rejection carrying the failure the classifier reports (the SSR error classes are private to `server-request`). */
class ClassifiedQueryError extends Error {
	public readonly failure: ServerApi.PrefetchFailure;

	public constructor(failure: ServerApi.PrefetchFailure) {
		super(`test query failure: ${failure.kind}`);
		this.name = "ClassifiedQueryError";
		this.failure = failure;
	}
}

vi.mock("../../../api/server-api", async (importOriginal) => {
	const actual = await importOriginal<typeof ServerApi>();
	return {
		...actual,
		classifyError: (error: Error | undefined): ServerApi.PrefetchFailure => (error instanceof ClassifiedQueryError ? error.failure : actual.classifyError(error)),
	};
});

const PROFILE = envelopeFixture(userFixture({ isSuperAdmin: true }));
const PERMISSIONS = envelopeFixture(sessionPermissionsFixture({ capabilities: ["rewards:claim"] }));
const UNAUTHORIZED: ServerApi.PrefetchFailure = { kind: "http", status: 401 };
const UNREACHABLE: ServerApi.PrefetchFailure = { kind: "unreachable", cause: "ECONNREFUSED" };

interface Answers {
	readonly me?: ServerApi.PrefetchFailure;
	readonly permissions?: ServerApi.PrefetchFailure;
}

/** A server caller whose session queries answer, or fail with the given failure. */
function serverAnswering({ me, permissions }: Answers = {}): ServerSessionReader {
	return {
		auth: {
			me: { query: (): Promise<typeof PROFILE> => (me === undefined ? Promise.resolve(PROFILE) : Promise.reject(new ClassifiedQueryError(me))) },
			permissions: {
				query: (): Promise<typeof PERMISSIONS> => (permissions === undefined ? Promise.resolve(PERMISSIONS) : Promise.reject(new ClassifiedQueryError(permissions))),
			},
		},
	};
}

describe("loadServerSessionOutcome", () => {
	it("is signed in with the API's own profile and permissions envelopes", async () => {
		const log = vi.fn<(message: string) => void>();

		const outcome = await loadServerSessionOutcome(serverAnswering(), log);

		expect(outcome).toEqual({ kind: "signed-in", session: { profile: PROFILE, permissions: PERMISSIONS } });
		expect(serverRenderedSessionOf(outcome)).toEqual({ profile: PROFILE, permissions: PERMISSIONS });
		expect(log).not.toHaveBeenCalled();
	});

	it("is signed out, silently, without a session cookie or with a token the API rejects (401)", async () => {
		const log = vi.fn<(message: string) => void>();

		await expect(loadServerSessionOutcome(serverAnswering({ me: { kind: "no-cookie" }, permissions: { kind: "no-cookie" } }), log)).resolves.toEqual({
			kind: "signed-out",
		});
		await expect(loadServerSessionOutcome(serverAnswering({ me: UNAUTHORIZED, permissions: UNAUTHORIZED }), log)).resolves.toEqual({ kind: "signed-out" });
		expect(log).not.toHaveBeenCalled();
	});

	it("is signed out when either answer says so — a profile without its permissions is not a session", async () => {
		const outcome = await loadServerSessionOutcome(serverAnswering({ permissions: UNAUTHORIZED }), vi.fn());

		expect(outcome).toEqual({ kind: "signed-out" });
		expect(serverRenderedSessionOf(outcome)).toBeUndefined();
	});

	it("is unavailable when the API cannot answer: logged, with the error the app may rethrow", async () => {
		const log = vi.fn<(message: string) => void>();

		const outcome = await loadServerSessionOutcome(serverAnswering({ permissions: UNREACHABLE }), log);

		expect(outcome.kind).toBe("unavailable");
		expect(outcome.kind === "unavailable" ? outcome.error.message : "").toBe("auth.permissions failed during server render: network (ECONNREFUSED)");
		expect(log).toHaveBeenCalledWith("[auth] auth.permissions failed during server render: network (ECONNREFUSED)");
		expect(serverRenderedSessionOf(outcome)).toBeUndefined();
	});
});
