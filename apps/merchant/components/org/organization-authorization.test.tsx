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

describe("OrganizationTeamPageView authorization (OWNER/ADMIN)", () => {
	it("shows the roster and invite form to admins", () => {
		renderAs(<OrganizationTeamPageView orgSlug={TEST_ORG_SLUG} />, "ADMIN");

		expect(screen.getByRole("button", { name: "Send invitation" })).toBeTruthy();
		expect(screen.getByText("Pending invitations")).toBeTruthy();
	});

	it("denies the page and skips the roster queries for other roles", () => {
		renderAs(<OrganizationTeamPageView orgSlug={TEST_ORG_SLUG} />, "CASHIER");

		expect(screen.getByText("Owner or admin access required")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Send invitation" })).toBeNull();
		expect(listMembersQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderAs(<OrganizationTeamPageView orgSlug={TEST_ORG_SLUG} />, undefined, true);

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
		expect(screen.queryByText("Owner or admin access required")).toBeNull();
	});
});

describe("OrganizationLocationsPageView authorization (OWNER/ADMIN)", () => {
	it("offers store requests to owners", () => {
		renderAs(<OrganizationLocationsPageView orgSlug={TEST_ORG_SLUG} />, "OWNER");

		expect(screen.getByRole("button", { name: "Add store" })).toBeTruthy();
		expect(screen.queryByRole("note")).toBeNull();
	});

	it("hides store requests and explains why for other roles", () => {
		renderAs(<OrganizationLocationsPageView orgSlug={TEST_ORG_SLUG} />, "CASHIER");

		expect(screen.queryByRole("button", { name: "Add store" })).toBeNull();
		expect(screen.getByRole("note").textContent).toContain("owners and admins");
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
		expect(screen.queryByText("Team & access")).toBeNull();
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
