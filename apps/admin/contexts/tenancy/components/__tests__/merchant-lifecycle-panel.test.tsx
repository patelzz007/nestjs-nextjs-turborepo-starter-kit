// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { epochMs, type TenantLifecycleResponse } from "@workspace/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { banActionFor, lifecycleActionFor, MerchantLifecyclePanel } from "../merchant-lifecycle-panel";

const TENANT_ID = "0199a1b2-0000-7000-8000-000000000001";

const { suspend, reinstate, reject, ban, unban, viewer } = vi.hoisted(() => ({
	suspend: vi.fn<(input: object) => void>(),
	reinstate: vi.fn<(input: object) => void>(),
	reject: vi.fn<(input: object) => void>(),
	ban: vi.fn<(input: object) => void>(),
	unban: vi.fn<(input: object) => void>(),
	viewer: { isSuperAdmin: false },
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		user: { id: "0199a1b2-0000-7000-8000-0000000000ad", isSuperAdmin: viewer.isSuperAdmin },
		isLoading: false,
		api: {
			rewardsAdmin: {
				suspendTenant: { useMutation: (): object => ({ mutate: suspend, isPending: false }) },
				reinstateTenant: { useMutation: (): object => ({ mutate: reinstate, isPending: false }) },
				rejectTenantAppeal: { useMutation: (): object => ({ mutate: reject, isPending: false }) },
				banTenant: { useMutation: (): object => ({ mutate: ban, isPending: false }) },
				unbanTenant: { useMutation: (): object => ({ mutate: unban, isPending: false }) },
			},
		},
	}),
}));

vi.mock("@workspace/client/lib/contexts/authorization", () => ({
	Can: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <>{children}</>,
}));

function lifecycle(overrides: Partial<TenantLifecycleResponse>): TenantLifecycleResponse {
	return { tenantId: TENANT_ID, lifecycleState: "ACTIVE", deletionGraceEndsAt: null, suspension: null, ban: null, appeals: [], ...overrides };
}

function renderPanel(value: TenantLifecycleResponse): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<MerchantLifecyclePanel lifecycle={value} />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	viewer.isSuperAdmin = false;
});

describe("MerchantLifecyclePanel", () => {
	it("suspends an active merchant with the trimmed reason", () => {
		renderPanel(lifecycle({}));

		fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Chargebacks  " } });
		fireEvent.click(screen.getByRole("button", { name: "Suspend merchant" }));

		expect(suspend).toHaveBeenCalledWith({ tenantId: TENANT_ID, reason: "Chargebacks" });
	});

	it("shows the suspension and the appeals, reinstates, and rejects a pending appeal with a note", () => {
		renderPanel(
			lifecycle({
				lifecycleState: "SUSPENDED",
				suspension: { suspendedAt: epochMs(1_792_368_000_000), reason: "Fraud review" },
				appeals: [
					{
						id: "0199a1b2-0000-7000-8000-0000000000a1",
						status: "PENDING",
						message: "Please reinstate us",
						submittedBy: { id: "0199a1b2-0000-7000-8000-0000000000b1", fullName: "Wong Mei" },
						createdAt: epochMs(1_792_368_000_000),
						reviewedAt: null,
						reviewNote: null,
					},
				],
			}),
		);

		expect(screen.getByText(/Fraud review/)).toBeDefined();
		expect(screen.getByText("Please reinstate us")).toBeDefined();
		fireEvent.change(screen.getByLabelText("Rejection note"), { target: { value: "Not yet" } });
		fireEvent.click(screen.getByRole("button", { name: "Reject appeal" }));
		expect(reject).toHaveBeenCalledWith({ tenantId: TENANT_ID, appealId: "0199a1b2-0000-7000-8000-0000000000a1", note: "Not yet" });

		fireEvent.change(screen.getByLabelText(/Why is this merchant reinstated/), { target: { value: "Verified" } });
		fireEvent.click(screen.getByRole("button", { name: "Reinstate merchant" }));
		expect(reinstate).toHaveBeenCalledWith({ tenantId: TENANT_ID, reason: "Verified" });
	});

	it("offers no action while the merchant is provisioning or pending deletion", () => {
		renderPanel(lifecycle({ lifecycleState: "PENDING_DELETION", deletionGraceEndsAt: epochMs(1_792_368_000_000) }));

		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText(/can cancel the deletion until/)).toBeDefined();
	});
});

describe("MerchantLifecyclePanel ban (super admin)", () => {
	it("offers no ban to a platform admin who is not a super admin", () => {
		renderPanel(lifecycle({}));

		expect(screen.queryByRole("button", { name: "Ban merchant" })).toBeNull();
	});

	it("bans a suspended merchant with the trimmed reason", () => {
		viewer.isSuperAdmin = true;
		renderPanel(lifecycle({ lifecycleState: "SUSPENDED", suspension: { suspendedAt: epochMs(1_792_368_000_000), reason: "Fraud review" } }));

		const button = screen.getByRole("button", { name: "Ban merchant" });
		expect(button.hasAttribute("disabled")).toBe(true);
		fireEvent.change(screen.getByLabelText(/Why is this merchant banned/), { target: { value: "  Counterfeit vouchers  " } });
		fireEvent.click(button);

		expect(ban).toHaveBeenCalledWith({ tenantId: TENANT_ID, reason: "Counterfeit vouchers" });
	});

	it("shows the ban and lifts it; a banned merchant has no suspend or reinstate action", () => {
		viewer.isSuperAdmin = true;
		renderPanel(lifecycle({ lifecycleState: "BANNED", ban: { bannedAt: epochMs(1_792_368_000_000), reason: "Counterfeit vouchers" } }));

		expect(screen.getByText(/Banned .*Counterfeit vouchers/)).toBeDefined();
		expect(screen.queryByRole("button", { name: "Suspend merchant" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Reinstate merchant" })).toBeNull();
		fireEvent.change(screen.getByLabelText(/Why is the ban lifted/), { target: { value: "Cleared by legal" } });
		fireEvent.click(screen.getByRole("button", { name: "Lift ban" }));

		expect(unban).toHaveBeenCalledWith({ tenantId: TENANT_ID, reason: "Cleared by legal" });
	});
});

describe("banActionFor", () => {
	it("follows the API's transition table", () => {
		expect(banActionFor("ACTIVE")).toBe("ban");
		expect(banActionFor("RESTRICTED")).toBe("ban");
		expect(banActionFor("SUSPENDED")).toBe("ban");
		expect(banActionFor("BANNED")).toBe("unban");
		expect(banActionFor("PROVISIONING")).toBeNull();
		expect(banActionFor("PENDING_DELETION")).toBeNull();
	});
});

describe("lifecycleActionFor", () => {
	it("follows the API's transition table", () => {
		expect(lifecycleActionFor("ACTIVE")).toBe("suspend");
		expect(lifecycleActionFor("RESTRICTED")).toBe("suspend");
		expect(lifecycleActionFor("SUSPENDED")).toBe("reinstate");
		expect(lifecycleActionFor("PROVISIONING")).toBeNull();
		expect(lifecycleActionFor("PENDING_DELETION")).toBeNull();
	});
});
