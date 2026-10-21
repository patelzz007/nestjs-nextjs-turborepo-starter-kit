import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { TenantLifecycleReadPort } from "../../ports/tenant-lifecycle-read.port";
import { TENANT_LIFECYCLE_READ } from "../../ports/tenants.tokens";
import { readLifecycleOrNotFound } from "../../tenant-lifecycle-view";
import { GetTenantLifecycleForAdminQuery } from "./get-tenant-lifecycle-for-admin.query";

/** Authorization: the route's `LIST MERCHANT_ORG` permission. */
@QueryHandler(GetTenantLifecycleForAdminQuery)
export class GetTenantLifecycleForAdminHandler implements IQueryHandler<GetTenantLifecycleForAdminQuery, TenantLifecycleResponse> {
	public constructor(@Inject(TENANT_LIFECYCLE_READ) private readonly reads: TenantLifecycleReadPort) {}

	public execute(query: GetTenantLifecycleForAdminQuery): Promise<TenantLifecycleResponse> {
		return readLifecycleOrNotFound(this.reads, query.input.tenantId);
	}
}
