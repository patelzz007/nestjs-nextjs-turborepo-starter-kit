// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { PERMISSION } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebSessionTestProvider, type WebSessionState } from "@/components/auth/web-authorization-provider";
import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner";
import { GUEST_SESSION_STATE, signedInSession } from "@/test-support/session";

interface AuthUserStub {
	readonly id: string;
	readonly isSuperAdmin: boolean;
}

interface QueryStub {
	readonly data: undefined;
	readonly isLoading: boolean;
}

interface MutationStub {
	readonly isPending: boolean;
	readonly mutateAsync: () => Promise<void>;
}

const harness: { user: AuthUserStub | null } = { user: null };

const { adminUsersUseQuery } = vi.hoisted(() => ({
	adminUsersUseQuery: vi.fn<() => QueryStub>(),
}));

function mutationStub(): MutationStub {
	return { isPending: false, mutateAsync: (): Promise<void> => Promise.resolve() };
}

// The panel and banner refresh the route after an identity change; the router is the boundary here.
const { routerRefresh } = vi.hoisted(() => ({ routerRefresh: vi.fn<() => void>() }));
vi.mock("next/navigation", () => ({ useRouter: (): { readonly refresh: typeof routerRefresh } => ({ refresh: routerRefresh }) }));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): {
		readonly user: AuthUserStub | null;
		readonly api: {
			readonly auth: {
				readonly adminUsers: { readonly useQuery: typeof adminUsersUseQuery };
				readonly impersonate: { readonly useMutation: () => MutationStub };
				readonly stopImpersonation: { readonly useMutation: () => MutationStub };
			};
		};
	} => ({
		user: harness.user,
		api: {
			auth: {
				adminUsers: { useQuery: adminUsersUseQuery },
				impersonate: { useMutation: mutationStub },
				stopImpersonation: { useMutation: mutationStub },
			},
		},
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: (): { readonly invalidateQueries: () => Promise<void> } => ({ invalidateQueries: (): Promise<void> => Promise.resolve() }),
}));

const SUPER_ADMIN: AuthUserStub = { id: "admin-1", isSuperAdmin: true };
const CUSTOMER: AuthUserStub = { id: "user-1", isSuperAdmin: false };
const IMPERSONATION_GRANTS = [PERMISSION.USER.LIST, PERMISSION.USER.CREATE];

function renderWithSession(session: WebSessionState, node: React.ReactNode): void {
	render(<WebSessionTestProvider session={session}>{node}</WebSessionTestProvider>);
}

beforeEach(() => {
	harness.user = null;
	adminUsersUseQuery.mockReset();
	adminUsersUseQuery.mockReturnValue({ data: undefined, isLoading: false });
});

afterEach(() => {
	cleanup();
});

describe("ImpersonateUserPanel", () => {
	it("renders for a super-admin holding LIST + CREATE USER", () => {
		harness.user = SUPER_ADMIN;
		renderWithSession(signedInSession({ capabilities: IMPERSONATION_GRANTS }), <ImpersonateUserPanel />);

		expect(screen.getByText("Impersonate user")).toBeDefined();
		expect(adminUsersUseQuery).toHaveBeenCalled();
	});

	it("accepts MANAGE USER as implying both actions", () => {
		harness.user = SUPER_ADMIN;
		renderWithSession(signedInSession({ capabilities: [PERMISSION.USER.MANAGE] }), <ImpersonateUserPanel />);

		expect(screen.getByText("Impersonate user")).toBeDefined();
	});

	it("is hidden when CREATE USER (impersonate) is missing", () => {
		harness.user = SUPER_ADMIN;
		renderWithSession(signedInSession({ capabilities: [PERMISSION.USER.LIST] }), <ImpersonateUserPanel />);

		expect(screen.queryByText("Impersonate user")).toBeNull();
		expect(adminUsersUseQuery).not.toHaveBeenCalled();
	});

	it("is hidden for non-super-admins even with the capabilities", () => {
		harness.user = CUSTOMER;
		renderWithSession(signedInSession({ capabilities: IMPERSONATION_GRANTS }), <ImpersonateUserPanel />);

		expect(screen.queryByText("Impersonate user")).toBeNull();
	});

	it("is hidden while already impersonating", () => {
		harness.user = SUPER_ADMIN;
		renderWithSession(signedInSession({ capabilities: IMPERSONATION_GRANTS, isImpersonating: true }), <ImpersonateUserPanel />);

		expect(screen.queryByText("Impersonate user")).toBeNull();
	});

	it("renders nothing for anonymous visitors", () => {
		renderWithSession(GUEST_SESSION_STATE, <ImpersonateUserPanel />);

		expect(screen.queryByText("Impersonate user")).toBeNull();
		expect(adminUsersUseQuery).not.toHaveBeenCalled();
	});
});

describe("ImpersonationBanner", () => {
	it("shows the stop control during an impersonation session (no permission required)", () => {
		harness.user = CUSTOMER;
		renderWithSession(signedInSession({ isImpersonating: true }), <ImpersonationBanner />);

		expect(screen.getByRole("button", { name: "Stop impersonation" })).toBeDefined();
	});

	it("is hidden outside impersonation", () => {
		harness.user = CUSTOMER;
		renderWithSession(signedInSession(), <ImpersonationBanner />);

		expect(screen.queryByRole("button", { name: "Stop impersonation" })).toBeNull();
	});

	it("renders nothing for anonymous visitors", () => {
		renderWithSession(GUEST_SESSION_STATE, <ImpersonationBanner />);

		expect(screen.queryByRole("button", { name: "Stop impersonation" })).toBeNull();
	});
});
