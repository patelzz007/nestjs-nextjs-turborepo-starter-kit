// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { AdminUserDetailSchema, PERMISSION, PermissionListItemSchema, RoleListItemSchema, type CapabilitySlug } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAccessPanel } from "@/components/access/user-access-panel";

interface MutationStub {
	readonly mutate: () => void;
	readonly isPending: boolean;
}

interface MutationHookStub {
	readonly useMutation: () => MutationStub;
}

interface AuthStub {
	readonly api: {
		readonly admin: {
			readonly roles: { readonly userAssign: MutationHookStub; readonly userRemove: MutationHookStub };
			readonly permissions: { readonly userGrant: MutationHookStub; readonly userRevoke: MutationHookStub; readonly check: MutationHookStub };
		};
	};
}

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn<() => void>() }));

vi.mock("@workspace/client/lib/auth", () => {
	const mutation: MutationHookStub = { useMutation: () => ({ mutate: mutateMock, isPending: false }) };
	const auth: AuthStub = {
		api: {
			admin: {
				roles: { userAssign: mutation, userRemove: mutation },
				permissions: { userGrant: mutation, userRevoke: mutation, check: mutation },
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
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
});

const ROLES = [RoleListItemSchema.parse({ id: "role-viewer", name: "Viewer", description: null, isActive: true, parentId: null })];
const PERMISSIONS = [PermissionListItemSchema.parse({ id: "perm-geo-read", action: "READ", resource: "GEO", description: "Read geo", group: null, isSystem: true })];

function renderPanel(capabilities: readonly CapabilitySlug[]): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={capabilities}>
				<UserAccessPanel userId={USER.id} user={USER} rolesCatalog={ROLES} permissionsCatalog={PERMISSIONS} />
			</CapabilitiesProvider>
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
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
