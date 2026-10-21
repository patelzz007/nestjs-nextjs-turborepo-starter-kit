// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { epochMs, type MembershipRole, type TenantLifecycleResponse, type TenantRewardMembershipResponse } from "@workspace/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { lifecycleScreenStateOf, TenantLifecycleScreen } from "../tenant-lifecycle-screen";

const TENANT_ID = "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11";

const { lifecycleHolder, submitAppeal, reactivate, leave } = vi.hoisted(() => {
	const holder: { current: TenantLifecycleResponse | undefined } = { current: undefined };
	return {
		lifecycleHolder: holder,
		submitAppeal: vi.fn<(input: object) => void>(),
		reactivate: vi.fn<(input: object) => void>(),
		leave: vi.fn<(input: object) => void>(),
	};
});

vi.mock("next/navigation", () => ({ useRouter: (): object => ({ push: vi.fn() }) }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: {
				lifecycle: { useQuery: (): object => ({ data: lifecycleHolder.current === undefined ? undefined : { data: lifecycleHolder.current }, isError: false, error: null }) },
				submitAppeal: { useMutation: (): object => ({ mutate: submitAppeal, isPending: false }) },
				reactivate: { useMutation: (): object => ({ mutate: reactivate, isPending: false }) },
				leaveTenant: { useMutation: (): object => ({ mutate: leave, isPending: false }) },
			},
		},
	}),
}));

function membership(role: MembershipRole, lifecycleState: TenantRewardMembershipResponse["lifecycleState"]): TenantRewardMembershipResponse {
	return { tenantId: TENANT_ID, tenantSlug: "harbour", displayName: "Harbour Noodle House", role, kybStatus: "APPROVED", lifecycleState };
}

function renderScreen(member: TenantRewardMembershipResponse, lifecycle: TenantLifecycleResponse): void {
	lifecycleHolder.current = lifecycle;
	render(
		<QueryClientProvider client={new QueryClient()}>
			<TenantLifecycleScreen membership={member} />
		</QueryClientProvider>,
	);
}

const SUSPENDED: TenantLifecycleResponse = {
	tenantId: TENANT_ID,
	lifecycleState: "SUSPENDED",
	deletionGraceEndsAt: null,
	suspension: { suspendedAt: epochMs(1_792_368_000_000), reason: "Chargebacks under review" },
	ban: null,
	appeals: [],
};

const BANNED: TenantLifecycleResponse = {
	tenantId: TENANT_ID,
	lifecycleState: "BANNED",
	deletionGraceEndsAt: null,
	suspension: null,
	ban: { bannedAt: epochMs(1_792_368_000_000), reason: "Counterfeit vouchers" },
	appeals: [],
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("TenantLifecycleScreen", () => {
	it("lets the owner of a suspended tenant appeal with the trimmed message", () => {
		renderScreen(membership("OWNER", "SUSPENDED"), SUSPENDED);

		expect(screen.getByText("Reason: Chargebacks under review")).toBeDefined();
		fireEvent.change(screen.getByLabelText("Appeal the suspension"), { target: { value: "  We refunded every order  " } });
		fireEvent.click(screen.getByRole("button", { name: "Send appeal" }));

		expect(submitAppeal).toHaveBeenCalledWith({ tenantSlug: "harbour", message: "We refunded every order" });
		expect(screen.queryByRole("button", { name: "Leave this tenant" })).toBeNull();
	});

	it("tells the owner a pending appeal is waiting, and shows the appeal history", () => {
		renderScreen(membership("OWNER", "SUSPENDED"), {
			...SUSPENDED,
			appeals: [
				{
					id: "0199a1b2-0000-7000-8000-0000000000a1",
					status: "PENDING",
					message: "Please",
					submittedBy: null,
					createdAt: epochMs(1_792_368_000_000),
					reviewedAt: null,
					reviewNote: null,
				},
			],
		});

		expect(screen.getByText("Your appeal is waiting for review.")).toBeDefined();
		expect(screen.queryByRole("button", { name: "Send appeal" })).toBeNull();
		expect(screen.getByText("Waiting for review")).toBeDefined();
	});

	it("lets any other member leave, but not appeal", () => {
		renderScreen(membership("CASHIER", "SUSPENDED"), SUSPENDED);

		expect(screen.getByText("Only the tenant owner can appeal.")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Leave this tenant" }));
		fireEvent.click(screen.getByRole("button", { name: "Leave tenant" }));

		expect(leave).toHaveBeenCalledWith({ tenantSlug: "harbour" });
	});

	it("tells the owner of a banned tenant why, offering no appeal and no reactivation", () => {
		renderScreen(membership("OWNER", "BANNED"), BANNED);

		expect(screen.getByText("Harbour Noodle House is banned")).toBeDefined();
		expect(screen.getByText("Reason: Counterfeit vouchers")).toBeDefined();
		expect(screen.getByText(/A ban cannot be appealed here/)).toBeDefined();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("lets any other member of a banned tenant leave", () => {
		renderScreen(membership("CASHIER", "BANNED"), BANNED);

		fireEvent.click(screen.getByRole("button", { name: "Leave this tenant" }));
		fireEvent.click(screen.getByRole("button", { name: "Leave tenant" }));

		expect(leave).toHaveBeenCalledWith({ tenantSlug: "harbour" });
	});

	it("lets the owner cancel a pending deletion", () => {
		renderScreen(membership("OWNER", "PENDING_DELETION"), {
			...SUSPENDED,
			lifecycleState: "PENDING_DELETION",
			suspension: null,
			deletionGraceEndsAt: epochMs(1_792_400_000_000),
		});

		fireEvent.click(screen.getByRole("button", { name: "Cancel the deletion" }));

		expect(reactivate).toHaveBeenCalledWith({ tenantSlug: "harbour" });
	});
});

describe("lifecycleScreenStateOf", () => {
	it("takes over the shell only for a suspended, banned or pending-deletion tenant", () => {
		expect(lifecycleScreenStateOf(membership("OWNER", "SUSPENDED"))).toBe("SUSPENDED");
		expect(lifecycleScreenStateOf(membership("OWNER", "BANNED"))).toBe("BANNED");
		expect(lifecycleScreenStateOf(membership("OWNER", "PENDING_DELETION"))).toBe("PENDING_DELETION");
		expect(lifecycleScreenStateOf(membership("OWNER", "ACTIVE"))).toBeNull();
		expect(lifecycleScreenStateOf(undefined)).toBeNull();
	});
});
