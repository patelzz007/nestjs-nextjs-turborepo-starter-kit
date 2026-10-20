import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantRedemptionListItem, type PaginatedServiceResult } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import { actingInTenant } from "../../acting-member";
import type { RedemptionReadPort } from "../../ports/pos-read.port";
import { REDEMPTION_READS } from "../../ports/pos.tokens";
import { ListTenantRedemptionsQuery } from "./list-tenant-redemptions.query";

/** The tenant's redemption history within the caller's stores (a store-scoped key sees only its store). */
@QueryHandler(ListTenantRedemptionsQuery)
export class ListTenantRedemptionsHandler implements IQueryHandler<ListTenantRedemptionsQuery, PaginatedServiceResult<MerchantRedemptionListItem>> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(REDEMPTION_READS) private readonly reads: RedemptionReadPort,
	) {}

	public async execute(query: ListTenantRedemptionsQuery): Promise<PaginatedServiceResult<MerchantRedemptionListItem>> {
		const { actor, input } = query;
		const grant = await this.merchantAccess.assertCapability(actor, {
			tenantId: input.tenantId,
			capability: MERCHANT_CAPABILITY.viewRedemptions,
			locationId: input.locationId ?? null,
		});
		const tenant = actingInTenant(actor, input.tenantId);
		return this.reads.list(tenant, grant, input);
	}
}
