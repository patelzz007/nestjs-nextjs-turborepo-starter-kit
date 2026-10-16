// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCanStartImpersonation, useSuperAdminStatus } from "@/lib/session/super-admin";

interface AuthStub {
	readonly user: { readonly isSuperAdmin: boolean } | null;
	readonly isLoading: boolean;
	readonly api: { readonly auth: { readonly permissions: { readonly useQuery: () => { readonly data?: { readonly data: { readonly isImpersonating?: boolean } } } } } };
}

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn<() => AuthStub>() }));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): AuthStub => authMock(),
}));

function stubAuth(user: AuthStub["user"], isImpersonating = false, isLoading = false): void {
	authMock.mockReturnValue({
		user,
		isLoading,
		api: { auth: { permissions: { useQuery: () => ({ data: { data: { isImpersonating } } }) } } },
	});
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("useSuperAdminStatus", () => {
	it("reports the session super-admin flag", () => {
		stubAuth({ isSuperAdmin: true });
		expect(renderHook(() => useSuperAdminStatus()).result.current).toEqual({ isSuperAdmin: true, isResolved: true });
	});

	it("is unresolved while the identity is still loading", () => {
		stubAuth(null, false, true);
		expect(renderHook(() => useSuperAdminStatus()).result.current).toEqual({ isSuperAdmin: false, isResolved: false });
	});

	it("fails closed once loading finished without a user", () => {
		stubAuth(null);
		expect(renderHook(() => useSuperAdminStatus()).result.current).toEqual({ isSuperAdmin: false, isResolved: true });
	});
});

describe("useCanStartImpersonation", () => {
	it("allows a super admin who is not impersonating", () => {
		stubAuth({ isSuperAdmin: true });
		expect(renderHook(() => useCanStartImpersonation()).result.current).toBe(true);
	});

	it("denies non super admins", () => {
		stubAuth({ isSuperAdmin: false });
		expect(renderHook(() => useCanStartImpersonation()).result.current).toBe(false);
	});

	it("denies nested impersonation", () => {
		stubAuth({ isSuperAdmin: true }, true);
		expect(renderHook(() => useCanStartImpersonation()).result.current).toBe(false);
	});
});
