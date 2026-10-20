// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { Envelope, TenantContextResponse, TenantRewardMembershipResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MerchantServerContext } from "@/lib/merchant-server-api";
import { tenantRoutes, ROUTES } from "@/lib/routes";
import { membershipFixture, TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { TWO_STORE_CONTEXT } from "@/test/tenant-context";

import OrgLayout from "../layout";

const { serverContext, preferredSlug, tenantContext, sidebarOpen, shellProps, redirect } = vi.hoisted(() => ({
	serverContext: vi.fn<() => Promise<Pick<MerchantServerContext, "membershipsEnvelope" | "tenantSlug">>>(),
	preferredSlug: vi.fn<() => Promise<string | undefined>>(),
	tenantContext: vi.fn<(routeKey: string) => Promise<Envelope<TenantContextResponse> | undefined>>(),
	sidebarOpen: vi.fn<() => Promise<boolean | undefined>>(),
	shellProps: vi.fn<(props: { readonly initialSidebarOpen?: boolean | undefined }) => void>(),
	// Like Next's `redirect()`, the mock throws: nothing after the call runs.
	redirect: vi.fn((path: string): void => {
		throw new Error(`NEXT_REDIRECT ${path}`);
	}),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/merchant-server-api", () => ({
	loadMerchantServerContext: serverContext,
	loadPreferredTenantSlug: preferredSlug,
	loadTenantContext: tenantContext,
	readSidebarOpen: sidebarOpen,
}));
vi.mock("@/contexts/identity/lib/server", () => ({ getMerchantServerSession: (): Promise<object> => Promise.resolve({ user: null, isImpersonating: false }) }));
vi.mock("@/contexts/tenancy/lib/org/server-location-scope", () => ({
	loadServerLocationScope: (): Promise<object> => Promise.resolve({ selectedLocationId: null, effectiveLocationId: null, tenantContext: undefined }),
}));
vi.mock("@/components/merchant-shell", () => ({
	MerchantShell: ({ children, initialSidebarOpen }: { readonly children: React.ReactNode; readonly initialSidebarOpen?: boolean | undefined }): React.JSX.Element => {
		shellProps({ initialSidebarOpen });
		return <>{children}</>;
	},
}));
vi.mock("@/contexts/tenancy/components/org/org-tenant-bootstrap", () => ({ OrgTenantBootstrap: (): React.JSX.Element => <p>bootstrap</p> }));

const OWNER = membershipFixture("OWNER");
const OTHER_ORG: TenantRewardMembershipResponse = { ...OWNER, tenantId: "0d5c7a3e-2b8f-4e61-9c4d-7a1b2c3d4e5f", tenantSlug: "other-cafe" };

/** The member's tenants: the memberships page, and each one's context by its slug or its id (others answer as a non-member). */
function memberOf(memberships: readonly TenantRewardMembershipResponse[]): void {
	serverContext.mockResolvedValue({ membershipsEnvelope: testEnvelope([...memberships]), tenantSlug: memberships.at(0)?.tenantSlug });
	tenantContext.mockImplementation((routeKey: string): Promise<Envelope<TenantContextResponse> | undefined> => {
		const membership = memberships.find((row) => row.tenantSlug === routeKey || row.tenantId === routeKey);
		return Promise.resolve(
			membership === undefined
				? undefined
				: testEnvelope({ ...TWO_STORE_CONTEXT, tenant: { ...TWO_STORE_CONTEXT.tenant, id: membership.tenantId, slug: membership.tenantSlug } }),
		);
	});
}

async function renderLayout(tenantSlug: string): Promise<void> {
	render(await OrgLayout({ params: Promise.resolve({ tenantSlug }), children: <p>page</p> }));
}

beforeEach((): void => {
	memberOf([OWNER, OTHER_ORG]);
	preferredSlug.mockResolvedValue(undefined);
	sidebarOpen.mockResolvedValue(undefined);
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("OrgLayout tenant resolution", () => {
	it("renders the tenant the member belongs to", async () => {
		await renderLayout(TEST_ORG_SLUG);

		expect(redirect).not.toHaveBeenCalled();
	});

	it("does not look up the preferred tenant when the URL's tenant resolves", async () => {
		await renderLayout(TEST_ORG_SLUG);
		expect(preferredSlug).not.toHaveBeenCalled();
	});

	it("redirects a tenant-id segment to its canonical slug", async () => {
		await expect(renderLayout(OTHER_ORG.tenantId)).rejects.toThrow(`NEXT_REDIRECT ${tenantRoutes(OTHER_ORG.tenantSlug).dashboard}`);
	});

	it("follows the confirmed preference (the slug cookie the API confirmed) away from a foreign tenant", async () => {
		preferredSlug.mockResolvedValue(OTHER_ORG.tenantSlug);

		await expect(renderLayout("not-my-org")).rejects.toThrow(`NEXT_REDIRECT ${tenantRoutes(OTHER_ORG.tenantSlug).dashboard}`);
	});

	it("stays put (the page guard denies) when there is no confirmed preference — a cookie naming someone else's tenant is none", async () => {
		preferredSlug.mockResolvedValue(undefined);

		await renderLayout("not-my-org");

		expect(redirect).not.toHaveBeenCalled();
	});

	it("sends a user with no tenant at all to onboarding from an id segment", async () => {
		memberOf([]);

		await expect(renderLayout(OWNER.tenantId)).rejects.toThrow(`NEXT_REDIRECT ${ROUTES.onboarding}`);
	});
});

describe("OrgLayout sidebar", () => {
	it("renders the shell with the sidebar as the member left it (its cookie), so a reload does not flash it open", async () => {
		sidebarOpen.mockResolvedValue(false);

		await renderLayout(TEST_ORG_SLUG);

		expect(shellProps).toHaveBeenCalledWith({ initialSidebarOpen: false });
	});
});
