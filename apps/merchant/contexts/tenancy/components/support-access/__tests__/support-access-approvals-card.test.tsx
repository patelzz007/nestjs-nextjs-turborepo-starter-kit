// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { epochMs, type MembershipRole, type SupportAccessGrantDetail } from "@workspace/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SupportAccessApprovalsCard } from "../support-access-approvals-card";

const TENANT_ID = "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11";

const { roleHolder, grantsHolder, approve, listQuery } = vi.hoisted(() => {
	const role: { current: MembershipRole | undefined } = { current: undefined };
	const grants: { current: readonly SupportAccessGrantDetail[] } = { current: [] };
	return { roleHolder: role, grantsHolder: grants, approve: vi.fn<(input: object) => void>(), listQuery: vi.fn<(input: object, options: object) => void>() };
});

vi.mock("@/features/tenant-context/facade", () => ({
	useActiveMembership: (): object => ({ membership: roleHolder.current === undefined ? undefined : { role: roleHolder.current }, isLoading: false }),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			supportAccess: {
				tenantList: {
					useQuery: (input: object, options: object): object => {
						listQuery(input, options);
						return { data: { data: grantsHolder.current } };
					},
				},
				approve: { useMutation: (): object => ({ mutate: approve, isPending: false }) },
			},
		},
	}),
}));

function grant(status: SupportAccessGrantDetail["status"], id: string): SupportAccessGrantDetail {
	return {
		id,
		tenantId: TENANT_ID,
		mode: "READ_ONLY",
		status,
		expiresAt: epochMs(1_792_368_000_000),
		createdAt: epochMs(1_792_368_000_000),
		tenant: { id: TENANT_ID, slug: "acme-coffee", displayName: "Acme Coffee" },
		supportUser: { id: "0199a1b2-0000-7000-8000-0000000000c1", fullName: "Sam Support", email: "sam@example.com" },
		approvedBy: null,
		reason: "Investigating a failed redemption",
		ticketRef: "SUP-7",
		revokedAt: null,
	};
}

function renderAs(role: MembershipRole | undefined): void {
	roleHolder.current = role;
	render(
		<QueryClientProvider client={new QueryClient()}>
			<SupportAccessApprovalsCard tenantSlug="acme-coffee" />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("SupportAccessApprovalsCard", () => {
	it("lets the owner approve a waiting request, and lists only waiting ones", () => {
		grantsHolder.current = [grant("PENDING_TENANT_APPROVAL", "0199a1b2-0000-7000-8000-0000000000a1"), grant("ACTIVE", "0199a1b2-0000-7000-8000-0000000000a2")];
		renderAs("OWNER");

		expect(screen.getAllByRole("button", { name: "Approve access" })).toHaveLength(1);
		fireEvent.click(screen.getByRole("button", { name: "Approve access" }));

		expect(approve).toHaveBeenCalledWith({ grantId: "0199a1b2-0000-7000-8000-0000000000a1" });
		expect(screen.getByText(/Ticket SUP-7/)).toBeDefined();
	});

	it("never asks the API for anyone but the owner", () => {
		renderAs("MANAGER");

		expect(screen.queryByText("Support access")).toBeNull();
		expect(listQuery).toHaveBeenCalledWith({ tenantSlug: "acme-coffee" }, { enabled: false });
	});
});
