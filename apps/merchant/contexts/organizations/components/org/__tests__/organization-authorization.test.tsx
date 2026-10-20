// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { OrganizationMembershipRole } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrgDashboardPageView } from "@/contexts/organizations/components/org/org-dashboard-page-view";
import { OrganizationLocationsPageView } from "@/contexts/organizations/components/org/organization-locations-page-view";
import { OrganizationTeamPageView, TEAM_INVITES_LOADING_LABELS, TEAM_MEMBERS_LOADING_LABELS } from "@/contexts/organizations/components/org/organization-team-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { LOCATION_SKELETON_CARDS, MERCHANT_LOCATIONS_LOADING_LABELS, MERCHANT_TEAM_LOADING_LABELS } from "@/components/loading/merchant-page-skeletons";
import { busyRegionAnnouncements } from "@/test/skeleton";

const { contextQuery, listMembersQuery, listInvitesQuery, organizationMutation } = vi.hoisted(() => ({
	contextQuery: vi.fn(),
	listMembersQuery: vi.fn(),
	listInvitesQuery: vi.fn(),
	organizationMutation: vi.fn(),
}));

// The Team page's lists keep their pages in the URL: `useSearchParams` reads the address bar, as Next.js does.
vi.mock("next/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/navigation")>()),
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			organizations: {
				context: { useQuery: contextQuery },
				listMembers: { useQuery: listMembersQuery },
				listMemberInvites: { useQuery: listInvitesQuery },
				inviteMember: { useMutation: organizationMutation },
				revokeMemberInvite: { useMutation: organizationMutation },
				createLocation: { useMutation: organizationMutation },
				resubmitLocation: { useMutation: organizationMutation },
			},
		},
	}),
}));

function renderAs(ui: React.ReactElement, role: OrganizationMembershipRole | undefined, isLoading = false): void {
	renderWithAuthorization(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>, { role, isLoading });
}

beforeEach((): void => {
	window.history.replaceState(null, "", "/");
	contextQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
	listMembersQuery.mockReturnValue({ data: { data: [] }, isLoading: false });
	listInvitesQuery.mockReturnValue({ data: { data: [] }, isLoading: false });
	organizationMutation.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
});

afterEach((): void => {
	cleanup();
	contextQuery.mockReset();
	listMembersQuery.mockReset();
	listInvitesQuery.mockReset();
	organizationMutation.mockReset();
});

describe("OrganizationTeamPageView authorization (merchant:manage_team)", () => {
	it("shows the roster and invite form to admins", () => {
		renderAs(<OrganizationTeamPageView orgSlug={TEST_ORG_SLUG} />, "ADMIN");

		expect(screen.getByRole("button", { name: "Send invitation" })).toBeTruthy();
		expect(screen.getByText("Pending invitations")).toBeTruthy();
	});

	it.each(["CASHIER", "POLICY_ADMIN", "MEMBER"] satisfies OrganizationMembershipRole[])("denies the page and skips the roster queries for %s", (role) => {
		renderAs(<OrganizationTeamPageView orgSlug={TEST_ORG_SLUG} />, role);

		expect(screen.getByText("Team access required")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Send invitation" })).toBeNull();
		expect(listMembersQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderAs(<OrganizationTeamPageView orgSlug={TEST_ORG_SLUG} />, undefined, true);

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_TEAM_LOADING_LABELS.loading]);
		expect(screen.queryByText("Team access required")).toBeNull();
	});
});

describe("OrganizationTeamPageView loading", () => {
	it("draws member rows (not 'No members found') while the roster loads, and invitation rows while they load", () => {
		listMembersQuery.mockReturnValue({ data: undefined, isLoading: true });
		listInvitesQuery.mockReturnValue({ data: undefined, isLoading: true });
		renderAs(<OrganizationTeamPageView orgSlug={TEST_ORG_SLUG} />, "ADMIN");

		expect(busyRegionAnnouncements()).toEqual([TEAM_MEMBERS_LOADING_LABELS.loading, TEAM_INVITES_LOADING_LABELS.loading]);
		expect(screen.queryByText("No members found.")).toBeNull();
		expect(screen.queryByText("No pending invitations.")).toBeNull();
		// The invite form never waits on the roster.
		expect(screen.getByRole("button", { name: "Send invitation" })).toBeTruthy();
	});

	it("shows the empty roster and invitations once both have loaded, with nothing busy", () => {
		renderAs(<OrganizationTeamPageView orgSlug={TEST_ORG_SLUG} />, "ADMIN");

		expect(busyRegionAnnouncements()).toEqual([]);
		expect(screen.getByText("No members found.")).toBeTruthy();
		expect(screen.getByText("No pending invitations.")).toBeTruthy();
	});
});

describe("OrganizationLocationsPageView loading", () => {
	it("draws the summary and location cards in one busy region while the organization context loads", () => {
		contextQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
		renderAs(<OrganizationLocationsPageView orgSlug={TEST_ORG_SLUG} />, "OWNER");

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_LOCATIONS_LOADING_LABELS.loading]);
		expect(document.querySelectorAll('[data-slot="location-card-skeleton"]')).toHaveLength(LOCATION_SKELETON_CARDS);
		// The request button waits for the context it would add to.
		expect(screen.getByRole("button", { name: "Add store" }).hasAttribute("disabled")).toBe(true);
	});
});

describe("OrganizationLocationsPageView authorization (merchant:manage_locations)", () => {
	it.each(["OWNER", "ADMIN"] satisfies OrganizationMembershipRole[])("offers store requests to %s", (role) => {
		renderAs(<OrganizationLocationsPageView orgSlug={TEST_ORG_SLUG} />, role);

		expect(screen.getByRole("button", { name: "Add store" })).toBeTruthy();
		expect(screen.queryByRole("note")).toBeNull();
	});

	it.each(["CASHIER", "POLICY_ADMIN", "MEMBER"] satisfies OrganizationMembershipRole[])("hides store requests and explains why for %s", (role) => {
		renderAs(<OrganizationLocationsPageView orgSlug={TEST_ORG_SLUG} />, role);

		expect(screen.queryByRole("button", { name: "Add store" })).toBeNull();
		expect(screen.getByRole("note").textContent).toContain("can view store locations but not request new stores");
	});

	it("shows neither the action nor the notice while the membership resolves", () => {
		renderAs(<OrganizationLocationsPageView orgSlug={TEST_ORG_SLUG} />, undefined, true);

		expect(screen.queryByRole("button", { name: "Add store" })).toBeNull();
		expect(screen.queryByRole("note")).toBeNull();
	});
});

describe("OrgDashboardPageView authorization", () => {
	it("shows every shortcut to owners", () => {
		renderAs(<OrgDashboardPageView orgSlug={TEST_ORG_SLUG} context={null} />, "OWNER");

		for (const name of ["Team & access", "Business verification", "Rewards", "Analytics", "Redemptions log"]) {
			expect(screen.getByText(name)).toBeTruthy();
		}
	});

	it("shows cashiers only the operations they can open", () => {
		renderAs(<OrgDashboardPageView orgSlug={TEST_ORG_SLUG} context={null} />, "CASHIER");

		expect(screen.getByText("Rewards")).toBeTruthy();
		expect(screen.getByText("Analytics")).toBeTruthy();
		expect(screen.getByText("Redemptions log")).toBeTruthy();
		expect(screen.getByText("Store locations")).toBeTruthy();
		expect(screen.queryByText("Team & access")).toBeNull();
		expect(screen.queryByText("Business verification")).toBeNull();
	});

	it("shows admins the team shortcut but not business verification", () => {
		renderAs(<OrgDashboardPageView orgSlug={TEST_ORG_SLUG} context={null} />, "ADMIN");

		expect(screen.getByText("Team & access")).toBeTruthy();
		expect(screen.queryByText("Business verification")).toBeNull();
	});

	it("hides operations shortcuts from members without merchant capabilities", () => {
		renderAs(<OrgDashboardPageView orgSlug={TEST_ORG_SLUG} context={null} />, "MEMBER");

		expect(screen.queryByText("Rewards")).toBeNull();
		expect(screen.queryByText("Analytics")).toBeNull();
		expect(screen.queryByText("Redemptions log")).toBeNull();
	});

	it("denies the dashboard without a membership", () => {
		renderAs(<OrgDashboardPageView orgSlug={TEST_ORG_SLUG} context={null} />, undefined);

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
	});
});

describe("OrganizationTeamPageView pages", () => {
	const META = { correlationId: "corr-1", timestamp: 1_792_368_000_000 };

	it("counts every member from meta, pages the roster through the URL, and leaves the invitations' page alone", () => {
		const member = {
			id: "m-1",
			organizationId: "o-1",
			userId: "u-1",
			role: "CASHIER",
			status: "ACTIVE",
			displayName: null,
			locationScopeType: "ALL_LOCATIONS",
			locationIds: [],
			createdAt: 1,
			updatedAt: 1,
			fullName: "Lee",
			email: "lee@example.com",
		};
		listMembersQuery.mockReturnValue({
			data: { data: [member], meta: { ...META, limit: 20, total: 41, page: 1, totalPages: 3, nextCursor: "cursor-2", hasNext: true, hasPrevious: false } },
			isLoading: false,
			isPlaceholderData: false,
		});
		renderAs(<OrganizationTeamPageView orgSlug={TEST_ORG_SLUG} />, "ADMIN");

		expect(screen.getByText("41")).toBeDefined();
		expect(listMembersQuery).toHaveBeenLastCalledWith({ orgSlug: TEST_ORG_SLUG, page: 1, limit: 20 }, expect.anything());
		const pager = screen.getByRole("navigation", { name: "Member pages" });
		expect(within(pager).getByText("Page 1 of 3")).toBeDefined();
		fireEvent.click(within(pager).getByRole("button", { name: "Next" }));

		const url = new URLSearchParams(window.location.search);
		expect([url.get("membersPage"), url.get("membersCursor"), url.get("invitesPage")]).toEqual(["2", "cursor-2", null]);
		expect(screen.queryByRole("navigation", { name: "Invitation pages" })).toBeNull();
	});
});
