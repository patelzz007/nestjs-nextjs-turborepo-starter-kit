// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationStoresPageView } from "@/contexts/organizations/components/org/organization-stores-page-view";
import { orgRoutes } from "@/lib/routes";
import { membershipFixture, renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";

const { membershipsQuery } = vi.hoisted(() => ({ membershipsQuery: vi.fn() }));

// The page's search and page live in the URL: `useSearchParams` reads the address bar, as Next.js does.
vi.mock("next/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/navigation")>()),
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { organizations: { membershipsBootstrap: { useQuery: membershipsQuery } } } }),
}));

const OTHER_STORE: OrganizationRewardMembershipResponse = {
	...membershipFixture("CASHIER"),
	organizationSlug: "brew-bros",
	displayName: "Brew Bros",
	organizationId: "1d3b6c4e-2f0a-4b8e-9c71-5a2d8e6f4b10",
};
const META = { correlationId: "corr-1", timestamp: 1_792_368_000_000 };

function storesPage(stores: readonly OrganizationRewardMembershipResponse[], totalPages: number): object {
	return {
		isPending: false,
		isSuccess: true,
		isPlaceholderData: false,
		data: {
			data: stores,
			meta: { ...META, limit: 20, total: totalPages * 20, page: 1, totalPages, nextCursor: totalPages > 1 ? "cursor-2" : null, hasNext: totalPages > 1, hasPrevious: false },
		},
	};
}

beforeEach((): void => {
	window.history.replaceState(null, "", `/orgs/${TEST_ORG_SLUG}/stores`);
	membershipsQuery.mockReturnValue(storesPage([membershipFixture("OWNER"), OTHER_STORE], 1));
});

afterEach((): void => {
	cleanup();
	membershipsQuery.mockReset();
});

describe("OrganizationStoresPageView", () => {
	it("lists the member's stores, marks the current one and links each to its dashboard", () => {
		renderWithAuthorization(<OrganizationStoresPageView orgSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(membershipsQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20 }, expect.anything());
		const other = screen.getByRole("link", { name: /Brew Bros/u });
		expect(other.getAttribute("href")).toBe(orgRoutes("brew-bros").dashboard);
		expect(within(screen.getByRole("link", { name: /Acme Coffee|Current/u })).getByText("Current")).toBeDefined();
		expect(screen.queryByRole("navigation", { name: "Store pages" })).toBeNull();
	});

	it("pages through the URL when the member has more stores than one page", () => {
		membershipsQuery.mockReturnValue(storesPage([OTHER_STORE], 2));
		renderWithAuthorization(<OrganizationStoresPageView orgSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		fireEvent.click(within(screen.getByRole("navigation", { name: "Store pages" })).getByRole("button", { name: "Next" }));

		expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
	});

	it("says when no store matches the search in the URL", () => {
		window.history.replaceState(null, "", `/orgs/${TEST_ORG_SLUG}/stores?search=zzz`);
		membershipsQuery.mockReturnValue(storesPage([], 1));
		renderWithAuthorization(<OrganizationStoresPageView orgSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(membershipsQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: "zzz" }, expect.anything());
		expect(screen.getByText("No store matches your search.")).toBeDefined();
	});
});
