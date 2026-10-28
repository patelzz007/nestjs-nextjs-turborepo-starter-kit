// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import type { MembershipRole, TenantContextResponse } from "@workspace/shared";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TenantSettingsIndexView } from "@/contexts/tenancy/components/tenant/tenant-settings-index-view";
import { tenantRoutes } from "@/lib/routes";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, TWO_STORE_CONTEXT } from "@/test/tenant-context";

// The card reads the tenant context through the API; it has its own test (leave-tenant-card.test.tsx).
vi.mock("@/contexts/tenancy/components/lifecycle/leave-tenant-card", () => ({
	LeaveTenantCard: ({ tenantSlug }: { readonly tenantSlug: string }): React.JSX.Element => <div data-testid="leave-tenant-card">{tenantSlug}</div>,
}));

// The owner's approval card reads the API; it has its own test (support-access-approvals-card.test.tsx).
vi.mock("@/contexts/tenancy/components/support-access/support-access-approvals-card", () => ({
	SupportAccessApprovalsCard: (): null => null,
}));

const routes = tenantRoutes(TEST_ORG_SLUG);

const { contextQuery } = vi.hoisted(() => ({ contextQuery: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { tenants: { context: { useQuery: contextQuery } } } }),
}));

const VERIFIED_CONTEXT: TenantContextResponse = {
	...TWO_STORE_CONTEXT,
	merchantProfile: {
		tenantId: TWO_STORE_CONTEXT.tenant.id,
		legalName: "Acme Coffee Sdn Bhd",
		category: "cafe",
		city: TWO_STORE_CONTEXT.merchantProfile?.city ?? "KUALA_LUMPUR",
		kybStatus: "APPROVED",
		contactEmail: "owner@acme.example",
		contactPhone: null,
	},
};

function hrefOf(name: string): string | null {
	return screen.getByRole("link", { name }).getAttribute("href");
}

function renderAs(role: MembershipRole | undefined): void {
	renderWithAuthorization(<TenantSettingsIndexView tenantSlug={TEST_ORG_SLUG} />, { role });
}

beforeEach((): void => {
	contextQuery.mockReturnValue(contextQueryState(VERIFIED_CONTEXT));
});

afterEach((): void => {
	cleanup();
	contextQuery.mockReset();
});

describe("TenantSettingsIndexView (Business profile)", () => {
	it("shows how the business appears and where it stands", () => {
		renderAs("OWNER");

		expect(screen.getByRole("heading", { level: 2, name: "Business profile" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Acme Coffee" })).toBeTruthy();
		expect(screen.getByText("Active")).toBeTruthy();
		expect(screen.getByText("Verified")).toBeTruthy();
		expect(screen.getByText("Acme Coffee Sdn Bhd")).toBeTruthy();
		expect(screen.getByText("owner@acme.example")).toBeTruthy();
		// Absent details say so rather than leaving a gap.
		expect(screen.getByText("Not given")).toBeTruthy();
	});

	it("links an owner to the logo and the verification details", () => {
		renderAs("OWNER");

		expect(hrefOf("Change logo")).toBe(routes.settings.branding);
		expect(hrefOf("Verification details")).toBe(routes.settings.verification);
	});

	it("keeps business verification from managers (owner-only on the API)", () => {
		renderAs("MANAGER");

		expect(hrefOf("Change logo")).toBe(routes.settings.branding);
		expect(screen.queryByRole("link", { name: "Verification details" })).toBeNull();
	});

	it("places the leave-tenant card for the tenant", () => {
		renderAs("CASHIER");

		expect(screen.getByTestId("leave-tenant-card").textContent).toBe(TEST_ORG_SLUG);
	});

	it("waits for the tenant context before drawing the profile", () => {
		contextQuery.mockReturnValue(contextQueryState(undefined));
		renderAs("OWNER");

		expect(screen.getByLabelText("Loading business profile")).toBeTruthy();
		expect(screen.queryByRole("heading", { name: "Acme Coffee" })).toBeNull();
	});
});
