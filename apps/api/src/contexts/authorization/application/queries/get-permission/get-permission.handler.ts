import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AdminPermissionResponse } from "@workspace/shared";

import { AuthorizationResourceNotFoundError } from "../../../domain/errors/authorization.errors";
import { RBAC_CATALOG_READ } from "../../ports/authorization.tokens";
import type { RbacCatalogReadPort } from "../../ports/rbac-read.port";
import { GetPermissionQuery } from "./get-permission.query";

@QueryHandler(GetPermissionQuery)
export class GetPermissionHandler implements IQueryHandler<GetPermissionQuery, AdminPermissionResponse> {
	public constructor(@Inject(RBAC_CATALOG_READ) private readonly catalog: RbacCatalogReadPort) {}

	public async execute(query: GetPermissionQuery): Promise<AdminPermissionResponse> {
		const permission: AdminPermissionResponse | null = await this.catalog.findPermission(query.actor, query.permissionId);
		if (permission === null) {
			throw new AuthorizationResourceNotFoundError(query.permissionId);
		}
		return permission;
	}
}
