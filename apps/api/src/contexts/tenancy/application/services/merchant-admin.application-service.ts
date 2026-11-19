import { Inject, Injectable } from "@nestjs/common";
import type {
	AdminLocationRequestListQuery,
	AdminLocationRequestResponse,
	AdminMerchantDetailResponse,
	AdminMerchantListQuery,
	MerchantTenantResponse,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { merchantNotFound } from "../kyb-errors";
import type { MerchantAdminReadPort } from "../ports/merchant-admin-read.port";
import { MERCHANT_ADMIN_READ } from "../ports/tenants.tokens";

/** The platform's reads of merchants and their location requests (ADR 096). An unknown merchant is a 404. */
@Injectable()
export class MerchantAdminApplicationService {
	public constructor(@Inject(MERCHANT_ADMIN_READ) private readonly reads: MerchantAdminReadPort) {}

	public listMerchants(actor: ActorContext, input: AdminMerchantListQuery): Promise<PaginatedServiceResult<MerchantTenantResponse>> {
		return this.reads.listMerchants(actor, input);
	}

	public async getMerchantDetail(actor: ActorContext, input: { readonly tenantId: string }): Promise<AdminMerchantDetailResponse> {
		const detail = await this.reads.getMerchantDetail(actor, input.tenantId);
		if (detail === null) {
			throw merchantNotFound();
		}
		return detail;
	}

	public listLocationRequests(actor: ActorContext, input: AdminLocationRequestListQuery): Promise<PaginatedServiceResult<AdminLocationRequestResponse>> {
		return this.reads.listLocationRequests(actor, input);
	}
}
