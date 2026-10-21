// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import type { MembershipRole } from "@workspace/shared";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TenantSettingsIndexView } from "@/contexts/tenancy/components/tenant/tenant-settings-index-view";
import { tenantRoutes } from "@/lib/routes";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";

// The card reads the tenant context through the API; it has its own test (leave-tenant-card.test.tsx).
vi.mock("@/contexts/tenancy/components/lifecycle/leave-tenant-card", () => ({
	LeaveTenantCard: ({ tenantSlug }: { readonly tenantSlug: string }): React.JSX.Element => <div data-testid="leave-tenant-card">{tenantSlug}</div>,
}));

// The owner's approval card reads the API; it has its own test (support-access-approvals-card.test.tsx).
vi.mock("@/contexts/tenancy/components/support-access/support-access-approvals-card", () => ({
	SupportAccessApprovalsCard: (): null => null,
}));

const routes = tenantRoutes(TEST_ORG_SLUG);

function hrefOf(name: string): string | null {
	return screen.getByRole("link", { name }).getAttribute("href");
}

function renderAs(role: MembershipRole | undefined): void {
	renderWithAuthorization(<TenantSettingsIndexView tenantSlug={TEST_ORG_SLUG} />, { role });
}

afterEach((): void => {
	cleanup();
});

describe("TenantSettingsIndexView", () => {
	it("links owners to team, locations, branding, verification, and their personal account", () => {
		renderAs("OWNER");

		expect(hrefOf("Manage team")).toBe(routes.settings.team);
		expect(hrefOf("View locations")).toBe(routes.settings.locations);
		expect(hrefOf("View branding")).toBe(routes.settings.branding);
		expect(hrefOf("View verification")).toBe(routes.settings.verification);
		expect(hrefOf("Account")).toBe(routes.account);
	});

	it("hides business verification from admins (owner-only on the API)", () => {
		renderAs("ADMIN");

		expect(hrefOf("Manage team")).toBe(routes.settings.team);
		expect(screen.queryByRole("link", { name: "View verification" })).toBeNull();
	});

	it("shows cashiers only the locations and branding cards", () => {
		renderAs("CASHIER");

		expect(screen.queryByRole("link", { name: "Manage team" })).toBeNull();
		expect(screen.queryByRole("link", { name: "View verification" })).toBeNull();
		expect(hrefOf("View locations")).toBe(routes.settings.locations);
		expect(hrefOf("View branding")).toBe(routes.settings.branding);
	});

	it("shows policy admins and members only the locations card", () => {
		for (const role of ["POLICY_ADMIN", "MEMBER"] satisfies MembershipRole[]) {
			renderAs(role);

			expect(screen.queryByRole("link", { name: "Manage team" })).toBeNull();
			expect(screen.queryByRole("link", { name: "View verification" })).toBeNull();
			expect(hrefOf("View locations")).toBe(routes.settings.locations);
			cleanup();
		}
	});

	it("places the leave-tenant card for the tenant", () => {
		renderAs("CASHIER");

		expect(screen.getByTestId("leave-tenant-card").textContent).toBe(TEST_ORG_SLUG);
	});

	it("hides every tenant card without a membership", () => {
		renderAs(undefined);

		expect(screen.queryByRole("link", { name: "Manage team" })).toBeNull();
		expect(screen.queryByRole("link", { name: "View verification" })).toBeNull();
		expect(screen.queryByRole("link", { name: "View locations" })).toBeNull();
		expect(screen.queryByRole("link", { name: "View branding" })).toBeNull();
	});
});
