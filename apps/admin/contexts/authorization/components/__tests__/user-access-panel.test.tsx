// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/contexts/authorization";
import { AdminUserDetailSchema, PERMISSION, type CapabilitySlug } from "@workspace/shared";
import * as React from "react";
import { ApiError } from "@workspace/client/lib/api/api-request";
import { toastMessage } from "@workspace/ui/components/toast";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as IdentityModule from "@workspace/client/lib/contexts/identity";
import { UserAccessPanel } from "@/contexts/authorization/components/user-access-panel";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

interface MutationStub {
	readonly mutate: () => void;
	readonly isPending: boolean;
}

interface MutationOptionsStub {
	readonly onError?: (error: Error) => void;
	readonly onSuccess?: () => Promise<void>;
}

interface MutationHookStub {
	readonly useMutation: (options: MutationOptionsStub) => MutationStub;
}

/** A page of a list, as `useQuery` returns it. */
interface ListPageStub {
	readonly data: { readonly data: readonly object[]; readonly meta: object } | undefined;
	readonly isError: boolean;
	readonly isFetching: boolean;
	readonly isPlaceholderData: boolean;
}

interface ListHookStub {
	readonly useQuery: (input: object, options: { readonly enabled: boolean }) => ListPageStub;
}

interface AuthStub {
	readonly api: {
		readonly admin: {
			readonly roles: { readonly list: ListHookStub; readonly userAssign: MutationHookStub; readonly userRemove: MutationHookStub };
			readonly permissions: { readonly list: ListHookStub; readonly userGrant: MutationHookStub; readonly userRevoke: MutationHookStub; readonly check: MutationHookStub };
		};
	};
}

const { mutateMock, mutationOptions, listCalls } = vi.hoisted(() => {
	const options: MutationOptionsStub[] = [];
	const calls: { resource: string; input: object; enabled: boolean }[] = [];
	return { mutateMock: vi.fn<() => void>(), mutationOptions: options, listCalls: calls };
});

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void; readonly replace: () => void } => ({ push: () => undefined, replace: () => undefined }),
	usePathname: (): string => "/users/user-1",
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/contexts/identity", async (importOriginal) => {
	// The real session helpers (invalidateSessionAuth) with a stubbed useAuth.
	const actual = await importOriginal<typeof IdentityModule>();
	const mutation: MutationHookStub = {
		useMutation: (options: MutationOptionsStub) => {
			mutationOptions.push(options);
			return { mutate: mutateMock, isPending: false };
		},
	};
	/** One page holding every row: `total` = the rows, no next page. */
	function listOf(resource: string, rows: readonly object[]): ListHookStub {
		return {
			useQuery: (input: object, options: { readonly enabled: boolean }): ListPageStub => {
				listCalls.push({ resource, input, enabled: options.enabled });
				return {
					data: options.enabled
						? {
								data: rows,
								meta: {
									correlationId: "corr-1",
									timestamp: 1_792_368_000_000,
									page: 1,
									limit: 20,
									total: rows.length,
									totalPages: 1,
									hasNext: false,
									hasPrevious: false,
									nextCursor: null,
								},
							}
						: undefined,
					isError: false,
					isFetching: false,
					isPlaceholderData: false,
				};
			},
		};
	}
	const auth: AuthStub = {
		api: {
			admin: {
				roles: {
					list: listOf("roles", [{ id: "role-viewer", name: "Viewer", description: null, isActive: true, parentId: null }]),
					userAssign: mutation,
					userRemove: mutation,
				},
				permissions: {
					list: listOf("permissions", [{ id: "perm-geo-read", action: "READ", resource: "GEO", description: "Read geo", group: null, isSystem: true }]),
					userGrant: mutation,
					userRevoke: mutation,
					check: mutation,
				},
			},
		},
	};
	return { ...actual, useAuth: (): AuthStub => auth };
});

const USER = AdminUserDetailSchema.parse({
	id: "user-1",
	email: "jane@example.com",
	fullName: "Jane Doe",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: true,
	twoFactorEnabled: false,
	hasAdminAccess: true,
	tokenVersion: 1,
	roles: [{ id: "role-editor", name: "Editor", description: null }],
	permissions: [{ id: "perm-geo-read", action: "READ", resource: "GEO", description: "Read geo", group: null }],
	failedLoginAttempts: 0,
	lockedUntil: null,
	directPermissionIds: ["perm-geo-read"],
	createdAt: 1_786_300_000_000,
	updatedAt: 1_786_300_000_000,
	isDeleted: false,
	deletedAt: null,
	signupReferrer: null,
	signupReferralStatus: null,
});

function renderPanel(capabilities: readonly CapabilitySlug[], queryClient: QueryClient = new QueryClient()): void {
	render(
		<QueryClientProvider client={queryClient}>
			<CapabilitiesProvider capabilities={capabilities}>
				<UserAccessPanel userId={USER.id} user={USER} />
			</CapabilitiesProvider>
		</QueryClientProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	vi.restoreAllMocks();
	mutationOptions.length = 0;
	listCalls.length = 0;
});

describe("UserAccessPanel authorization", () => {
	it("shows role management and the checker with role.update + permission.update + permission.read", () => {
		renderPanel([PERMISSION.ROLE.UPDATE, PERMISSION.PERMISSION.UPDATE, PERMISSION.PERMISSION.READ]);

		expect(screen.getByRole("button", { name: "Assign role" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Remove" })).toBeDefined();
		expect(screen.getByText("Permission checker")).toBeDefined();
		expect(screen.queryByRole("note")).toBeNull();
	});

	it("treats MANAGE as implying the update actions", () => {
		renderPanel([PERMISSION.ROLE.MANAGE, PERMISSION.PERMISSION.MANAGE]);

		expect(screen.getByRole("button", { name: "Assign role" })).toBeDefined();
		expect(screen.getByText("Permission checker")).toBeDefined();
	});

	it("renders roles read-only with a notice and hides the checker without the permissions", () => {
		renderPanel([]);

		expect(screen.queryByRole("button", { name: "Assign role" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
		expect(screen.getByText("Assigning or removing roles requires the role update permission.")).toBeDefined();
		expect(screen.getByText("Editor")).toBeDefined();
		expect(screen.queryByText("Permission checker")).toBeNull();
	});
});

describe("UserAccessPanel catalog reads", () => {
	it("searches active roles and pages the permission catalog only with the list permissions", () => {
		renderPanel([PERMISSION.ROLE.UPDATE, PERMISSION.ROLE.LIST, PERMISSION.PERMISSION.UPDATE, PERMISSION.PERMISSION.LIST]);

		expect(listCalls.find((call) => call.resource === "roles")).toMatchObject({ input: { page: 1, limit: 20, filter: { isActive: { eq: true } } }, enabled: true });
		expect(listCalls.find((call) => call.resource === "permissions")).toMatchObject({ input: { page: 1, limit: 100 }, enabled: true });
	});

	it("skips both catalog reads without LIST ROLE / LIST PERMISSION, and still shows the direct grants", () => {
		renderPanel([PERMISSION.ROLE.UPDATE]);

		expect(listCalls.every((call) => !call.enabled)).toBe(true);
		expect(screen.getByRole("tab", { name: "Direct Permission Grants (1)" })).toBeDefined();
	});
});

describe("UserAccessPanel mutation failures", () => {
	it("surfaces every failed role, grant and check mutation as an error toast with the API reason", () => {
		const errorToast = vi.spyOn(toastMessage, "error").mockImplementation(() => "toast-id");
		renderPanel([PERMISSION.ROLE.UPDATE, PERMISSION.PERMISSION.UPDATE, PERMISSION.PERMISSION.READ]);
		const failure = new ApiError({ error: "CONFLICT", message: "A user can have at most 5 roles.", statusCode: 409 });

		// The panel registers five mutations: assign, remove, grant, revoke, check.
		const firstRender = mutationOptions.slice(0, 5);
		for (const options of firstRender) {
			options.onError?.(failure);
		}

		expect(firstRender.every((options) => options.onError !== undefined)).toBe(true);
		expect(errorToast.mock.calls.map(([toast]) => toast.title)).toEqual([
			"Could not assign the role",
			"Could not remove the role",
			"Could not grant the permission",
			"Could not revoke the permission",
			"Could not check the permission",
		]);
		expect(errorToast.mock.calls.every(([toast]) => toast.description === "A user can have at most 5 roles.")).toBe(true);
	});
});

describe("UserAccessPanel after a role change", () => {
	const OTHER_USER_ID = "user-2";

	function isInvalidated(queryClient: QueryClient, queryKey: QueryKey): boolean | undefined {
		return queryClient.getQueryState(queryKey)?.isInvalidated;
	}

	it("refetches this user's detail, not other users'", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(apiRouter.auth.adminUserDetail.queryKey({ userId: USER.id }), null);
		queryClient.setQueryData(apiRouter.auth.adminUserDetail.queryKey({ userId: OTHER_USER_ID }), null);
		renderPanel([PERMISSION.ROLE.UPDATE], queryClient);

		// The first registered mutation is the role assignment.
		await mutationOptions.at(0)?.onSuccess?.();

		expect(isInvalidated(queryClient, apiRouter.auth.adminUserDetail.queryKey({ userId: USER.id }))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.auth.adminUserDetail.queryKey({ userId: OTHER_USER_ID }))).toBe(false);
	});
});
