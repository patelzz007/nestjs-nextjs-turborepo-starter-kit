import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PermissionGroupsResponse } from "@workspace/shared";

import { RBAC_CATALOG_READ } from "../../ports/authorization.tokens";
import type { RbacCatalogReadPort } from "../../ports/rbac-read.port";
import { ListPermissionGroupsQuery } from "./list-permission-groups.query";

@QueryHandler(ListPermissionGroupsQuery)
export class ListPermissionGroupsHandler implements IQueryHandler<ListPermissionGroupsQuery, PermissionGroupsResponse> {
	public constructor(@Inject(RBAC_CATALOG_READ) private readonly catalog: RbacCatalogReadPort) {}

	public async execute(query: ListPermissionGroupsQuery): Promise<PermissionGroupsResponse> {
		return { groups: await this.catalog.listPermissionGroups(query.actor) };
	}
}
