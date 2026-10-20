import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantApiKeySummary, type PaginatedServiceResult } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import { actingInTenant } from "../../acting-member";
import type { ApiKeyReadPort } from "../../ports/pos-read.port";
import { API_KEY_READS } from "../../ports/pos.tokens";
import { ListApiKeysQuery } from "./list-api-keys.query";

/** The tenant's live keys within the member's stores; a store-limited member never sees tenant-wide keys. */
@QueryHandler(ListApiKeysQuery)
export class ListApiKeysHandler implements IQueryHandler<ListApiKeysQuery, PaginatedServiceResult<MerchantApiKeySummary>> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(API_KEY_READS) private readonly reads: ApiKeyReadPort,
	) {}

	public async execute(query: ListApiKeysQuery): Promise<PaginatedServiceResult<MerchantApiKeySummary>> {
		const { actor, input } = query;
		const grant = await this.merchantAccess.assertCapability(actor, {
			tenantId: input.tenantId,
			capability: MERCHANT_CAPABILITY.manageApiKeys,
			locationId: input.locationId ?? null,
		});
		const tenant = actingInTenant(actor, input.tenantId);
		return this.reads.list(tenant, grant, input);
	}
}
