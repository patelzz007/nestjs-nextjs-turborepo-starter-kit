// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { AdminMfaRecoveryRequestSchema } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MfaRecoveryReviewPanel } from "@/components/security/mfa-recovery-review-panel";

interface AuthStub {
	readonly user: { readonly isSuperAdmin: boolean } | null;
	readonly isLoading: boolean;
	readonly api: { readonly auth: { readonly adminMfaRecoveryReview: { readonly useMutation: () => { readonly isPending: boolean } } } };
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
