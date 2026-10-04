// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveUserMfaRecoveryState, UserMfaRecoveryPanel } from "@/components/users/user-mfa-recovery-panel";

const { requestsQuery } = vi.hoisted(() => ({
	requestsQuery: vi.fn<() => { readonly data: undefined; readonly isError: boolean; readonly isLoading: boolean; readonly refetch: () => Promise<void> }>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { auth: { adminMfaRecoveryRequests: { useQuery: requestsQuery } } } }),
}));

const USER_ID = "3f2a8c3e-7a53-4f5c-9d0a-0d6a6b8f2c11";

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("UserMfaRecoveryPanel", () => {
	it("never queries recovery requests for a user without 2FA", () => {
		render(<UserMfaRecoveryPanel userId={USER_ID} userFullName="Jane Doe" userEmail="jane@example.com" twoFactorEnabled={false} />);

		expect(screen.getByText("This user has not enrolled in two-factor authentication.")).toBeDefined();
		expect(requestsQuery).not.toHaveBeenCalled();
	});

	it("asks for the user's latest request only, and shows one state", () => {
		requestsQuery.mockReturnValue({ data: undefined, isError: true, isLoading: false, refetch: () => Promise.resolve() });
		render(<UserMfaRecoveryPanel userId={USER_ID} userFullName="Jane Doe" userEmail="jane@example.com" twoFactorEnabled />);

		expect(requestsQuery).toHaveBeenCalledWith({ page: 1, limit: 1, filter: { userId: { eq: USER_ID } } });
		expect(screen.getByRole("alert").textContent).toContain("Could not load MFA recovery requests.");
		expect(screen.queryByText(/No MFA recovery requests/)).toBeNull();
		expect(screen.queryByText(/Loading recovery history/)).toBeNull();
	});
});

describe("resolveUserMfaRecoveryState", () => {
	it("tells loading, error and empty apart", () => {
		expect(resolveUserMfaRecoveryState(undefined, 0, false, true)).toEqual({ status: "loading" });
		expect(resolveUserMfaRecoveryState(undefined, 0, true, false)).toEqual({ status: "error" });
		expect(resolveUserMfaRecoveryState(undefined, 0, false, false)).toEqual({ status: "empty" });
	});
});
