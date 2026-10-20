// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearLocationCookie, locationCookieName, writeLocationCookie } from "@/contexts/tenancy/lib/org/location";
import { useTenantPath } from "@/contexts/tenancy/lib/org/use-tenant-path";
import { useTenantSlug } from "@/contexts/tenancy/lib/org/use-tenant-slug";
import { useSwitchTenant } from "@/contexts/tenancy/lib/org/use-switch-tenant";
import { TENANT_ROUTES, tenantRoutes, ROUTES } from "@/lib/routes";
import { TEST_ORG_SLUG } from "@/test/authorization";
import { STORE_A } from "@/test/terminals";

type RouteParams = Record<string, string | string[] | undefined>;

const { routeParams, push } = vi.hoisted(() => ({
	routeParams: vi.fn<() => RouteParams>(),
	push: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({
	useParams: routeParams,
	useRouter: (): object => ({ push }),
}));

const OTHER_ORG_SLUG = "bean-there";

beforeEach((): void => {
	routeParams.mockReturnValue({ tenantSlug: TEST_ORG_SLUG });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
	clearLocationCookie(TEST_ORG_SLUG);
});

describe("useTenantSlug", () => {
	it("reads the active tenant from the /t/[tenantSlug] URL segment", () => {
		expect(renderHook(useTenantSlug).result.current).toBe(TEST_ORG_SLUG);
	});

	it("has no tenant outside org routes", () => {
		routeParams.mockReturnValue({});

		expect(renderHook(useTenantSlug).result.current).toBeUndefined();
	});

	it("ignores a catch-all style array value", () => {
		routeParams.mockReturnValue({ tenantSlug: [TEST_ORG_SLUG] });

		expect(renderHook(useTenantSlug).result.current).toBeUndefined();
	});
});

describe("useTenantPath", () => {
	it("builds org-relative hrefs inside the tenant in the URL", () => {
		expect(renderHook(() => useTenantPath(TENANT_ROUTES.account)).result.current).toBe(tenantRoutes(TEST_ORG_SLUG).account);
	});

	it("falls back to the entry page that resolves the tenant server-side outside org routes", () => {
		routeParams.mockReturnValue({});

		expect(renderHook(() => useTenantPath(TENANT_ROUTES.account)).result.current).toBe(ROUTES.account);
	});
});

describe("useSwitchTenant", () => {
	it("navigates to the other tenant's dashboard and keeps this tenant's store choice for the way back", () => {
		writeLocationCookie(TEST_ORG_SLUG, STORE_A.id);
		const { result } = renderHook(useSwitchTenant);

		act(() => {
			result.current(OTHER_ORG_SLUG);
		});

		expect(push).toHaveBeenCalledWith(tenantRoutes(OTHER_ORG_SLUG).dashboard);
		expect(document.cookie).toContain(`${locationCookieName(TEST_ORG_SLUG)}=${STORE_A.id}`);
		expect(document.cookie).not.toContain(`${locationCookieName(OTHER_ORG_SLUG)}=`);
	});

	it("does nothing when the member re-selects the tenant they are in", () => {
		writeLocationCookie(TEST_ORG_SLUG, STORE_A.id);
		const { result } = renderHook(useSwitchTenant);

		act(() => {
			result.current(TEST_ORG_SLUG);
		});

		expect(push).not.toHaveBeenCalled();
		expect(document.cookie).toContain(`${locationCookieName(TEST_ORG_SLUG)}=${STORE_A.id}`);
	});
});
