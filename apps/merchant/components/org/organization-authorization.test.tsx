// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, screen } from "@testing-library/react";
import type { OrganizationMembershipRole } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrgDashboardPageView } from "@/components/org/org-dashboard-page-view";
import { OrganizationLocationsPageView } from "@/components/org/organization-locations-page-view";
import { OrganizationTeamPageView } from "@/components/org/organization-team-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";

const { contextQuery, listMembersQuery, listInvitesQuery, organizationMutation } = vi.hoisted(() => ({
	contextQuery: vi.fn(),
	listMembersQuery: vi.fn(),
	listInvitesQuery: vi.fn(),
	organizationMutation: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
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

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
		expect(screen.queryByText("Team access required")).toBeNull();
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

	it("hides operations shortcuts from members without RewardHub capabilities", () => {
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
