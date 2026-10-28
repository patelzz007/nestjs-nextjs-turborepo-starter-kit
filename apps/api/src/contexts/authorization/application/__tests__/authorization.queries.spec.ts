import { beforeEach, describe, expect, it } from "vitest";
import type {
	AdminPermissionResponse,
	AuthorizationDecision,
	AuthorizationRequest,
	AuthorizationResult,
	PaginatedServiceResult,
	PermissionListItem,
	PermissionListQuery,
	RoleListItem,
	RoleListQuery,
	RoleResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AccessDeniedError, AuthorizationResourceNotFoundError, SeparationOfDutyViolationError } from "../../domain/errors/authorization.errors";
import { permissionKeyOf } from "../../domain/rbac-catalog";
import type { AuthorizationKernelPort } from "../ports/authorization-kernel.port";
import type {
	DirectOverrideKeys,
	EffectiveRoleSet,
	RbacCatalogReadPort,
	RbacInspectionReader,
	RbacInspectionReadPort,
	RequestTenantPort,
	VerifiedRequestTenant,
} from "../ports/rbac-read.port";
import { DecideAuthorizationHandler } from "../queries/decide-authorization/decide-authorization.handler";
import { DecideAuthorizationQuery } from "../queries/decide-authorization/decide-authorization.query";
import { ExplainAuthorizationHandler } from "../queries/explain-authorization/explain-authorization.handler";
import { ExplainAuthorizationQuery } from "../queries/explain-authorization/explain-authorization.query";
import { GetPermissionHandler } from "../queries/get-permission/get-permission.handler";
import { GetPermissionQuery } from "../queries/get-permission/get-permission.query";
import { GetRoleHandler } from "../queries/get-role/get-role.handler";
import { GetRoleQuery } from "../queries/get-role/get-role.query";
import { ListRolesHandler } from "../queries/list-roles/list-roles.handler";
import { ListPermissionsHandler } from "../queries/list-permissions/list-permissions.handler";
import { ListPermissionsQuery } from "../queries/list-permissions/list-permissions.query";
import { ListRolesQuery } from "../queries/list-roles/list-roles.query";
import { effectivePermissionKeys, PreviewRoleAssignmentHandler } from "../queries/preview-role-assignment/preview-role-assignment.handler";
import { PreviewRoleAssignmentQuery } from "../queries/preview-role-assignment/preview-role-assignment.query";
import { ValidateRoleAssignmentHandler } from "../queries/validate-role-assignment/validate-role-assignment.handler";
import { ValidateRoleAssignmentQuery } from "../queries/validate-role-assignment/validate-role-assignment.query";
import { InMemoryRbacStore, adminActor, anonymousActor } from "./fakes/authorization.fakes";

/** A kernel that allows exactly the listed `action:resource` keys and records what it was asked. */
class ScriptedKernel implements AuthorizationKernelPort {
	public readonly asked: AuthorizationRequest[] = [];

	public constructor(private readonly allowed: ReadonlySet<string>) {}

	public can(request: AuthorizationRequest): Promise<AuthorizationDecision> {
		this.asked.push(request);
		return Promise.resolve(this.allowed.has(`${request.action}:${request.resource}`) ? "ALLOW" : "DENY");
	}

	public authorize(): Promise<void> {
		return Promise.resolve();
	}

	public explain(request: AuthorizationRequest): Promise<AuthorizationResult> {
		this.asked.push(request);
		return Promise.resolve({ decision: "DENY", request: { ...request, subject: request.subject }, evaluation: [] });
	}
}

/** The dry-run reads over the in-memory RBAC rows. */
class StoreInspection implements RbacInspectionReadPort, RbacInspectionReader {
	public constructor(private readonly store: InMemoryRbacStore) {}

	public inspect<TResult>(_actor: ActorContext, _reason: string, work: (reader: RbacInspectionReader) => Promise<TResult>): Promise<TResult> {
		return work(this);
	}

	public assignedRoleIds(userId: string): Promise<string[]> {
		return Promise.resolve([...(this.store.users.get(userId)?.roleIds ?? [])]);
	}

	public activeRoleNames(roleIds: readonly string[]): Promise<ReadonlySet<string>> {
		return Promise.resolve(new Set(roleIds.flatMap((id: string): string[] => this.liveName(id))));
	}

	public effectiveRoleSet(roleIds: readonly string[]): Promise<EffectiveRoleSet> {
		const permissionKeys: string[] = roleIds.flatMap((id: string): string[] =>
			this.liveName(id).length === 0
				? []
				: (this.store.rolePermissions.get(id) ?? []).flatMap((permissionId: string): string[] => {
						const permission = this.store.permissions.get(permissionId);
						return permission === undefined ? [] : [permissionKeyOf(permission)];
					}),
		);
		return Promise.resolve({ roleNames: roleIds.flatMap((id: string): string[] => this.liveName(id)), permissionKeys: [...new Set(permissionKeys)] });
	}

	public directOverrideKeys(userId: string): Promise<DirectOverrideKeys> {
		const overrides = this.store.users.get(userId)?.overrides ?? [];
		const keysOf = (effect: "ALLOW" | "DENY"): string[] =>
			overrides
				.filter((override): boolean => override.effect === effect)
				.flatMap((override): string[] => {
					const permission = this.store.permissions.get(override.permissionId);
					return permission === undefined ? [] : [permissionKeyOf(permission)];
				});
		return Promise.resolve({ allow: keysOf("ALLOW"), deny: keysOf("DENY") });
	}

	private liveName(roleId: string): string[] {
		const role = this.store.roles.get(roleId);
		return role === undefined || role.isDeleted || !role.isActive ? [] : [role.name];
	}
}

/** An empty page of any list. */
function emptyPage<Item>(query: { readonly limit: number }): PaginatedServiceResult<Item> {
	return { items: [], limit: query.limit, total: 0, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };
}

class EmptyCatalog implements RbacCatalogReadPort {
	public readonly listQueries: object[] = [];

	public listPermissions(_actor: ActorContext, query: PermissionListQuery): Promise<PaginatedServiceResult<PermissionListItem>> {
		this.listQueries.push(query);
		return Promise.resolve(emptyPage(query));
	}

	public findPermission(): Promise<AdminPermissionResponse | null> {
		return Promise.resolve(null);
	}

	public listPermissionGroups(): Promise<string[]> {
		return Promise.resolve([]);
	}

	public listRoles(_actor: ActorContext, query: RoleListQuery): Promise<PaginatedServiceResult<RoleListItem>> {
		this.listQueries.push(query);
		return Promise.resolve(emptyPage(query));
	}

	public findRole(): Promise<RoleResponse | null> {
		return Promise.resolve(null);
	}
}

const TENANT: RequestTenantPort = { current: (): VerifiedRequestTenant => ({ tenantId: "org-1" }) };
let rbac: InMemoryRbacStore;

beforeEach(() => {
	rbac = new InMemoryRbacStore();
	rbac.seedPermission({ id: "p-read", action: "READ", resource: "USER" });
	rbac.seedPermission({ id: "p-update", action: "UPDATE", resource: "USER" });
	rbac.seedPermission({ id: "p-delete", action: "DELETE", resource: "USER" });
	rbac.seedRole({ id: "role-viewer", name: "Viewer" }, ["p-read"]);
	rbac.seedRole({ id: "role-editor", name: "Editor" }, ["p-read", "p-update"]);
	rbac.seedRole({ id: "role-manager", name: "Location Manager" });
	rbac.seedRole({ id: "role-staff", name: "Location Staff" });
	rbac.seedUser("user-1", ["role-viewer", "role-manager"], [{ id: "ov-1", permissionId: "p-delete", effect: "DENY", expiresAt: null }]);
});

describe("DecideAuthorizationHandler", () => {
	it("answers each check for the caller in the request's verified tenant", async () => {
		const kernel = new ScriptedKernel(new Set(["READ:USER"]));

		const response = await new DecideAuthorizationHandler(kernel, TENANT).execute(
			new DecideAuthorizationQuery(adminActor("user-1"), [
				{ action: "READ", resource: "USER" },
				{ action: "DELETE", resource: "USER", resourceId: "user-9" },
			]),
		);

		expect(response.results).toEqual([
			{ action: "READ", resource: "USER", allowed: true },
			{ action: "DELETE", resource: "USER", resourceId: "user-9", allowed: false },
		]);
		expect(kernel.asked.map((request) => request.subject)).toEqual([
			{ userId: "user-1", isSuperAdmin: false, tenantId: "org-1" },
			{ userId: "user-1", isSuperAdmin: false, tenantId: "org-1" },
		]);
	});

	it("refuses an actor who is not a signed-in user", async () => {
		await expect(
			new DecideAuthorizationHandler(new ScriptedKernel(new Set()), TENANT).execute(new DecideAuthorizationQuery(anonymousActor(), [{ action: "READ", resource: "USER" }])),
		).rejects.toBeInstanceOf(AccessDeniedError);
	});
});

describe("ExplainAuthorizationHandler", () => {
	it("never lends the caller's SuperAdmin bypass to another user it explains", async () => {
		const kernel = new ScriptedKernel(new Set());
		const handler = new ExplainAuthorizationHandler(kernel);
		const root = adminActor("root-1", { isSuperAdmin: true });

		await handler.execute(new ExplainAuthorizationQuery(root, { action: "READ", resource: "USER" }));
		await handler.execute(new ExplainAuthorizationQuery(root, { action: "READ", resource: "USER", userId: "user-1", tenantId: "org-1" }));

		expect(kernel.asked.map((request) => request.subject)).toEqual([
			{ userId: "root-1", isSuperAdmin: true },
			{ userId: "user-1", isSuperAdmin: false, tenantId: "org-1" },
		]);
	});
});

describe("Role assignment dry runs", () => {
	it("previews gained and lost permissions with inheritance, keeping DENY subtracted", async () => {
		const preview = await new PreviewRoleAssignmentHandler(new StoreInspection(rbac)).execute(
			new PreviewRoleAssignmentQuery(adminActor("admin-1"), { userId: "user-1", roleIds: ["role-editor"] }),
		);

		expect(preview).toEqual({
			currentRoles: ["Viewer", "Location Manager"],
			newRoles: ["Editor"],
			roleAdded: ["Editor"],
			roleRemoved: ["Viewer", "Location Manager"],
			permissionsGained: ["UPDATE:USER"],
			permissionsLost: [],
		});
	});

	it("computes effective keys as roles plus ALLOW overrides minus DENY overrides", () => {
		expect([...effectivePermissionKeys({ roleNames: [], permissionKeys: ["READ:USER", "DELETE:USER"] }, { allow: ["UPDATE:USER"], deny: ["DELETE:USER"] })]).toEqual([
			"READ:USER",
			"UPDATE:USER",
		]);
	});

	it("validates a proposal against separation of duties, including the user's current roles", async () => {
		const handler = new ValidateRoleAssignmentHandler(new StoreInspection(rbac));

		await expect(handler.execute(new ValidateRoleAssignmentQuery(adminActor("admin-1"), { userId: "user-1", roleIds: ["role-editor"] }))).resolves.toEqual({
			valid: true,
			message: "No conflicts detected",
		});
		await expect(handler.execute(new ValidateRoleAssignmentQuery(adminActor("admin-1"), { userId: "user-1", roleIds: ["role-staff"] }))).rejects.toBeInstanceOf(
			SeparationOfDutyViolationError,
		);
	});
});

describe("Catalog reads", () => {
	it("answers not found for an unknown role or permission, and pages through the catalogs with the requested list query", async () => {
		const catalog = new EmptyCatalog();
		const actor = adminActor("admin-1");

		await expect(new GetRoleHandler(catalog).execute(new GetRoleQuery(actor, "ghost"))).rejects.toBeInstanceOf(AuthorizationResourceNotFoundError);
		await expect(new GetPermissionHandler(catalog).execute(new GetPermissionQuery(actor, "ghost"))).rejects.toBeInstanceOf(AuthorizationResourceNotFoundError);
		const roleQuery: RoleListQuery = { page: 1, limit: 20, search: "edit" };
		const permissionQuery: PermissionListQuery = { page: 2, limit: 100 };
		await expect(new ListRolesHandler(catalog).execute(new ListRolesQuery(actor, roleQuery))).resolves.toMatchObject({ items: [], total: 0 });
		await expect(new ListPermissionsHandler(catalog).execute(new ListPermissionsQuery(actor, permissionQuery))).resolves.toMatchObject({ items: [], total: 0 });
		expect(catalog.listQueries).toEqual([roleQuery, permissionQuery]);
	});
});
