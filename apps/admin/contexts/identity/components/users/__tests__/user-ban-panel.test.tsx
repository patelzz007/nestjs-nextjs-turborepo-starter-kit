// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminUserDetailSchema, epochMs, type AdminUserDetail } from "@workspace/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveUserBanBlocker, UserBanPanel } from "../user-ban-panel";

const ADMIN_ID = "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d";
const TARGET_ID = "3f2a8c3e-7a53-4f5c-9d0a-0d6a6b8f2c11";

const { ban, unban, viewer } = vi.hoisted(() => ({
	ban: vi.fn<(input: { readonly userId: string; readonly reason: string }) => Promise<object>>(),
	unban: vi.fn<(input: { readonly userId: string }) => Promise<object>>(),
	viewer: { current: { id: "", isSuperAdmin: true } },
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		user: viewer.current,
		isLoading: false,
		api: {
			auth: {
				adminUserBan: { useMutation: (): object => ({ mutateAsync: ban, isPending: false }) },
				adminUserUnban: { useMutation: (): object => ({ mutateAsync: unban, isPending: false }) },
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

const BANNED: AdminUserDetail = {
	...USER,
	isActive: false,
	ban: { bannedAt: epochMs(1_786_400_000_000), reason: "Chargeback fraud", bannedBy: { id: ADMIN_ID, fullName: "Ada Admin" } },
};

function renderPanel(user: AdminUserDetail): void {
	const client = new QueryClient();
	render(
		<QueryClientProvider client={client}>
			<UserBanPanel user={user} />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	viewer.current = { id: ADMIN_ID, isSuperAdmin: true };
	ban.mockResolvedValue({});
	unban.mockResolvedValue({});
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("UserBanPanel", () => {
	it("bans with the trimmed reason, and only once a reason is typed", async () => {
		renderPanel(USER);
		const button = screen.getByRole("button", { name: "Ban account" });
		expect(button.hasAttribute("disabled")).toBe(true);

		fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "  Chargeback fraud  " } });
		fireEvent.click(button);

		await waitFor(() => {
			expect(ban).toHaveBeenCalledWith({ userId: TARGET_ID, reason: "Chargeback fraud" });
		});
	});

	it("shows the ban and lifts it", async () => {
		renderPanel(BANNED);

		expect(screen.getByText("Chargeback fraud")).toBeDefined();
		expect(screen.getByText("Ada Admin")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Lift ban" }));

		await waitFor(() => {
			expect(unban).toHaveBeenCalledWith({ userId: TARGET_ID });
		});
	});

	it("offers no control on the viewer's own account", () => {
		viewer.current = { id: TARGET_ID, isSuperAdmin: true };
		renderPanel(USER);

		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText("You cannot ban your own account.")).toBeDefined();
	});
});

describe("resolveUserBanBlocker", () => {
	it("tells every refusal apart", () => {
		expect(resolveUserBanBlocker({ id: ADMIN_ID, isSuperAdmin: false }, USER)).toBe("not-super-admin");
		expect(resolveUserBanBlocker({ id: TARGET_ID, isSuperAdmin: true }, USER)).toBe("self");
		expect(resolveUserBanBlocker({ id: ADMIN_ID, isSuperAdmin: true }, { ...USER, isSuperAdmin: true })).toBe("target-super-admin");
		expect(resolveUserBanBlocker({ id: ADMIN_ID, isSuperAdmin: true }, USER)).toBeNull();
	});
});
