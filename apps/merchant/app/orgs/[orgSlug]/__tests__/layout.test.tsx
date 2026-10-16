// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MerchantServerContext } from "@/lib/merchant-server-api";
import { orgRoutes, ROUTES } from "@/lib/routes";
import { membershipFixture, TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";

import OrgLayout from "../layout";

const { serverContext, storedSlug, sidebarOpen, shellProps, redirect } = vi.hoisted(() => ({
	serverContext: vi.fn<() => Promise<Pick<MerchantServerContext, "memberships" | "membershipsEnvelope" | "organizationSlug">>>(),
	storedSlug: vi.fn<() => Promise<string | undefined>>(),
	sidebarOpen: vi.fn<() => Promise<boolean | undefined>>(),
	shellProps: vi.fn<(props: { readonly initialSidebarOpen?: boolean | undefined }) => void>(),
	// Like Next's `redirect()`, the mock throws: nothing after the call runs.
	redirect: vi.fn((path: string): void => {
		throw new Error(`NEXT_REDIRECT ${path}`);
	}),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/merchant-server-api", () => ({ loadMerchantServerContext: serverContext, readOrganizationSlugCookie: storedSlug, readSidebarOpen: sidebarOpen }));
vi.mock("@/lib/auth/server", () => ({ getMerchantServerSession: (): Promise<object> => Promise.resolve({ user: null, isImpersonating: false }) }));
vi.mock("@/lib/org/server-location-scope", () => ({
	loadServerLocationScope: (): Promise<object> => Promise.resolve({ selectedLocationId: null, effectiveLocationId: null, organizationContext: undefined }),
}));
vi.mock("@/components/merchant-shell", () => ({
	MerchantShell: ({ children, initialSidebarOpen }: { readonly children: React.ReactNode; readonly initialSidebarOpen?: boolean | undefined }): React.JSX.Element => {
		shellProps({ initialSidebarOpen });
		return <>{children}</>;
	},
}));
vi.mock("@/components/org/org-tenant-bootstrap", () => ({ OrgTenantBootstrap: (): React.JSX.Element => <p>bootstrap</p> }));

const OWNER = membershipFixture("OWNER");
const OTHER_ORG: OrganizationRewardMembershipResponse = { ...OWNER, organizationId: "0d5c7a3e-2b8f-4e61-9c4d-7a1b2c3d4e5f", organizationSlug: "other-cafe" };

function memberOf(memberships: readonly OrganizationRewardMembershipResponse[]): void {
	serverContext.mockResolvedValue({ memberships, membershipsEnvelope: testEnvelope([...memberships]), organizationSlug: memberships.at(0)?.organizationSlug });
}

async function renderLayout(orgSlug: string): Promise<void> {
	render(await OrgLayout({ params: Promise.resolve({ orgSlug }), children: <p>page</p> }));
}

beforeEach((): void => {
	memberOf([OWNER, OTHER_ORG]);
	storedSlug.mockResolvedValue(undefined);
	sidebarOpen.mockResolvedValue(undefined);
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("OrgLayout tenant resolution", () => {
	it("renders the organization the member belongs to", async () => {
		await renderLayout(TEST_ORG_SLUG);

		expect(redirect).not.toHaveBeenCalled();
	});

	it("redirects an organization-id segment to its canonical slug", async () => {
		await expect(renderLayout(OTHER_ORG.organizationId)).rejects.toThrow(`NEXT_REDIRECT ${orgRoutes(OTHER_ORG.organizationSlug).dashboard}`);
	});

	it("follows the slug cookie for a foreign organization only when it names one of the member's organizations", async () => {
		storedSlug.mockResolvedValue(OTHER_ORG.organizationSlug);

		await expect(renderLayout("not-my-org")).rejects.toThrow(`NEXT_REDIRECT ${orgRoutes(OTHER_ORG.organizationSlug).dashboard}`);
	});

	it("never redirects to an organization the cookie names but the member does not belong to", async () => {
		storedSlug.mockResolvedValue("someone-elses-org");

		await renderLayout("not-my-org");

		expect(redirect).not.toHaveBeenCalled();
	});

	it("sends a user with no organization at all to onboarding from an id segment", async () => {
		memberOf([]);

		await expect(renderLayout(OWNER.organizationId)).rejects.toThrow(`NEXT_REDIRECT ${ROUTES.onboarding}`);
	});
});

describe("OrgLayout sidebar", () => {
	it("renders the shell with the sidebar as the member left it (its cookie), so a reload does not flash it open", async () => {
		sidebarOpen.mockResolvedValue(false);

		await renderLayout(TEST_ORG_SLUG);

		expect(shellProps).toHaveBeenCalledWith({ initialSidebarOpen: false });
	});
});
