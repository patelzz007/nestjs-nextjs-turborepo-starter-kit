import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { TenantContextResponse } from "@workspace/shared";

import { requireUserActor } from "../../tenant-actor";
import type { TenantContextReadPort } from "../../ports/tenant-context-read.port";
import { TENANT_CONTEXT_READ } from "../../ports/tenants.tokens";
import { GetTenantContextQuery } from "./get-tenant-context.query";

/** Membership is the authorization: a non-member gets the same 404 as a missing tenant. */
@QueryHandler(GetTenantContextQuery)
export class GetTenantContextHandler implements IQueryHandler<GetTenantContextQuery, TenantContextResponse> {
	public constructor(@Inject(TENANT_CONTEXT_READ) private readonly reads: TenantContextReadPort) {}

	public async execute(query: GetTenantContextQuery): Promise<TenantContextResponse> {
		return this.reads.getContext(requireUserActor(query.actor), query.input.tenantSlug);
	}
}
