import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import { AuthorizationResourceNotFoundError } from "../../../domain/errors/authorization.errors";
import { RBAC_CATALOG_READ } from "../../ports/authorization.tokens";
import type { RbacCatalogReadPort } from "../../ports/rbac-read.port";
import { GetRoleQuery } from "./get-role.query";

@QueryHandler(GetRoleQuery)
export class GetRoleHandler implements IQueryHandler<GetRoleQuery, RoleResponse> {
	public constructor(@Inject(RBAC_CATALOG_READ) private readonly catalog: RbacCatalogReadPort) {}

	public async execute(query: GetRoleQuery): Promise<RoleResponse> {
		const role: RoleResponse | null = await this.catalog.findRole(query.actor, query.roleId);
		if (role === null) {
			throw new AuthorizationResourceNotFoundError(query.roleId);
		}
		return role;
	}
}
