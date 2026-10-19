import type {
	AdminLocationRequestListQuery,
	AdminLocationRequestResponse,
	AdminMerchantDetailResponse,
	AdminMerchantListQuery,
	MerchantOrgResponse,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** Platform-admin merchant reads (the route's `LIST MERCHANT_ORG` permission is checked by the guard). */
export interface MerchantAdminReadPort {
	listMerchants(actor: ActorContext, query: AdminMerchantListQuery): Promise<PaginatedServiceResult<MerchantOrgResponse>>;
	/** `null` when the organization is not a live merchant. */
	getMerchantDetail(actor: ActorContext, organizationId: string): Promise<AdminMerchantDetailResponse | null>;
	listLocationRequests(actor: ActorContext, query: AdminLocationRequestListQuery): Promise<PaginatedServiceResult<AdminLocationRequestResponse>>;
}
