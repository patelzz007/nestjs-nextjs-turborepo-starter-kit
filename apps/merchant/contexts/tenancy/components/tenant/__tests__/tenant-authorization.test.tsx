// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { flushUrlUpdates } from "@workspace/client/testing/flush-url-updates";
import type { MembershipRole } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TenantDashboardPageView } from "@/contexts/tenancy/components/tenant/tenant-dashboard-page-view";
import { LocationsPageView } from "@/contexts/tenancy/components/tenant/tenant-locations-page-view";
import { TenantTeamPageView, TEAM_INVITES_LOADING_LABELS, TEAM_MEMBERS_LOADING_LABELS } from "@/contexts/tenancy/components/tenant/tenant-team-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { LOCATION_SKELETON_CARDS, MERCHANT_LOCATIONS_LOADING_LABELS, MERCHANT_TEAM_LOADING_LABELS } from "@/components/loading/merchant-page-skeletons";
import { busyRegionAnnouncements } from "@/test/skeleton";

const { contextQuery, listMembersQuery, listInvitesQuery, tenantMutation, rolesQuery } = vi.hoisted(() => ({
	rolesQuery: vi.fn(),
	contextQuery: vi.fn(),
	listMembersQuery: vi.fn(),
	listInvitesQuery: vi.fn(),
	tenantMutation: vi.fn(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: {
				context: { useQuery: contextQuery },
				listMembers: { useQuery: listMembersQuery },
				listMemberInvites: { useQuery: listInvitesQuery },
				inviteMember: { useMutation: tenantMutation },
				revokeMemberInvite: { useMutation: tenantMutation },
				createLocation: { useMutation: tenantMutation },
				resubmitLocation: { useMutation: tenantMutation },
			},
			tenantAccess: { roles: { useQuery: rolesQuery }, changeMemberRole: { useMutation: tenantMutation } },
		},
	}),
}));

function renderAs(ui: React.ReactElement, role: MembershipRole | undefined, isLoading = false): void {
	renderWithAuthorization(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>, { role, isLoading });
}

beforeEach((): void => {
	window.history.replaceState(null, "", "/");
	contextQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
	listMembersQuery.mockReturnValue({ data: { data: [] }, isLoading: false });
	listInvitesQuery.mockReturnValue({ data: { data: [] }, isLoading: false });
	rolesQuery.mockReturnValue({ data: { data: [] }, isLoading: false });
	tenantMutation.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
});

afterEach((): void => {
	cleanup();
	contextQuery.mockReset();
	listMembersQuery.mockReset();
	listInvitesQuery.mockReset();
	tenantMutation.mockReset();
});

describe("TenantTeamPageView authorization (merchant:manage_team)", () => {
	it("shows the roster, its tabs and the invite action to managers", () => {
		renderAs(<TenantTeamPageView tenantSlug={TEST_ORG_SLUG} />, "MANAGER");

		expect(screen.getByRole("button", { name: "Invite teammate" })).toBeTruthy();
		expect(screen.getByRole("tab", { name: /Members/ })).toBeTruthy();
		expect(screen.getByRole("tab", { name: /Pending invites/ })).toBeTruthy();
		expect(screen.getByRole("tab", { name: /Roles/ })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "What each role can do" })).toBeTruthy();
	});

	it("opens the invitation form in a dialog", () => {
		renderAs(<TenantTeamPageView tenantSlug={TEST_ORG_SLUG} />, "MANAGER");

		fireEvent.click(screen.getByRole("button", { name: "Invite teammate" }));

		expect(screen.getByRole("dialog", { name: "Invite a teammate" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Send invitation" })).toBeTruthy();
	});

	it.each(["CASHIER"] satisfies MembershipRole[])("denies the page and skips the roster queries for %s", (role) => {
		renderAs(<TenantTeamPageView tenantSlug={TEST_ORG_SLUG} />, role);

		expect(screen.getByText("Team access required")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Invite teammate" })).toBeNull();
		expect(listMembersQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderAs(<TenantTeamPageView tenantSlug={TEST_ORG_SLUG} />, undefined, true);

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_TEAM_LOADING_LABELS.loading]);
		expect(screen.queryByText("Team access required")).toBeNull();
	});
});

describe("TenantTeamPageView loading", () => {
	it("draws member rows (not 'No members found') while the roster loads, and the invite action never waits", () => {
		listMembersQuery.mockReturnValue({ data: undefined, isLoading: true });
		renderAs(<TenantTeamPageView tenantSlug={TEST_ORG_SLUG} />, "MANAGER");

		expect(busyRegionAnnouncements()).toEqual([TEAM_MEMBERS_LOADING_LABELS.loading]);
		expect(screen.queryByText("No members found.")).toBeNull();
		expect(screen.getByRole("button", { name: "Invite teammate" })).toBeTruthy();
	});

	it("draws invitation rows on the Pending invites tab while they load", () => {
		window.history.replaceState(null, "", "/?tab=invites");
		listInvitesQuery.mockReturnValue({ data: undefined, isLoading: true });
		renderAs(<TenantTeamPageView tenantSlug={TEST_ORG_SLUG} />, "MANAGER");

		expect(busyRegionAnnouncements()).toEqual([TEAM_INVITES_LOADING_LABELS.loading]);
		expect(screen.queryByText("No pending invitations.")).toBeNull();
	});

	it("shows the empty roster, and the empty invitations on their tab, with nothing busy", () => {
		renderAs(<TenantTeamPageView tenantSlug={TEST_ORG_SLUG} />, "MANAGER");
		expect(busyRegionAnnouncements()).toEqual([]);
		expect(screen.getByText("No members found.")).toBeTruthy();
		cleanup();

		window.history.replaceState(null, "", "/?tab=invites");
		renderAs(<TenantTeamPageView tenantSlug={TEST_ORG_SLUG} />, "MANAGER");
		expect(screen.getByText("No pending invitations.")).toBeTruthy();
	});
});

describe("TenantLocationsPageView loading", () => {
	it("draws the summary and location cards in one busy region while the tenant context loads", () => {
		contextQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
		renderAs(<LocationsPageView tenantSlug={TEST_ORG_SLUG} />, "OWNER");

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_LOCATIONS_LOADING_LABELS.loading]);
		expect(document.querySelectorAll('[data-slot="location-card-skeleton"]')).toHaveLength(LOCATION_SKELETON_CARDS);
		// The request button waits for the context it would add to.
		expect(screen.getByRole("button", { name: "Add store" }).hasAttribute("disabled")).toBe(true);
	});
});

describe("TenantLocationsPageView authorization (merchant:manage_locations)", () => {
	it.each(["OWNER", "MANAGER"] satisfies MembershipRole[])("offers store requests to %s", (role) => {
		renderAs(<LocationsPageView tenantSlug={TEST_ORG_SLUG} />, role);

		expect(screen.getByRole("button", { name: "Add store" })).toBeTruthy();
		expect(screen.queryByRole("note")).toBeNull();
	});

	it.each(["CASHIER"] satisfies MembershipRole[])("hides store requests and explains why for %s", (role) => {
		renderAs(<LocationsPageView tenantSlug={TEST_ORG_SLUG} />, role);

		expect(screen.queryByRole("button", { name: "Add store" })).toBeNull();
		expect(screen.getByRole("note").textContent).toContain("can view store locations but not request new stores");
	});

	it("shows neither the action nor the notice while the membership resolves", () => {
		renderAs(<LocationsPageView tenantSlug={TEST_ORG_SLUG} />, undefined, true);

		expect(screen.queryByRole("button", { name: "Add store" })).toBeNull();
		expect(screen.queryByRole("note")).toBeNull();
	});
});

describe("TenantDashboardPageView authorization", () => {
	it("shows every shortcut to owners", () => {
		renderAs(<TenantDashboardPageView tenantSlug={TEST_ORG_SLUG} context={null} />, "OWNER");

		for (const name of ["Team & access", "Business verification", "Rewards", "Analytics", "Redemptions log"]) {
			expect(screen.getByText(name)).toBeTruthy();
		}
	});

	it("shows cashiers only the operations they can open", () => {
		renderAs(<TenantDashboardPageView tenantSlug={TEST_ORG_SLUG} context={null} />, "CASHIER");

		expect(screen.getByText("Rewards")).toBeTruthy();
		// Analytics needs a grant for a cashier (ADR 067, edge case 4).
		expect(screen.queryByText("Analytics")).toBeNull();
		expect(screen.getByText("Redemptions log")).toBeTruthy();
		expect(screen.getByText("Store locations")).toBeTruthy();
		expect(screen.queryByText("Team & access")).toBeNull();
		expect(screen.queryByText("Business verification")).toBeNull();
	});

	it("shows admins the team shortcut but not business verification", () => {
		renderAs(<TenantDashboardPageView tenantSlug={TEST_ORG_SLUG} context={null} />, "MANAGER");

		expect(screen.getByText("Team & access")).toBeTruthy();
		expect(screen.queryByText("Business verification")).toBeNull();
	});

	it("hides operations shortcuts from members without merchant capabilities", () => {
		renderWithAuthorization(
			<QueryClientProvider client={new QueryClient()}>
				<TenantDashboardPageView tenantSlug={TEST_ORG_SLUG} context={null} />
			</QueryClientProvider>,
			{ role: "CASHIER", capabilities: [] },
		);

		expect(screen.queryByText("Rewards")).toBeNull();
		expect(screen.queryByText("Analytics")).toBeNull();
		expect(screen.queryByText("Redemptions log")).toBeNull();
	});

	it("denies the dashboard without a membership", () => {
		renderAs(<TenantDashboardPageView tenantSlug={TEST_ORG_SLUG} context={null} />, undefined);

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
	});
});

describe("TenantTeamPageView pages", () => {
	const META = { correlationId: "corr-1", timestamp: 1_792_368_000_000 };

	it("counts every member from meta, pages the roster through the URL, and leaves the invitations' page alone", async () => {
		const member = {
			id: "m-1",
			tenantId: "o-1",
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
		renderAs(<TenantTeamPageView tenantSlug={TEST_ORG_SLUG} />, "MANAGER");

		expect(screen.getByText("41")).toBeDefined();
		expect(listMembersQuery).toHaveBeenLastCalledWith({ tenantSlug: TEST_ORG_SLUG, page: 1, limit: 20 }, expect.anything());
		const pager = screen.getByRole("navigation", { name: "Member pages" });
		expect(within(pager).getByText("Page 1 of 3")).toBeDefined();
		fireEvent.click(within(pager).getByRole("button", { name: "Next" }));

		await flushUrlUpdates();
		const url = new URLSearchParams(window.location.search);
		expect([url.get("membersPage"), url.get("membersCursor"), url.get("invitesPage")]).toEqual(["2", "cursor-2", null]);
		expect(screen.queryByRole("navigation", { name: "Invitation pages" })).toBeNull();
	});
});
