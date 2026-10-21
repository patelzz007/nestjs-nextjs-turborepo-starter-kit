import type {
	AdminLocationRequestListQuery,
	AdminLocationRequestResponse,
	AdminMerchantDetailResponse,
	AdminMerchantListQuery,
	MerchantTenantResponse,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** Platform-admin merchant reads (the route's `LIST MERCHANT_ORG` permission is checked by the guard). */
export interface MerchantAdminReadPort {
	listMerchants(actor: ActorContext, query: AdminMerchantListQuery): Promise<PaginatedServiceResult<MerchantTenantResponse>>;
	/** `null` when the tenant is not a live merchant. */
	getMerchantDetail(actor: ActorContext, tenantId: string): Promise<AdminMerchantDetailResponse | null>;
	listLocationRequests(actor: ActorContext, query: AdminLocationRequestListQuery): Promise<PaginatedServiceResult<AdminLocationRequestResponse>>;
}
