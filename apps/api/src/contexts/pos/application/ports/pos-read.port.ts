import type {
	EpochMs,
	MerchantApiKeyListQuery,
	MerchantApiKeySummary,
	MerchantRedemptionListItem,
	MerchantRedemptionListQuery,
	MerchantTerminalListQuery,
	MerchantTerminalStatusSummary,
	MerchantTerminalSummary,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";

/** The organization's tills, read under the caller's RLS session within the authorized store scope. */
export interface TerminalReadPort {
	list(actor: ActorContext, grant: MerchantAccessGrant, query: MerchantTerminalListQuery, now: EpochMs): Promise<PaginatedServiceResult<MerchantTerminalSummary>>;
	/** Live terminals per derived status and the stores they cover, counted by the database. */
	summary(actor: ActorContext, grant: MerchantAccessGrant, now: EpochMs): Promise<MerchantTerminalStatusSummary>;
	/** One live terminal of the organization (the caller checks the store scope on `locationId`), or null. */
	find(actor: ActorContext, organizationId: string, id: string, now: EpochMs): Promise<MerchantTerminalSummary | null>;
}

/** The organization's API keys, read under the caller's RLS session within the authorized store scope. */
export interface ApiKeyReadPort {
	list(actor: ActorContext, grant: MerchantAccessGrant, query: MerchantApiKeyListQuery): Promise<PaginatedServiceResult<MerchantApiKeySummary>>;
}

/** The organization's redemption history, read under the caller's RLS session within the authorized store scope. */
export interface RedemptionReadPort {
	list(actor: ActorContext, grant: MerchantAccessGrant, query: MerchantRedemptionListQuery): Promise<PaginatedServiceResult<MerchantRedemptionListItem>>;
}

/** A terminal as the console shows it, read in the command's own transaction. */
export interface TerminalViewPort {
	getSummary(id: string, now: EpochMs): Promise<MerchantTerminalSummary>;
}
