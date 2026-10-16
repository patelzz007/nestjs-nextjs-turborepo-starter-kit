import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadAdminServerSession } from "@/lib/auth-server";

// The real SSR caller runs against a stubbed `fetch`, so these tests cover how
// an actual HTTP answer (or outage) becomes the admin's server session.

const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));

vi.mock("server-only", () => ({}));
vi.mock("@workspace/client/lib/api/config", () => ({ API_BASE_URL: "http://api.test", API_URL_PREFIX: "/api/v1", RUNTIME_NODE_ENV: "test" }));
vi.mock("next/headers", () => ({
	cookies: (): Promise<object> =>
		Promise.resolve({
			get: (name: string): { readonly value: string } | undefined => {
				const value = cookieJar.get(name);
				return value === undefined ? undefined : { value };
			},
		}),
	headers: (): Promise<Headers> => Promise.resolve(new Headers()),
}));

const NOW = 1_790_812_800_000;

function failure(status: number): Response {
	const body = { success: false, error: { code: "X", message: "x" }, meta: { correlationId: "c-1", timestamp: NOW } };
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach((): void => {
	cookieJar.clear();
	cookieJar.set("adminAccessToken", "at");
	cookieJar.set("adminRefreshToken", "rt");
	vi.spyOn(console, "error").mockImplementation((): void => undefined);
	vi.spyOn(console, "warn").mockImplementation((): void => undefined);
});

afterEach((): void => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("loadAdminServerSession", () => {
	it("is signed out without asking the API when the request carries no session cookie", async () => {
		cookieJar.clear();
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);

		await expect(loadAdminServerSession()).resolves.toEqual({ kind: "signed-out" });
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("is signed out when the API rejects the session (401) — the panel layout sends it to sign-in", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((): Promise<Response> => Promise.resolve(failure(401))),
		);

		await expect(loadAdminServerSession()).resolves.toEqual({ kind: "signed-out" });
	});

	it("reports an outage as unavailable instead of failing the page — the browser's session check retries", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((): Promise<Response> => Promise.resolve(failure(503))),
		);

		const outcome = await loadAdminServerSession();

		expect(outcome.kind).toBe("unavailable");
	});
});
