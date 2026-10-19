import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RoleListItem } from "@workspace/shared";

import { RBAC_CATALOG_READ } from "../../ports/authorization.tokens";
import type { RbacCatalogReadPort } from "../../ports/rbac-read.port";
import { ListRolesQuery } from "./list-roles.query";

@QueryHandler(ListRolesQuery)
export class ListRolesHandler implements IQueryHandler<ListRolesQuery, PaginatedServiceResult<RoleListItem>> {
	public constructor(@Inject(RBAC_CATALOG_READ) private readonly catalog: RbacCatalogReadPort) {}

	public execute(query: ListRolesQuery): Promise<PaginatedServiceResult<RoleListItem>> {
		return this.catalog.listRoles(query.actor, query.query);
	}
}
