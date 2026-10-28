// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { MembershipRole, TenantRoleResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoleCapabilityMatrix, roleGives } from "@/contexts/tenancy/components/access/role-capability-matrix";
import { activeSettingsSection, MerchantSettingsShell } from "@/contexts/tenancy/components/settings/merchant-settings-shell";
import { describeTills, TenantIntegrationsView } from "@/contexts/tenancy/components/settings/tenant-integrations-view";
import { InviteTeammateDialog } from "@/contexts/tenancy/components/tenant/invite-teammate-dialog";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { TEST_RESPONSE_META } from "@/test/envelope";

const mocks = vi.hoisted(() => ({
	pathname: "/t/acme-coffee/settings/team",
	invites: vi.fn(),
	tills: vi.fn(),
	keys: vi.fn(),
	mutate: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: (): string => mocks.pathname, useRouter: (): object => ({ push: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: {
				listMemberInvites: { useQuery: mocks.invites },
				inviteMember: { useMutation: (): object => ({ mutate: mocks.mutate, isPending: false }) },
				terminals: { summary: { useQuery: mocks.tills } },
				apiKeys: { list: { useQuery: mocks.keys } },
			},
		},
	}),
}));

/** A paginated envelope's meta with `total` rows overall (one per page). */
function pageMeta(total: number): object {
	return { ...TEST_RESPONSE_META, page: 1, limit: 1, total, totalPages: total, hasNext: total > 1, hasPrevious: false, nextCursor: null };
}

function renderAs(ui: React.ReactElement, role: MembershipRole): void {
	renderWithAuthorization(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>, { role });
}

beforeEach((): void => {
	mocks.invites.mockReturnValue({ data: { data: [], meta: pageMeta(3) } });
	mocks.tills.mockReturnValue({ data: { data: { total: 4, byStatus: { ACTIVE: 3, AWAITING_PAIRING: 1, UNPAIRED: 0 }, storesWithTerminals: 2 } } });
	mocks.keys.mockReturnValue({ data: { data: [], meta: pageMeta(2) } });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("activeSettingsSection", () => {
	it("picks the section a path belongs to, the most specific one first", () => {
		expect(activeSettingsSection("/settings")).toBe("profile");
		expect(activeSettingsSection("/settings/team/roles/abc")).toBe("team");
		expect(activeSettingsSection("/settings/integrations")).toBe("integrations");
		expect(activeSettingsSection("/account")).toBe("security");
		expect(activeSettingsSection("/rewards")).toBeUndefined();
		expect(activeSettingsSection(undefined)).toBeUndefined();
	});
});

describe("MerchantSettingsShell", () => {
	it("lists only the sections the member may open, marks the open one, and counts waiting invitations", () => {
		renderAs(
			<MerchantSettingsShell tenantSlug={TEST_ORG_SLUG}>
				<p>section</p>
			</MerchantSettingsShell>,
			"OWNER",
		);

		const nav = screen.getByRole("navigation", { name: "Settings sections" });
		const team = within(nav).getByRole("link", { name: /Team & permissions/ });
		expect(team.getAttribute("aria-current")).toBe("page");
		expect(within(team).getByText("3")).toBeTruthy();
		expect(within(nav).getByRole("link", { name: "Business verification" })).toBeTruthy();
		expect(screen.getByText("section")).toBeTruthy();
	});

	it("leaves out what a cashier can't open, and never asks for invitations", () => {
		renderAs(
			<MerchantSettingsShell tenantSlug={TEST_ORG_SLUG}>
				<p>section</p>
			</MerchantSettingsShell>,
			"CASHIER",
		);

		const nav = screen.getByRole("navigation", { name: "Settings sections" });
		expect(within(nav).queryByRole("link", { name: /Team & permissions/ })).toBeNull();
		expect(within(nav).queryByRole("link", { name: "Integrations" })).toBeNull();
		expect(within(nav).getByRole("link", { name: "Security" })).toBeTruthy();
		expect(mocks.invites).toHaveBeenCalledWith(expect.anything(), { enabled: false });
	});
});

describe("TenantIntegrationsView", () => {
	it("says what is connected and links to managing it", () => {
		renderAs(<TenantIntegrationsView tenantSlug={TEST_ORG_SLUG} />, "OWNER");

		expect(screen.getByText("3 active · 1 waiting to pair of 4")).toBeTruthy();
		expect(screen.getByText("2 keys in use")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Manage tills" }).getAttribute("href")).toContain("/terminals");
	});

	it("describes tills in words", () => {
		expect(describeTills({ total: 0, active: 0, awaitingPairing: 0 })).toBe("No tills connected yet.");
		expect(describeTills({ total: 2, active: 2, awaitingPairing: 0 })).toBe("2 active of 2");
	});
});

const MANAGER_ROLE: TenantRoleResponse = { id: "r-m", name: "Manager", templateKey: "MANAGER", permissions: [{ action: "UPDATE", resource: "MEMBER" }], holderCount: 1 };
const CASHIER_ROLE: TenantRoleResponse = { id: "r-c", name: "Cashier", templateKey: "CASHIER", permissions: [{ action: "READ", resource: "REWARD" }], holderCount: 2 };

describe("RoleCapabilityMatrix", () => {
	it("ticks what each role gives, one column per role, and opens the roles to customise", () => {
		const onCustomise = vi.fn();
		render(<RoleCapabilityMatrix roles={[MANAGER_ROLE, CASHIER_ROLE]} onCustomise={onCustomise} />);

		const teamRow = screen.getByRole("rowheader", { name: "Manage the team" }).closest("tr");
		expect(
			teamRow === null
				? []
				: within(teamRow)
						.getAllByLabelText(/Yes|No/)
						.map((cell) => cell.getAttribute("aria-label")),
		).toEqual(["Yes", "No"]);
		fireEvent.click(screen.getByRole("button", { name: "Customise roles" }));
		expect(onCustomise).toHaveBeenCalled();
	});

	it("knows whether a role gives a capability", () => {
		expect(roleGives(CASHIER_ROLE, "merchant:view_rewards")).toBe(true);
		expect(roleGives(CASHIER_ROLE, "merchant:manage_team")).toBe(false);
	});
});

describe("InviteTeammateDialog", () => {
	it("checks the email with the API's schema, then sends the invitation", () => {
		renderAs(<InviteTeammateDialog tenantSlug={TEST_ORG_SLUG} locations={[]} onClose={vi.fn()} onInvited={vi.fn()} />, "OWNER");

		fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
		expect(screen.getByRole("alert").textContent).not.toBe("");
		expect(mocks.mutate).not.toHaveBeenCalled();

		fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "siti@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
		expect(mocks.mutate).toHaveBeenCalledWith({ tenantSlug: TEST_ORG_SLUG, email: "siti@example.com", role: "CASHIER", locationScopeType: "ALL_LOCATIONS", locationIds: [] });
	});
});
