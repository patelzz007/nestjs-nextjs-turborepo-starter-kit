// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import type { OrganizationMembershipRole } from "@workspace/shared";
import { afterEach, describe, expect, it } from "vitest";

import { OrganizationSettingsIndexView } from "@/components/org/organization-settings-index-view";
import { orgRoutes } from "@/lib/routes";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";

const routes = orgRoutes(TEST_ORG_SLUG);

function hrefOf(name: string): string | null {
	return screen.getByRole("link", { name }).getAttribute("href");
}

function renderAs(role: OrganizationMembershipRole | undefined): void {
	renderWithAuthorization(<OrganizationSettingsIndexView orgSlug={TEST_ORG_SLUG} />, { role });
}

afterEach((): void => {
	cleanup();
});

describe("OrganizationSettingsIndexView", () => {
	it("links owners to team, locations, verification, and their personal account", () => {
		renderAs("OWNER");

		expect(hrefOf("Manage team")).toBe(routes.settings.team);
		expect(hrefOf("View locations")).toBe(routes.settings.locations);
		expect(hrefOf("View verification")).toBe(routes.settings.verification);
		expect(hrefOf("Account")).toBe(routes.account);
	});

	it("hides business verification from admins (owner-only on the API)", () => {
		renderAs("ADMIN");

		expect(hrefOf("Manage team")).toBe(routes.settings.team);
		expect(screen.queryByRole("link", { name: "View verification" })).toBeNull();
	});

	it("shows cashiers only the locations card", () => {
		renderAs("CASHIER");

		expect(screen.queryByRole("link", { name: "Manage team" })).toBeNull();
		expect(screen.queryByRole("link", { name: "View verification" })).toBeNull();
		expect(hrefOf("View locations")).toBe(routes.settings.locations);
	});

	it("shows policy admins and members only the locations card", () => {
		for (const role of ["POLICY_ADMIN", "MEMBER"] satisfies OrganizationMembershipRole[]) {
			renderAs(role);

			expect(screen.queryByRole("link", { name: "Manage team" })).toBeNull();
			expect(screen.queryByRole("link", { name: "View verification" })).toBeNull();
			expect(hrefOf("View locations")).toBe(routes.settings.locations);
			cleanup();
		}
	});

	it("hides every organization card without a membership", () => {
		renderAs(undefined);

		expect(screen.queryByRole("link", { name: "Manage team" })).toBeNull();
		expect(screen.queryByRole("link", { name: "View verification" })).toBeNull();
		expect(screen.queryByRole("link", { name: "View locations" })).toBeNull();
	});
});
