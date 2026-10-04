import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadMerchantServerContext, loadOrganizationContext } from "@/lib/merchant-server-api";
import { UnexpectedServerQueryError } from "@/lib/server/server-query-outcome";
import { membershipFixture, TEST_ORG_SLUG } from "@/test/authorization";

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
	it("returns the confirmed memberships with the API's own envelope", async () => {
		const membership = membershipFixture("OWNER");
		apiAnswers(() => answer(200, [membership]));

		const context = await loadMerchantServerContext();

		expect(context.memberships).toEqual([membership]);
		expect(context.membershipsEnvelope.meta.correlationId).toBe("c-1");
		expect(context.organizationSlug).toBe(TEST_ORG_SLUG);
	});

	it("reports a confirmed empty list as no organization (the only case that may lead to onboarding)", async () => {
		apiAnswers(() => answer(200, []));

		const context = await loadMerchantServerContext();

		expect(context.memberships).toEqual([]);
		expect(context.organizationSlug).toBeUndefined();
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

	it("follows the organization cookie only when it names one of the user's memberships", async () => {
		cookieJar.set("organizationSlug", "someone-elses-org");
		apiAnswers(() => answer(200, [membershipFixture("OWNER")]));

		expect((await loadMerchantServerContext()).organizationSlug).toBe(TEST_ORG_SLUG);
	});
});

describe("loadOrganizationContext", () => {
	it("is undefined when the API refuses it (not a member) — the page guard denies", async () => {
		apiAnswers(() => answer(403, null));

		await expect(loadOrganizationContext(TEST_ORG_SLUG)).resolves.toBeUndefined();
	});

	it("rethrows an outage instead of degrading silently", async () => {
		apiAnswers(() => answer(500, null));

		await expect(loadOrganizationContext(TEST_ORG_SLUG)).rejects.toBeInstanceOf(UnexpectedServerQueryError);
	});
});
