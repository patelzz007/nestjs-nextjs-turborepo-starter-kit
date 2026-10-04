// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearOrganizationLocationCookie, organizationLocationCookieName, writeOrganizationLocationCookie } from "@/lib/org/location";
import { useOrganizationPath } from "@/lib/org/use-organization-path";
import { useOrganizationSlug } from "@/lib/org/use-organization-slug";
import { useSwitchOrganization } from "@/lib/org/use-switch-organization";
import { ORG_ROUTES, orgRoutes, ROUTES } from "@/lib/routes";
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
	routeParams.mockReturnValue({ orgSlug: TEST_ORG_SLUG });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
	clearOrganizationLocationCookie(TEST_ORG_SLUG);
});

describe("useOrganizationSlug", () => {
	it("reads the active organization from the /orgs/[orgSlug] URL segment", () => {
		expect(renderHook(useOrganizationSlug).result.current).toBe(TEST_ORG_SLUG);
	});

	it("has no organization outside org routes", () => {
		routeParams.mockReturnValue({});

		expect(renderHook(useOrganizationSlug).result.current).toBeUndefined();
	});

	it("ignores a catch-all style array value", () => {
		routeParams.mockReturnValue({ orgSlug: [TEST_ORG_SLUG] });

		expect(renderHook(useOrganizationSlug).result.current).toBeUndefined();
	});
});

describe("useOrganizationPath", () => {
	it("builds org-relative hrefs inside the organization in the URL", () => {
		expect(renderHook(() => useOrganizationPath(ORG_ROUTES.account)).result.current).toBe(orgRoutes(TEST_ORG_SLUG).account);
	});

	it("falls back to the entry page that resolves the organization server-side outside org routes", () => {
		routeParams.mockReturnValue({});

		expect(renderHook(() => useOrganizationPath(ORG_ROUTES.account)).result.current).toBe(ROUTES.account);
	});
});

describe("useSwitchOrganization", () => {
	it("navigates to the other organization's dashboard and keeps this organization's store choice for the way back", () => {
		writeOrganizationLocationCookie(TEST_ORG_SLUG, STORE_A.id);
		const { result } = renderHook(useSwitchOrganization);

		act(() => {
			result.current(OTHER_ORG_SLUG);
		});

		expect(push).toHaveBeenCalledWith(orgRoutes(OTHER_ORG_SLUG).dashboard);
		expect(document.cookie).toContain(`${organizationLocationCookieName(TEST_ORG_SLUG)}=${STORE_A.id}`);
		expect(document.cookie).not.toContain(`${organizationLocationCookieName(OTHER_ORG_SLUG)}=`);
	});

	it("does nothing when the member re-selects the organization they are in", () => {
		writeOrganizationLocationCookie(TEST_ORG_SLUG, STORE_A.id);
		const { result } = renderHook(useSwitchOrganization);

		act(() => {
			result.current(TEST_ORG_SLUG);
		});

		expect(push).not.toHaveBeenCalled();
		expect(document.cookie).toContain(`${organizationLocationCookieName(TEST_ORG_SLUG)}=${STORE_A.id}`);
	});
});
