// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminUserDetailSchema, epochMs, type AdminUserDetail, type ApiResponseMeta, type ImpersonateResponse, type UserResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImpersonateUserButton } from "@/components/impersonation/impersonate-user-button";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const META: ApiResponseMeta = { correlationId: "corr-impersonate", timestamp: epochMs(1_786_300_000_000) };

interface ImpersonateEnvelope {
	readonly success: true;
	readonly data: ImpersonateResponse;
	readonly meta: ApiResponseMeta;
}

const mocks = vi.hoisted(() => ({
	impersonate: vi.fn<(input: { readonly userId: string }) => Promise<ImpersonateEnvelope>>(),
	login: vi.fn<(profile: UserResponse, answeredBy: ApiResponseMeta) => void>(),
	routerRefresh: vi.fn<() => void>(),
	session: { isSuperAdmin: true, isImpersonating: false },
}));

vi.mock("next/navigation", () => ({ useRouter: (): { readonly refresh: () => void } => ({ refresh: mocks.routerRefresh }) }));

vi.mock("@workspace/client/lib/auth", () => {
	const mutation =
		(mutateAsync: (input: { readonly userId: string }) => Promise<ImpersonateEnvelope>) => (): { readonly mutateAsync: typeof mutateAsync; readonly isPending: boolean } => ({
			mutateAsync,
			isPending: false,
		});
	return {
		useAuth: (): object => ({
			user: { id: "admin-1", isSuperAdmin: mocks.session.isSuperAdmin },
			login: mocks.login,
			isLoading: false,
			api: {
				auth: {
					impersonate: { useMutation: mutation(mocks.impersonate) },
					stopImpersonation: {
						useMutation: (): { readonly mutateAsync: () => Promise<void>; readonly isPending: boolean } => ({
							mutateAsync: (): Promise<void> => Promise.resolve(),
							isPending: false,
						}),
					},
					me: { fetchOrThrow: (): Promise<void> => Promise.resolve() },
					permissions: {
						useQuery: (): { readonly data: { readonly data: { readonly isImpersonating: boolean } } } => ({
							data: { data: { isImpersonating: mocks.session.isImpersonating } },
						}),
					},
				},
			},
		}),
	};
});

function stubSession(isSuperAdmin: boolean, isImpersonating = false): void {
	mocks.session.isSuperAdmin = isSuperAdmin;
	mocks.session.isImpersonating = isImpersonating;
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
		{ wrapper: UiKitTestProviders },
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

	it("asks for confirmation first, then switches identity through the auth commands (cache cleared) and refreshes the route", async () => {
		stubSession(true);
		const target = targetUser();
		const impersonatedProfile: UserResponse = { ...target, isEmailVerified: true, roles: [] };
		mocks.impersonate.mockResolvedValue({ success: true, data: { message: "ok", impersonating: true, originalUserId: "admin-1", user: impersonatedProfile }, meta: META });
		renderButton(target);

		fireEvent.click(screen.getByRole("button", { name: "Impersonate user" }));
		expect(mocks.impersonate).not.toHaveBeenCalled();
		fireEvent.click(await screen.findByRole("button", { name: "Impersonate" }));

		await waitFor((): void => {
			expect(mocks.login).toHaveBeenCalledWith(impersonatedProfile, META);
		});
		expect(mocks.impersonate).toHaveBeenCalledWith({ userId: target.id });
		expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);
	});
});
