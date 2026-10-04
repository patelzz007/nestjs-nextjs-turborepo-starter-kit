// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { AdminMfaRecoveryRequestSchema } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MfaRecoveryReviewPanel } from "@/components/security/mfa-recovery-review-panel";

interface AuthStub {
	readonly user: { readonly isSuperAdmin: boolean } | null;
	readonly isLoading: boolean;
	readonly api: {
		readonly auth: {
			readonly adminMfaRecoveryReview: {
				readonly useMutation: () => { readonly isPending: boolean; readonly mutateAsync?: () => Promise<{ readonly data: { readonly message: string } }> };
			};
		};
	};
}

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn<() => AuthStub>() }));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): AuthStub => authMock(),
}));

const PENDING_REQUEST = AdminMfaRecoveryRequestSchema.parse({
	id: "0b9f4c3e-7a55-4d0f-9d3c-2f0c8f5b1a10",
	userId: "4d2b8e1a-6c3f-4b9a-8e7d-1a2b3c4d5e6f",
	userEmail: "jane@example.com",
	userFullName: "Jane Doe",
	status: "PENDING",
	requestedAt: 1_786_300_000_000,
	reviewedBy: null,
	reviewedAt: null,
	scheduledUnlockAt: null,
	completedAt: null,
	notes: null,
});

function renderPanel(isSuperAdmin: boolean): void {
	authMock.mockReturnValue({ user: { isSuperAdmin }, isLoading: false, api: { auth: { adminMfaRecoveryReview: { useMutation: () => ({ isPending: false }) } } } });
	render(
		<QueryClientProvider client={new QueryClient()}>
			<MfaRecoveryReviewPanel request={PENDING_REQUEST} />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("MfaRecoveryReviewPanel (@SuperAdminOnly review)", () => {
	it("offers approve/deny to super admins", () => {
		renderPanel(true);
		expect(screen.getByRole("button", { name: "Approve recovery" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Deny request" })).toBeDefined();
	});

	it("explains the restriction instead of the actions for other sessions", () => {
		renderPanel(false);
		expect(screen.queryByRole("button", { name: "Approve recovery" })).toBeNull();
		expect(screen.getByText("Only super administrators can approve or deny MFA recovery requests.")).toBeDefined();
	});
});

describe("MfaRecoveryReviewPanel after a review", () => {
	const OTHER_USER_ID = "9e8d7c6b-5a49-4382-9716-0f1e2d3c4b5a";

	function isInvalidated(queryClient: QueryClient, queryKey: QueryKey): boolean | undefined {
		return queryClient.getQueryState(queryKey)?.isInvalidated;
	}

	it("refetches the recovery queue and the reviewed user's detail, not other users'", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(apiRouter.auth.adminMfaRecoveryRequests.queryKey({ page: 1, limit: 20 }), null);
		queryClient.setQueryData(apiRouter.auth.adminUserDetail.queryKey({ userId: PENDING_REQUEST.userId }), null);
		queryClient.setQueryData(apiRouter.auth.adminUserDetail.queryKey({ userId: OTHER_USER_ID }), null);
		const mutateAsync = (): Promise<{ readonly data: { readonly message: string } }> => Promise.resolve({ data: { message: "Recovery approved" } });
		authMock.mockReturnValue({
			user: { isSuperAdmin: true },
			isLoading: false,
			api: { auth: { adminMfaRecoveryReview: { useMutation: () => ({ isPending: false, mutateAsync }) } } },
		});
		render(
			<QueryClientProvider client={queryClient}>
				<MfaRecoveryReviewPanel request={PENDING_REQUEST} />
			</QueryClientProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Approve recovery" }));

		await waitFor((): void => {
			expect(isInvalidated(queryClient, apiRouter.auth.adminUserDetail.queryKey({ userId: PENDING_REQUEST.userId }))).toBe(true);
		});
		expect(screen.getByText("Recovery approved")).toBeDefined();
		expect(isInvalidated(queryClient, apiRouter.auth.adminMfaRecoveryRequests.queryKey({ page: 1, limit: 20 }))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.auth.adminUserDetail.queryKey({ userId: OTHER_USER_ID }))).toBe(false);
	});
});
