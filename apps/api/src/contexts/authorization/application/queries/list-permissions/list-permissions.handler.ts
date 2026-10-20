import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, PermissionListItem } from "@workspace/shared";

import { RBAC_CATALOG_READ } from "../../ports/authorization.tokens";
import type { RbacCatalogReadPort } from "../../ports/rbac-read.port";
import { ListPermissionsQuery } from "./list-permissions.query";

@QueryHandler(ListPermissionsQuery)
export class ListPermissionsHandler implements IQueryHandler<ListPermissionsQuery, PaginatedServiceResult<PermissionListItem>> {
	public constructor(@Inject(RBAC_CATALOG_READ) private readonly catalog: RbacCatalogReadPort) {}

	public execute(query: ListPermissionsQuery): Promise<PaginatedServiceResult<PermissionListItem>> {
		return this.catalog.listPermissions(query.actor, query.query);
	}
}
