import {
	epochMs,
	type AdminPermissionResponse,
	type AuditLogEntry,
	type AuditLogQueryInput,
	type CapabilityDefinition,
	type CapabilitySlug,
	type CapabilityScope,
	type CheckPermissionResponse,
	type PaginatedServiceResult,
	type PermissionAction,
	type PermissionListItem,
	type PermissionListQuery,
	type PermissionResource,
	type RoleListItem,
	type RoleListQuery,
	type RoleResponse,
	type SupportAccessGrantDetail,
	type SupportAccessGrantListQuery,
	type UserPermissions,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { NotFoundError } from "../../../../platform/application/errors/app-error";
import { AccessDeniedError } from "../../domain/errors/authorization.errors";
import type { CapabilityCatalogReadPort, PermissionAuditLogReadPort, RbacCatalogReadPort } from "../ports/rbac-read.port";
import type { SubjectAuthorizationReadPort } from "../ports/subject-authorization-read.port";
import type { SupportAccessReadPort } from "../ports/support-access-read.port";
import { CapabilityCatalogApplicationService } from "../services/capability-catalog.application-service";
import { PermissionAuditLogApplicationService } from "../services/permission-audit-log.application-service";
import { PermissionCheckApplicationService } from "../services/permission-check.application-service";
import { RbacCatalogApplicationService } from "../services/rbac-catalog.application-service";
import { SupportAccessApplicationService } from "../services/support-access.application-service";
import { adminActor, anonymousActor } from "./fakes/authorization.fakes";

const CREATED_AT = epochMs(1_790_000_000_000);
const ADMIN: ActorContext = adminActor("admin-1");

const LIVE = { createdAt: CREATED_AT, updatedAt: CREATED_AT, isDeleted: false, deletedAt: null };
const ROLE: RoleResponse = { ...LIVE, id: "role-editor", name: "Editor", description: null, isActive: true };
const PERMISSION: AdminPermissionResponse = { ...LIVE, id: "p-read", action: "READ", resource: "USER", description: null, group: null, isSystem: true, scope: "GLOBAL" };

function emptyPage<TItem>(): PaginatedServiceResult<TItem> {
	return { items: [], total: 0, page: 1, limit: 20, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };
}

/** TEST-ONLY catalog holding one role and one permission. */
class OneOfEachCatalog implements RbacCatalogReadPort {
	public readonly groupsAskedBy: ActorContext[] = [];

	public listPermissions(_actor: ActorContext, _query: PermissionListQuery): Promise<PaginatedServiceResult<PermissionListItem>> {
		return Promise.resolve(emptyPage());
	}

	public findPermission(_actor: ActorContext, permissionId: string): Promise<AdminPermissionResponse | null> {
		return Promise.resolve(permissionId === PERMISSION.id ? PERMISSION : null);
	}

	public listPermissionGroups(actor: ActorContext): Promise<string[]> {
		this.groupsAskedBy.push(actor);
		return Promise.resolve(["Users", "Rewards"]);
	}

	public listRoles(_actor: ActorContext, _query: RoleListQuery): Promise<PaginatedServiceResult<RoleListItem>> {
		return Promise.resolve(emptyPage());
	}

	public findRole(_actor: ActorContext, roleId: string): Promise<RoleResponse | null> {
		return Promise.resolve(roleId === ROLE.id ? ROLE : null);
	}
}

describe("RbacCatalogApplicationService", () => {
	it("answers a live role and a live permission as the catalog holds them", async () => {
		const service = new RbacCatalogApplicationService(new OneOfEachCatalog());

		await expect(service.getRole(ADMIN, ROLE.id)).resolves.toBe(ROLE);
		await expect(service.getPermission(ADMIN, PERMISSION.id)).resolves.toBe(PERMISSION);
	});

	it("wraps the permission groups the caller may see", async () => {
		const catalog = new OneOfEachCatalog();

		await expect(new RbacCatalogApplicationService(catalog).listPermissionGroups(ADMIN)).resolves.toEqual({ groups: ["Users", "Rewards"] });
		expect(catalog.groupsAskedBy).toEqual([ADMIN]);
	});
});

/** TEST-ONLY support-access reads: the owner of `owned-tenant` sees no grants yet; any other tenant answers `null`. */
class ScriptedSupportAccessReads implements SupportAccessReadPort {
	public readonly asked: { readonly routeKey: string; readonly userId: string }[] = [];
	public readonly adminQueries: SupportAccessGrantListQuery[] = [];

	public listForAdmin(_actor: ActorContext, query: SupportAccessGrantListQuery): Promise<PaginatedServiceResult<SupportAccessGrantDetail>> {
		this.adminQueries.push(query);
		return Promise.resolve(emptyPage());
	}

	public listForTenantOwner(_actor: ActorContext, routeKey: string, userId: string): Promise<readonly SupportAccessGrantDetail[] | null> {
		this.asked.push({ routeKey, userId });
		return Promise.resolve(routeKey === "owned-tenant" ? [] : null);
	}
}

describe("SupportAccessApplicationService", () => {
	it("lists every grant for the platform with the validated list query", async () => {
		const reads = new ScriptedSupportAccessReads();
		const query: SupportAccessGrantListQuery = { page: 1, limit: 20 };

		await expect(new SupportAccessApplicationService(reads).listGrants(ADMIN, query)).resolves.toMatchObject({ items: [], total: 0 });
		expect(reads.adminQueries).toEqual([query]);
	});

	it("shows a tenant's grants to its active owner, checked against the caller's own id", async () => {
		const reads = new ScriptedSupportAccessReads();

		await expect(new SupportAccessApplicationService(reads).listTenantGrants(ADMIN, { tenantSlug: "owned-tenant" })).resolves.toEqual([]);
		expect(reads.asked).toEqual([{ routeKey: "owned-tenant", userId: "admin-1" }]);
	});

	it("answers the uniform 404 to anyone who is not an active owner", async () => {
		const service = new SupportAccessApplicationService(new ScriptedSupportAccessReads());

		await expect(service.listTenantGrants(ADMIN, { tenantSlug: "someone-elses" })).rejects.toBeInstanceOf(NotFoundError);
	});

	it("refuses a caller who is not a signed-in user before reading anything", async () => {
		const reads = new ScriptedSupportAccessReads();

		await expect(new SupportAccessApplicationService(reads).listTenantGrants(anonymousActor(), { tenantSlug: "owned-tenant" })).rejects.toBeInstanceOf(AccessDeniedError);
		expect(reads.asked).toEqual([]);
	});
});

/** TEST-ONLY subject reads: only the permission inspector's method answers. */
class InspectorSubjects implements SubjectAuthorizationReadPort {
	public readonly checked: { readonly userId: string; readonly action: PermissionAction; readonly resource: PermissionResource }[] = [];

	public getUserCapabilitySlugs(): Promise<readonly CapabilitySlug[]> {
		return Promise.resolve([]);
	}

	public getUserDirectPermissionIds(): Promise<readonly string[]> {
		return Promise.resolve([]);
	}

	public getUserPermissionDetails(): Promise<UserPermissions> {
		return Promise.resolve({ roles: [], permissions: [] });
	}

	public checkPermissionWithGrants(userId: string, action: PermissionAction, resource: PermissionResource): Promise<CheckPermissionResponse> {
		this.checked.push({ userId, action, resource });
		return Promise.resolve({ allowed: true, grants: [] });
	}
}

describe("PermissionCheckApplicationService", () => {
	it("asks whether the inspected user holds the permission, and with which grants", async () => {
		const subjects = new InspectorSubjects();

		await expect(new PermissionCheckApplicationService(subjects).check({ userId: "user-1", action: "READ", resource: "USER" })).resolves.toEqual({
			allowed: true,
			grants: [],
		});
		expect(subjects.checked).toEqual([{ userId: "user-1", action: "READ", resource: "USER" }]);
	});
});

class ScopedCatalog implements CapabilityCatalogReadPort {
	public readonly scopes: (CapabilityScope | undefined)[] = [];

	public listCatalog(scope: CapabilityScope | undefined): Promise<CapabilityDefinition[]> {
		this.scopes.push(scope);
		return Promise.resolve([]);
	}

	public invalidate(): void {
		// The service never drops the cache: only the boot sync does.
	}
}

describe("CapabilityCatalogApplicationService", () => {
	it("reads the catalog for the requested scope, or all of it", async () => {
		const catalog = new ScopedCatalog();
		const service = new CapabilityCatalogApplicationService(catalog);

		await expect(service.getCatalog("PLATFORM")).resolves.toEqual([]);
		await expect(service.getCatalog(undefined)).resolves.toEqual([]);
		expect(catalog.scopes).toEqual(["PLATFORM", undefined]);
	});
});

class RecordingAuditLog implements PermissionAuditLogReadPort {
	public readonly asked: { readonly actor: ActorContext; readonly query: AuditLogQueryInput }[] = [];

	public list(actor: ActorContext, query: AuditLogQueryInput): Promise<PaginatedServiceResult<AuditLogEntry>> {
		this.asked.push({ actor, query });
		return Promise.resolve(emptyPage());
	}
}

describe("PermissionAuditLogApplicationService", () => {
	it("pages through the RBAC change history as the caller", async () => {
		const auditLog = new RecordingAuditLog();
		const query: AuditLogQueryInput = { page: 1, limit: 20 };

		await expect(new PermissionAuditLogApplicationService(auditLog).list(ADMIN, query)).resolves.toMatchObject({ items: [], total: 0 });
		expect(auditLog.asked).toEqual([{ actor: ADMIN, query }]);
	});
});
