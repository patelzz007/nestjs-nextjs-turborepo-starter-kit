import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadMerchantServerContext, loadMerchantServerSession, loadTenantContext } from "@/lib/merchant-server-api";
import { UnexpectedServerQueryError } from "@workspace/client/lib/api/server-query-outcome";
import { membershipFixture, TEST_ORG_SLUG } from "@/test/authorization";
import { TWO_STORE_CONTEXT } from "@/test/tenant-context";

// The real SSR caller runs against a stubbed `fetch`, so these tests cover how
// an actual HTTP answer (or outage) becomes the merchant's server context.

const { redirect, cookieJar } = vi.hoisted(() => ({
	// Like Next's `redirect()`, the mock throws: nothing after the call runs.
	redirect: vi.fn((path: string): void => {
		throw new Error(`NEXT_REDIRECT ${path}`);
	}),
	cookieJar: new Map<string, string>(),
}));

vi.mock("@workspace/client/lib/api/config", () => ({ API_BASE_URL: "http://api.test", API_URL_PREFIX: "/api/v1", RUNTIME_NODE_ENV: "test" }));
vi.mock("next/navigation", () => ({ redirect }));
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

function answer(status: number, data: object | null): Response {
	const body =
		status < 400
			? { success: true, data, meta: { correlationId: "c-1", timestamp: NOW } }
			: { success: false, error: { code: "X", message: "x" }, meta: { correlationId: "c-1", timestamp: NOW } };
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A page of the memberships list as the API answers it (`meta` carries the pagination). */
function membershipsPage(items: readonly object[], total = items.length): Response {
	const meta = {
		correlationId: "c-1",
		timestamp: NOW,
		limit: 20,
		total,
		page: 1,
		totalPages: Math.max(1, Math.ceil(total / 20)),
		nextCursor: null,
		hasNext: total > items.length,
		hasPrevious: false,
	};
	return new Response(JSON.stringify({ success: true, data: items, meta }), { status: 200, headers: { "content-type": "application/json" } });
}

/** Answers each request by its path: the memberships list, or a tenant's context by its slug. */
function apiRoutes(memberships: () => Response, contexts: ReadonlyMap<string, () => Response> = new Map()): void {
	vi.stubGlobal(
		"fetch",
		vi.fn((input: RequestInfo | URL): Promise<Response> => {
			const { pathname } = new URL(input instanceof Request ? input.url : input.toString());
			const contextSlug = /\/tenants\/(?<slug>[^/]+)\/context$/u.exec(pathname)?.groups?.slug;
			const route = contextSlug === undefined ? memberships : contexts.get(contextSlug);
			return Promise.resolve(route === undefined ? answer(404, null) : route());
		}),
	);
}

function apiAnswers(response: () => Response): void {
	vi.stubGlobal(
		"fetch",
		vi.fn((): Promise<Response> => Promise.resolve(response())),
	);
}

beforeEach((): void => {
	cookieJar.clear();
	cookieJar.set("merchantAccessToken", "at");
	cookieJar.set("merchantRefreshToken", "rt");
	vi.spyOn(console, "error").mockImplementation((): void => undefined);
	vi.spyOn(console, "warn").mockImplementation((): void => undefined);
});

afterEach((): void => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	redirect.mockClear();
});

describe("loadMerchantServerContext", () => {
	it("returns the first page of confirmed memberships with the API's own envelope, opening the first one", async () => {
		const membership = membershipFixture("OWNER");
		apiRoutes(() => membershipsPage([membership], 3));

		const context = await loadMerchantServerContext();

		expect(context.membershipsEnvelope.data).toEqual([membership]);
		expect(context.membershipsEnvelope.meta).toMatchObject({ correlationId: "c-1", total: 3 });
		expect(context.tenantSlug).toBe(TEST_ORG_SLUG);
	});

	it("reports a confirmed empty list as no tenant (the only case that may lead to onboarding)", async () => {
		apiRoutes(() => membershipsPage([]));

		const context = await loadMerchantServerContext();

		expect(context.membershipsEnvelope.data).toEqual([]);
		expect(context.tenantSlug).toBeUndefined();
	});

	it("never turns an API outage into 'no memberships' — it throws to error.tsx", async () => {
		apiAnswers(() => answer(503, null));

		await expect(loadMerchantServerContext()).rejects.toBeInstanceOf(UnexpectedServerQueryError);
	});

	it("never turns a refused (403) memberships read into 'no memberships' either", async () => {
		apiAnswers(() => answer(403, null));

		await expect(loadMerchantServerContext()).rejects.toBeInstanceOf(UnexpectedServerQueryError);
	});

	it("sends a session the API no longer accepts to sign-in", async () => {
		apiAnswers(() => answer(401, null));

		await expect(loadMerchantServerContext()).rejects.toThrow("NEXT_REDIRECT /auth/login");
	});

	it("opens the tenant the cookie prefers once the API confirms the membership — even one past the first page", async () => {
		cookieJar.set("tenantSlug", "later-store");
		const laterStore = { ...TWO_STORE_CONTEXT, tenant: { ...TWO_STORE_CONTEXT.tenant, slug: "later-store" } };
		apiRoutes(() => membershipsPage([membershipFixture("OWNER")], 30), new Map([["later-store", (): Response => answer(200, laterStore)]]));

		expect((await loadMerchantServerContext()).tenantSlug).toBe("later-store");
	});

	it("ignores a cookie naming a tenant the user does not belong to (the context answers 404)", async () => {
		cookieJar.set("tenantSlug", "someone-elses-tenant");
		apiRoutes(() => membershipsPage([membershipFixture("OWNER")]));

		expect((await loadMerchantServerContext()).tenantSlug).toBe(TEST_ORG_SLUG);
	});
});

describe("loadMerchantServerSession", () => {
	it("is signed out without asking the API when the request carries no session cookie", async () => {
		cookieJar.clear();
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);

		await expect(loadMerchantServerSession()).resolves.toEqual({ kind: "signed-out" });
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("is signed out when the API rejects the session (401) — the browser may still refresh it", async () => {
		apiAnswers(() => answer(401, null));

		await expect(loadMerchantServerSession()).resolves.toEqual({ kind: "signed-out" });
	});

	it("reports an outage as unavailable instead of failing the page — the browser's session check settles it", async () => {
		apiAnswers(() => answer(503, null));

		const outcome = await loadMerchantServerSession();

		expect(outcome.kind).toBe("unavailable");
	});
});

describe("loadTenantContext", () => {
	it("is undefined when the API refuses it (not a member) — the page guard denies", async () => {
		apiAnswers(() => answer(403, null));

		await expect(loadTenantContext(TEST_ORG_SLUG)).resolves.toBeUndefined();
	});

	it("names no tenant for a segment that is neither a slug nor an id — without asking the API", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);

		await expect(loadTenantContext("Not A Slug!")).resolves.toBeUndefined();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("rethrows an outage instead of degrading silently", async () => {
		apiAnswers(() => answer(500, null));

		await expect(loadTenantContext(TEST_ORG_SLUG)).rejects.toBeInstanceOf(UnexpectedServerQueryError);
	});
});
