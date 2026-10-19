import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantRedemptionListItem, type PaginatedServiceResult } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { MERCHANT_ACCESS } from "../../../../organizations/public-api";
import { actingInOrganization } from "../../acting-member";
import type { RedemptionReadPort } from "../../ports/pos-read.port";
import { REDEMPTION_READS } from "../../ports/pos.tokens";
import { ListOrganizationRedemptionsQuery } from "./list-organization-redemptions.query";

/** The organization's redemption history within the caller's stores (a store-scoped key sees only its store). */
@QueryHandler(ListOrganizationRedemptionsQuery)
export class ListOrganizationRedemptionsHandler implements IQueryHandler<ListOrganizationRedemptionsQuery, PaginatedServiceResult<MerchantRedemptionListItem>> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(REDEMPTION_READS) private readonly reads: RedemptionReadPort,
	) {}

	public async execute(query: ListOrganizationRedemptionsQuery): Promise<PaginatedServiceResult<MerchantRedemptionListItem>> {
		const { actor, input } = query;
		const grant = await this.merchantAccess.assertCapability(actor, {
			organizationId: input.organizationId,
			capability: MERCHANT_CAPABILITY.viewRedemptions,
			locationId: input.locationId ?? null,
		});
		const tenant = actingInOrganization(actor, input.organizationId);
		return this.reads.list(tenant, grant, input);
	}
}
