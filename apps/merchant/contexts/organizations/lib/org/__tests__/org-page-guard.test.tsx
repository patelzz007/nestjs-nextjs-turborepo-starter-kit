// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { OrganizationMembershipRole } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { guardOrgPage } from "@/contexts/organizations/lib/org/org-page-guard";
import { TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { TWO_STORE_CONTEXT } from "@/test/tenant-context";

const { loadOrganizationContext } = vi.hoisted(() => ({
	loadOrganizationContext: vi.fn(),
}));

vi.mock("@/lib/merchant-server-api", () => ({
	loadOrganizationContext,
}));

/** The organization context answers with the member's own membership in the URL's organization. */
function signedInAs(role: OrganizationMembershipRole): void {
	loadOrganizationContext.mockResolvedValue(testEnvelope({ ...TWO_STORE_CONTEXT, membership: { ...TWO_STORE_CONTEXT.membership, role } }));
}

afterEach((): void => {
	cleanup();
	loadOrganizationContext.mockReset();
});

describe("guardOrgPage (server-side org page guard)", () => {
	it("renders the access-denied state when a cashier opens the team page directly", async () => {
		signedInAs("CASHIER");

		const denied = await guardOrgPage(TEST_ORG_SLUG, "/settings/team");

		expect(denied).not.toBeNull();
		render(<>{denied}</>);
		expect(screen.getByRole("heading", { name: "Team access required" })).toBeTruthy();
	});

	it("renders the owner-only denial when an admin opens business verification directly", async () => {
		signedInAs("ADMIN");

		render(<>{await guardOrgPage(TEST_ORG_SLUG, "/settings/verification")}</>);

		expect(screen.getByRole("heading", { name: "Owner access required" })).toBeTruthy();
	});

	it("falls back to the generic denial copy for pages without custom copy", async () => {
		signedInAs("CASHIER");

		render(<>{await guardOrgPage(TEST_ORG_SLUG, "/api-keys")}</>);

		expect(screen.getByRole("heading", { name: "You don't have access to this page" })).toBeTruthy();
	});

	it("lets the page render (null) when the membership holds the capability", async () => {
		signedInAs("OWNER");

		await expect(guardOrgPage(TEST_ORG_SLUG, "/settings/verification")).resolves.toBeNull();
		await expect(guardOrgPage(TEST_ORG_SLUG, "/settings/team")).resolves.toBeNull();
	});

	it("never loads the session for open routes", async () => {
		await expect(guardOrgPage(TEST_ORG_SLUG, "/account")).resolves.toBeNull();
		expect(loadOrganizationContext).not.toHaveBeenCalled();
	});
});
