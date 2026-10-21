// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AdminUserDetailSchema, ApiPaginatedMetaSchema, PERMISSION, type AdminUserDetail, type ApiPaginatedMeta, type CapabilitySlug } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type { JSX, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapabilitiesProvider } from "../../../authorization/index";
import { IMPERSONATE_USER_PANEL_LABELS } from "../impersonate-user-panel-labels";
import { ImpersonateUserPanel } from "../impersonate-user-panel";

interface SignedInUser {
	readonly id: string;
	readonly isSuperAdmin: boolean;
}

interface UsersPage {
	readonly data: readonly AdminUserDetail[];
	readonly meta: ApiPaginatedMeta;
}

/** What the stubbed `api.auth.adminUsers.useQuery` answers. */
interface UsersQueryState {
	readonly data: UsersPage | undefined;
	readonly isLoading: boolean;
}

/** The inputs the panel asks the users list with. */
interface UsersQueryInput {
	readonly page: number;
	readonly limit: number;
	readonly cursor?: string;
	readonly search?: string;
}

interface MutationStub {
	readonly isPending: boolean;
	readonly mutateAsync: () => Promise<void>;
}

const mocks = vi.hoisted(() => {
	const signedIn: { current: SignedInUser | null } = { current: null };
	return { signedIn, usersQuery: vi.fn<(input: UsersQueryInput) => UsersQueryState>() };
});

function mutationStub(): MutationStub {
	return { isPending: false, mutateAsync: (): Promise<void> => Promise.resolve() };
}

// The panel refreshes the route after an identity change; the router is the boundary here.
vi.mock("next/navigation", () => ({ useRouter: (): { readonly refresh: () => void } => ({ refresh: (): void => undefined }) }));

vi.mock("../../index", () => ({
	useAuth: (): {
		readonly user: SignedInUser | null;
		readonly login: () => Promise<void>;
		readonly api: {
			readonly auth: {
				readonly adminUsers: { readonly useQuery: typeof mocks.usersQuery };
				readonly impersonate: { readonly useMutation: () => MutationStub };
				readonly stopImpersonation: { readonly useMutation: () => MutationStub };
			};
		};
	} => ({
		user: mocks.signedIn.current,
		login: (): Promise<void> => Promise.resolve(),
		api: {
			auth: {
				adminUsers: { useQuery: mocks.usersQuery },
				impersonate: { useMutation: mutationStub },
				stopImpersonation: { useMutation: mutationStub },
			},
		},
	}),
}));

const SUPER_ADMIN: SignedInUser = { id: "admin-1", isSuperAdmin: true };
const IMPERSONATION_GRANTS: readonly CapabilitySlug[] = [PERMISSION.USER.LIST, PERMISSION.USER.CREATE];
const NOW_MS = 1_786_300_000_000;

function user(id: string, overrides: Partial<Pick<AdminUserDetail, "isActive" | "isSuperAdmin">> = {}): AdminUserDetail {
	return AdminUserDetailSchema.parse({
		id,
		email: `${id}@example.com`,
		fullName: `User ${id}`,
		isActive: overrides.isActive ?? true,
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
		createdAt: NOW_MS,
		updatedAt: NOW_MS,
		isDeleted: false,
		deletedAt: null,
		signupReferrer: null,
		signupReferralStatus: null,
		ban: null,
	});
}

function page(users: readonly AdminUserDetail[], nextCursor: string | null): UsersQueryState {
	return {
		isLoading: false,
		data: {
			data: users,
			meta: ApiPaginatedMetaSchema.parse({
				correlationId: "test",
				timestamp: NOW_MS,
				limit: 10,
				total: users.length,
				page: 1,
				totalPages: 1,
				nextCursor,
				hasNext: nextCursor !== null,
				hasPrevious: false,
			}),
		},
	};
}

function renderPanel({
	isImpersonating = false,
	grants = IMPERSONATION_GRANTS,
}: { readonly isImpersonating?: boolean; readonly grants?: readonly CapabilitySlug[] } = {}): void {
	function Providers({ children }: { readonly children: ReactNode }): JSX.Element {
		return (
			<UiKitTestProviders>
				<CapabilitiesProvider capabilities={grants}>{children}</CapabilitiesProvider>
			</UiKitTestProviders>
		);
	}
	render(<ImpersonateUserPanel isImpersonating={isImpersonating} />, { wrapper: Providers });
}

beforeEach(() => {
	mocks.signedIn.current = SUPER_ADMIN;
	mocks.usersQuery.mockReset();
	mocks.usersQuery.mockReturnValue(page([], null));
});

afterEach(() => {
	cleanup();
});

describe("ImpersonateUserPanel", () => {
	it("stays hidden — and never lists users — for anyone but a super-admin holding both grants who is not impersonating", () => {
		mocks.signedIn.current = { id: "user-1", isSuperAdmin: false };
		renderPanel();
		cleanup();
		mocks.signedIn.current = SUPER_ADMIN;
		renderPanel({ grants: [PERMISSION.USER.LIST] });
		cleanup();
		renderPanel({ isImpersonating: true });

		expect(screen.queryByText(IMPERSONATE_USER_PANEL_LABELS.title)).toBeNull();
		expect(mocks.usersQuery).not.toHaveBeenCalled();
	});

	it("offers to impersonate active, regular users other than the signed-in super-admin", () => {
		mocks.usersQuery.mockReturnValue(page([user("u-1"), user("u-2", { isActive: false }), user("u-3", { isSuperAdmin: true }), user(SUPER_ADMIN.id)], null));
		renderPanel();

		expect(screen.getByText(IMPERSONATE_USER_PANEL_LABELS.title)).toBeDefined();
		expect(screen.getAllByRole("button", { name: IMPERSONATE_USER_PANEL_LABELS.impersonate })).toHaveLength(1);
		expect(screen.getByText("User u-1").closest("li")?.querySelector("button")).not.toBeNull();
	});

	it("announces the loading list once, and says so when the search finds nobody", () => {
		mocks.usersQuery.mockReturnValue({ data: undefined, isLoading: true });
		renderPanel();
		expect(screen.getAllByRole("status")).toHaveLength(1);
		expect(screen.getByText(IMPERSONATE_USER_PANEL_LABELS.loading)).toBeDefined();
		cleanup();

		mocks.usersQuery.mockReturnValue(page([], null));
		renderPanel();
		expect(screen.getByText(IMPERSONATE_USER_PANEL_LABELS.empty)).toBeDefined();
	});

	it("pages with the server's cursor, and a new search starts again from the first page", () => {
		mocks.usersQuery.mockReturnValue(page([user("u-1")], "cursor-2"));
		renderPanel();

		fireEvent.click(screen.getByRole("button", { name: IMPERSONATE_USER_PANEL_LABELS.next }));
		expect(mocks.usersQuery).toHaveBeenLastCalledWith({ page: 1, limit: 10, cursor: "cursor-2" });

		fireEvent.change(screen.getByRole("textbox", { name: IMPERSONATE_USER_PANEL_LABELS.searchLabel }), { target: { value: "jane" } });
		expect(mocks.usersQuery).toHaveBeenLastCalledWith({ page: 1, limit: 10, search: "jane" });
	});
});
