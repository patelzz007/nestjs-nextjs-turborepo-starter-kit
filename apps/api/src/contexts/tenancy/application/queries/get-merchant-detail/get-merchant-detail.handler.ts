import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AdminMerchantDetailResponse } from "@workspace/shared";

import { merchantNotFound } from "../../kyb-errors";
import type { MerchantAdminReadPort } from "../../ports/merchant-admin-read.port";
import { MERCHANT_ADMIN_READ } from "../../ports/tenants.tokens";
import { GetMerchantDetailQuery } from "./get-merchant-detail.query";

/** Authorization: the route's `LIST MERCHANT_ORG` permission. */
@QueryHandler(GetMerchantDetailQuery)
export class GetMerchantDetailHandler implements IQueryHandler<GetMerchantDetailQuery, AdminMerchantDetailResponse> {
	public constructor(@Inject(MERCHANT_ADMIN_READ) private readonly reads: MerchantAdminReadPort) {}

	public async execute(query: GetMerchantDetailQuery): Promise<AdminMerchantDetailResponse> {
		const detail = await this.reads.getMerchantDetail(query.actor, query.input.tenantId);
		if (detail === null) {
			throw merchantNotFound();
		}
		return detail;
	}
}
