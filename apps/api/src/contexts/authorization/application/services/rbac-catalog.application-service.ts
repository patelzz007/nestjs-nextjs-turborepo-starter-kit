import { Inject, Injectable } from "@nestjs/common";
import type {
	AdminPermissionResponse,
	PaginatedServiceResult,
	PermissionGroupsResponse,
	PermissionListItem,
	PermissionListQuery,
	RoleListItem,
	RoleListQuery,
	RoleResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthorizationResourceNotFoundError } from "../../domain/errors/authorization.errors";
import { RBAC_CATALOG_READ } from "../ports/authorization.tokens";
import type { RbacCatalogReadPort } from "../ports/rbac-read.port";

/** The admin reads of the RBAC catalog, roles and permissions (ADR 096). An unknown id is a 404. */
@Injectable()
export class RbacCatalogApplicationService {
	public constructor(@Inject(RBAC_CATALOG_READ) private readonly catalog: RbacCatalogReadPort) {}

	/** One page of the live roles (admin list and role pickers). */
	public listRoles(actor: ActorContext, query: RoleListQuery): Promise<PaginatedServiceResult<RoleListItem>> {
		return this.catalog.listRoles(actor, query);
	}

	public async getRole(actor: ActorContext, roleId: string): Promise<RoleResponse> {
		const role: RoleResponse | null = await this.catalog.findRole(actor, roleId);
		if (role === null) {
			throw new AuthorizationResourceNotFoundError(roleId);
		}
		return role;
	}

	/** One page of the live permissions. */
	public listPermissions(actor: ActorContext, query: PermissionListQuery): Promise<PaginatedServiceResult<PermissionListItem>> {
		return this.catalog.listPermissions(actor, query);
	}

	public async getPermission(actor: ActorContext, permissionId: string): Promise<AdminPermissionResponse> {
		const permission: AdminPermissionResponse | null = await this.catalog.findPermission(actor, permissionId);
		if (permission === null) {
			throw new AuthorizationResourceNotFoundError(permissionId);
		}
		return permission;
	}

	/** Every permission, grouped by resource (the role editor's matrix). */
	public async listPermissionGroups(actor: ActorContext): Promise<PermissionGroupsResponse> {
		return { groups: await this.catalog.listPermissionGroups(actor) };
	}
}
