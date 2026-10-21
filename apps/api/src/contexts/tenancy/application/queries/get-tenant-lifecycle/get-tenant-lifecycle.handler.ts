import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { TenantLifecycleReadPort } from "../../ports/tenant-lifecycle-read.port";
import { TENANT_LIFECYCLE_READ } from "../../ports/tenants.tokens";
import { readLifecycleOrNotFound } from "../../tenant-lifecycle-view";
import { notFound, requireUserActor } from "../../tenant-actor";
import { GetTenantLifecycleQuery } from "./get-tenant-lifecycle.query";

/** The tenant status read of the lifecycle routes: any ACTIVE member; anyone else gets the uniform 404. */
@QueryHandler(GetTenantLifecycleQuery)
export class GetTenantLifecycleHandler implements IQueryHandler<GetTenantLifecycleQuery, TenantLifecycleResponse> {
	public constructor(@Inject(TENANT_LIFECYCLE_READ) private readonly reads: TenantLifecycleReadPort) {}

	public async execute(query: GetTenantLifecycleQuery): Promise<TenantLifecycleResponse> {
		const user = requireUserActor(query.actor);
		const tenantId = await this.reads.findMemberTenantId(query.input.tenantSlug, user.userId);
		if (tenantId === null) {
			throw notFound();
		}
		return readLifecycleOrNotFound(this.reads, tenantId);
	}
}
