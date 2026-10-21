import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type PaginatedServiceResult, type TenantCustomerBanResponse } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { CustomerBanReadPort } from "../../ports/customer-ban-read.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { CUSTOMER_BAN_READ, MERCHANT_ACCESS, TENANT_DIRECTORY } from "../../ports/tenants.tokens";
import { requireUserActor } from "../../tenant-actor";
import { ListCustomerBansQuery } from "./list-customer-bans.query";

@QueryHandler(ListCustomerBansQuery)
export class ListCustomerBansHandler implements IQueryHandler<ListCustomerBansQuery, PaginatedServiceResult<TenantCustomerBanResponse>> {
	public constructor(
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CUSTOMER_BAN_READ) private readonly reads: CustomerBanReadPort,
	) {}

	public async execute(query: ListCustomerBansQuery): Promise<PaginatedServiceResult<TenantCustomerBanResponse>> {
		const user = requireUserActor(query.actor);
		const member = await this.directory.resolveMember(user, query.input.tenantSlug);
		await this.merchantAccess.assertCapability(user, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageRewards });
		return this.reads.listActive(member.tenantId, query.input.query);
	}
}
