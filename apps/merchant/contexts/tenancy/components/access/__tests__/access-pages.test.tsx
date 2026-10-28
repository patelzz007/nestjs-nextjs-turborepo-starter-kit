// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { epochMs, type MembershipRole, type TenantGrantResponse, type TenantMemberAccessResponse, type TenantRoleResponse, type TenantShareResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecordSharesCard } from "@/contexts/tenancy/components/access/record-shares-card";
import { TeamMemberAccessPageView } from "@/contexts/tenancy/components/access/team-member-access-page-view";
import { TeamRoleDetailPageView } from "@/contexts/tenancy/components/access/team-role-detail-page-view";
import { TeamRoleEditorPageView } from "@/contexts/tenancy/components/access/team-role-editor-page-view";
import { TeamRolesList } from "@/contexts/tenancy/components/access/team-roles-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";

const mocks = vi.hoisted(() => ({
	roles: vi.fn(),
	roleHolders: vi.fn(),
	member: vi.fn(),
	memberGrants: vi.fn(),
	shares: vi.fn(),
	context: vi.fn(),
	listMembers: vi.fn(),
	mutate: vi.fn(),
	push: vi.fn(),
}));

/** Every mutation records what it was asked (the page's request), and reports idle. */
function mutation(): object {
	return { mutate: mocks.mutate, reset: vi.fn(), isPending: false, error: null };
}

vi.mock("next/navigation", () => ({ useRouter: (): object => ({ push: mocks.push }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenantAccess: {
				roles: { useQuery: mocks.roles },
				roleHolders: { useQuery: mocks.roleHolders },
				member: { useQuery: mocks.member },
				memberGrants: { useQuery: mocks.memberGrants },
				shares: { useQuery: mocks.shares },
				createRole: { useMutation: mutation },
				updateRole: { useMutation: mutation },
				deleteRole: { useMutation: mutation },
				reassignHolders: { useMutation: mutation },
				resetRole: { useMutation: mutation },
				changeMemberRole: { useMutation: mutation },
				removeMember: { useMutation: mutation },
				grant: { useMutation: mutation },
				revokeGrant: { useMutation: mutation },
				share: { useMutation: mutation },
				unshare: { useMutation: mutation },
			},
			tenants: { context: { useQuery: mocks.context }, listMembers: { useQuery: mocks.listMembers } },
		},
	}),
}));

const OWNER_ROLE: TenantRoleResponse = {
	id: "0199a1b2-0000-7000-8000-0000000000a1",
	name: "Owner",
	templateKey: "OWNER",
	permissions: [{ action: "READ", resource: "REWARD" }],
	holderCount: 1,
};
const CASHIER_ROLE: TenantRoleResponse = {
	id: "0199a1b2-0000-7000-8000-0000000000a3",
	name: "Cashier",
	templateKey: "CASHIER",
	permissions: [{ action: "READ", resource: "REWARD" }],
	holderCount: 2,
};
const MEMBER: TenantMemberAccessResponse = {
	membershipId: "0199a1b2-0000-7000-8000-0000000000b1",
	userId: "0199a1b2-0000-7000-8000-0000000000c1",
	fullName: "Siti Cashier",
	email: "siti@example.com",
	roleId: CASHIER_ROLE.id,
	roleName: "Cashier",
	templateKey: "CASHIER",
	locationScopeType: "ALL_LOCATIONS",
	locationIds: [],
};
const GRANT: TenantGrantResponse = {
	id: "0199a1b2-0000-7000-8000-0000000000d1",
	membershipId: MEMBER.membershipId,
	permission: { action: "READ", resource: "ANALYTICS" },
	locationId: null,
	expiresAt: null,
	grantedBy: "owner",
	grantedVia: "Owner",
	grantedAt: epochMs(1),
};

function ok(data: object): object {
	return { data: { data }, isLoading: false, isError: false, error: null, refetch: vi.fn() };
}

function renderAs(ui: React.ReactElement, role: MembershipRole = "MANAGER"): void {
	renderWithAuthorization(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>, { role });
}

beforeEach((): void => {
	mocks.roles.mockReturnValue(ok([OWNER_ROLE, CASHIER_ROLE]));
	mocks.roleHolders.mockReturnValue(ok({ holders: [], holdersVersion: "v1" }));
	mocks.member.mockReturnValue(ok(MEMBER));
	mocks.memberGrants.mockReturnValue(ok([GRANT]));
	mocks.shares.mockReturnValue(ok([]));
	mocks.context.mockReturnValue({ data: undefined, isLoading: false });
	mocks.listMembers.mockReturnValue({ data: { data: [{ id: MEMBER.membershipId, fullName: MEMBER.fullName }], meta: undefined }, isLoading: false });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("TeamRolesList", () => {
	it("lists every role with its origin and counts, each linking to its page", () => {
		renderAs(<TeamRolesList tenantSlug={TEST_ORG_SLUG} />);

		expect(screen.getByRole("link", { name: /Cashier/ }).getAttribute("href")).toBe(`/t/${TEST_ORG_SLUG}/settings/team/roles/${CASHIER_ROLE.id}`);
		expect(screen.getByText("1 permission · 2 members")).toBeTruthy();
		expect(screen.getByRole("link", { name: "New role" })).toBeTruthy();
	});
});

describe("TeamRoleEditorPageView", () => {
	it("asks for a name before saving, then creates the role with the ticked permissions", () => {
		renderAs(<TeamRoleEditorPageView tenantSlug={TEST_ORG_SLUG} />);

		fireEvent.click(screen.getByRole("button", { name: "Create role" }));
		expect(screen.getByRole("alert").textContent).not.toBe("");
		expect(mocks.mutate).not.toHaveBeenCalled();

		fireEvent.change(screen.getByLabelText("Role name"), { target: { value: "Floor lead" } });
		fireEvent.click(document.getElementById("role-permission-REWARD.READ") ?? document.body);
		fireEvent.click(screen.getByRole("button", { name: "Create role" }));
		expect(mocks.mutate).toHaveBeenCalledWith({ tenantSlug: TEST_ORG_SLUG, name: "Floor lead", permissions: [{ action: "READ", resource: "REWARD" }] });
	});

	it("never offers to edit the Owner role", () => {
		renderAs(<TeamRoleEditorPageView tenantSlug={TEST_ORG_SLUG} roleId={OWNER_ROLE.id} />);

		expect(screen.getByText("The Owner role can't be changed")).toBeTruthy();
		expect(screen.queryByLabelText("Role name")).toBeNull();
	});
});

describe("TeamRoleDetailPageView", () => {
	it("shows a role's permissions with edit, reset and delete — and none of them for the Owner role", () => {
		renderAs(<TeamRoleDetailPageView tenantSlug={TEST_ORG_SLUG} roleId={CASHIER_ROLE.id} />);
		expect(screen.getByRole("link", { name: "Edit role" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Reset to standard" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
		cleanup();

		renderAs(<TeamRoleDetailPageView tenantSlug={TEST_ORG_SLUG} roleId={OWNER_ROLE.id} />);
		expect(screen.queryByRole("link", { name: "Edit role" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
	});

	it("says so when the role does not exist", () => {
		renderAs(<TeamRoleDetailPageView tenantSlug={TEST_ORG_SLUG} roleId="0199a1b2-0000-7000-8000-0000000000ff" />);

		expect(screen.getByText("Role not found")).toBeTruthy();
	});
});

describe("TeamMemberAccessPageView", () => {
	it("shows the member's role, their extra permissions with time left, and removal", () => {
		renderAs(<TeamMemberAccessPageView tenantSlug={TEST_ORG_SLUG} membershipId={MEMBER.membershipId} />);

		expect(screen.getByRole("heading", { name: "Siti Cashier" })).toBeTruthy();
		expect(screen.getByText("Analytics · View")).toBeTruthy();
		expect(screen.getByText("Permanent")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Remove Siti Cashier" })).toBeTruthy();
	});

	it("asks which permission before giving one", () => {
		renderAs(<TeamMemberAccessPageView tenantSlug={TEST_ORG_SLUG} membershipId={MEMBER.membershipId} />);

		fireEvent.click(screen.getByRole("button", { name: "Give permission" }));

		expect(screen.getByText("Choose a permission to give.")).toBeTruthy();
		expect(mocks.mutate).not.toHaveBeenCalled();
	});

	it("says so when the member is gone", () => {
		mocks.member.mockReturnValue({ data: undefined, isLoading: false });
		renderAs(<TeamMemberAccessPageView tenantSlug={TEST_ORG_SLUG} membershipId={MEMBER.membershipId} />);

		expect(screen.getByText("Member not found")).toBeTruthy();
	});
});

describe("RecordSharesCard", () => {
	it("lists only this record's shares, by teammate, with their access and end", () => {
		const shares: readonly TenantShareResponse[] = [
			{ id: "s1", resource: "REWARD", resourceId: "reward-1", membershipId: MEMBER.membershipId, level: "EDIT", expiresAt: null, sharedBy: "owner", sharedAt: epochMs(1) },
			{ id: "s2", resource: "REWARD", resourceId: "reward-2", membershipId: MEMBER.membershipId, level: "VIEW", expiresAt: null, sharedBy: "owner", sharedAt: epochMs(1) },
		];
		mocks.shares.mockReturnValue(ok(shares));
		renderAs(<RecordSharesCard tenantSlug={TEST_ORG_SLUG} resource="REWARD" resourceId="reward-1" timeZone="UTC" />);

		expect(screen.getAllByRole("button", { name: "Stop sharing" })).toHaveLength(1);
		expect(screen.getByText("Can edit")).toBeTruthy();
	});

	it("asks who to share with before sharing", () => {
		renderAs(<RecordSharesCard tenantSlug={TEST_ORG_SLUG} resource="REWARD" resourceId="reward-1" timeZone="UTC" />);

		fireEvent.click(screen.getByRole("button", { name: "Share" }));

		expect(screen.getByText("Choose who to share it with.")).toBeTruthy();
		expect(mocks.mutate).not.toHaveBeenCalled();
	});
});
