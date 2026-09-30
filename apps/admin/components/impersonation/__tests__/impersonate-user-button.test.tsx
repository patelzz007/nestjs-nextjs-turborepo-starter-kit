// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { AdminUserDetailSchema, type AdminUserDetail } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImpersonateUserButton } from "@/components/impersonation/impersonate-user-button";

interface AuthStub {
	readonly user: { readonly id: string; readonly isSuperAdmin: boolean } | null;
	readonly isLoading: boolean;
	readonly api: {
		readonly auth: {
			readonly impersonate: { readonly useMutation: () => { readonly mutateAsync: () => Promise<void>; readonly isPending: boolean } };
			readonly permissions: { readonly useQuery: () => { readonly data: { readonly data: { readonly isImpersonating: boolean } } } };
		};
	};
}

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn<() => AuthStub>() }));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): AuthStub => authMock(),
}));

function stubSession(isSuperAdmin: boolean, isImpersonating = false): void {
	authMock.mockReturnValue({
		user: { id: "admin-1", isSuperAdmin },
		isLoading: false,
		api: {
			auth: {
				impersonate: { useMutation: () => ({ mutateAsync: (): Promise<void> => Promise.resolve(), isPending: false }) },
				permissions: { useQuery: () => ({ data: { data: { isImpersonating } } }) },
			},
		},
	});
}

function targetUser(overrides: { readonly isSuperAdmin?: boolean } = {}): AdminUserDetail {
	return AdminUserDetailSchema.parse({
		id: "user-2",
		email: "target@example.com",
		fullName: "Target User",
		isActive: true,
		isSuperAdmin: overrides.isSuperAdmin ?? false,
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
	});
}

function renderButton(user: AdminUserDetail): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ImpersonateUserButton targetUser={user} />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("ImpersonateUserButton (@SuperAdminOnly)", () => {
	it("renders for a super admin", () => {
		stubSession(true);
		renderButton(targetUser());
		expect(screen.getByRole("button", { name: "Impersonate user" })).toBeDefined();
	});

	it("is hidden for sessions without the super-admin flag", () => {
		stubSession(false);
		renderButton(targetUser());
		expect(screen.queryByRole("button", { name: "Impersonate user" })).toBeNull();
	});

	it("is hidden while already impersonating", () => {
		stubSession(true, true);
		renderButton(targetUser());
		expect(screen.queryByRole("button", { name: "Impersonate user" })).toBeNull();
	});

	it("is hidden for super-admin targets", () => {
		stubSession(true);
		renderButton(targetUser({ isSuperAdmin: true }));
		expect(screen.queryByRole("button", { name: "Impersonate user" })).toBeNull();
	});
});
