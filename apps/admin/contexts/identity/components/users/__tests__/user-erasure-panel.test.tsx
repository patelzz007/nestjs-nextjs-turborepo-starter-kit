// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminUserDetailSchema, epochMs, type AccountErasureResponse, type AdminUserDetail } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserErasurePanel } from "../user-erasure-panel";

const ADMIN_ID = "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d";
const TARGET_ID = "3f2a8c3e-7a53-4f5c-9d0a-0d6a6b8f2c11";
const REASON = "Asked by email on 2 November (ticket 4411)";

const { status, request, cancel, viewer } = vi.hoisted(() => ({
	status: vi.fn(),
	request: vi.fn<(input: { readonly userId: string; readonly reason: string }) => Promise<object>>(),
	cancel: vi.fn<(input: { readonly userId: string }) => Promise<object>>(),
	viewer: { current: { id: "", isSuperAdmin: true } },
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		user: viewer.current,
		isLoading: false,
		api: {
			adminPrivacy: {
				userErasure: { useQuery: status },
				requestUserErasure: { useMutation: (): object => ({ mutateAsync: request, isPending: false }) },
				cancelUserErasure: { useMutation: (): object => ({ mutateAsync: cancel, isPending: false }) },
			},
		},
	}),
}));

const USER: AdminUserDetail = AdminUserDetailSchema.parse({
	id: TARGET_ID,
	email: "jane@example.com",
	fullName: "Jane Doe",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: true,
	twoFactorEnabled: false,
	hasAdminAccess: false,
	tokenVersion: 1,
	roles: [],
	permissions: [],
	failedLoginAttempts: 0,
	lockedUntil: null,
	directPermissionIds: [],
	createdAt: 1_786_300_000_000,
	updatedAt: 1_786_300_000_000,
	isDeleted: false,
	deletedAt: null,
	signupReferrer: null,
	signupReferralStatus: null,
	ban: null,
});

const PENDING: AccountErasureResponse = {
	id: "e-1",
	userId: TARGET_ID,
	status: "PENDING",
	requestedBy: "support",
	reason: REASON,
	requestedAt: epochMs(1_786_300_000_000),
	scheduledFor: epochMs(1_788_892_000_000),
	cancelledAt: null,
	completedAt: null,
};

function renderPanel(user: AdminUserDetail = USER): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<UserErasurePanel user={user} />
		</QueryClientProvider>,
	);
}

beforeEach((): void => {
	viewer.current = { id: ADMIN_ID, isSuperAdmin: true };
	status.mockReturnValue({ data: { data: { erasure: null } } });
	request.mockResolvedValue({});
	cancel.mockResolvedValue({});
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("UserErasurePanel", () => {
	it("needs a recorded reason before support can erase an account, then sends it", async () => {
		renderPanel();
		const erase = screen.getByRole("button", { name: "Erase account" });
		expect(erase).toHaveProperty("disabled", true);
		fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "too short" } });
		expect(erase).toHaveProperty("disabled", true);

		fireEvent.change(screen.getByLabelText("Reason"), { target: { value: REASON } });
		fireEvent.click(erase);
		await waitFor((): void => {
			expect(request).toHaveBeenCalledWith({ userId: TARGET_ID, reason: REASON });
		});
	});

	it("shows a pending erasure with who asked and why, and cancels it", async () => {
		status.mockReturnValue({ data: { data: { erasure: PENDING } } });
		renderPanel();
		const pending = document.querySelector("[data-slot=user-erasure-pending]");
		expect(pending?.textContent).toContain("Support");
		expect(pending?.textContent).toContain(REASON);
		fireEvent.click(screen.getByRole("button", { name: "Cancel the erasure" }));
		await waitFor((): void => {
			expect(cancel).toHaveBeenCalledWith({ userId: TARGET_ID });
		});
	});

	it("offers nothing for one's own account or to someone who isn't a super admin", () => {
		viewer.current = { id: TARGET_ID, isSuperAdmin: true };
		renderPanel();
		expect(screen.queryByRole("button", { name: "Erase account" })).toBeNull();
		expect(screen.getByText("Erase your own account from your own security settings.")).toBeTruthy();
	});
});
