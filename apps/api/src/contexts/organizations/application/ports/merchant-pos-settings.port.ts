import type { EpochMs } from "@workspace/shared";

import type { OrganizationAuditWriter } from "./organization-audit.port";
import type { OrganizationExistencePort } from "./organization-existence.port";

/** What a till needs to know about its organization. */
export interface TillOrganizationFacts {
	readonly slug: string;
	readonly displayName: string;
	/** Only an ACTIVE, live organization operates: pairs tills, redeems, uses merchant API keys. */
	readonly operating: boolean;
	/** The "only allow registered terminals" policy (false without a merchant profile). */
	readonly requireRegisteredTerminals: boolean;
}

/** The merchant profile's POS policy and the facts tills read, inside the caller's transaction (pos consumes it). */
export interface MerchantPosSettingsPort {
	/** The organization as its tills see it; null when it does not exist at all. */
	tillOrganization(organizationId: string): Promise<TillOrganizationFacts | null>;
	/** Names of the organization's stores (soft-deleted ones included: a till keeps naming its store), one query for all. */
	storeNames(locationIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
	/**
	 * Locks the organization's store `FOR SHARE` until the caller's transaction ends and says whether it
	 * is live and not closed (a closure leaves it `INACTIVE`). A store closure updates that row, so it waits for the caller (and then sees
	 * what the caller wrote), or committed first (and the caller sees the store closed).
	 */
	lockOpenStore(organizationId: string, locationId: string): Promise<boolean>;
	/** `null` when the organization has no merchant profile. */
	requireRegisteredTerminals(organizationId: string): Promise<boolean | null>;
	/** Returns whether a merchant profile was updated (stamped `updatedAt = now`). */
	setRequireRegisteredTerminals(organizationId: string, requireRegisteredTerminals: boolean, now: EpochMs): Promise<boolean>;
}

/** Organization ports another context's unit of work binds to its own transaction. */
export interface OrganizationsTransactionalPorts {
	readonly merchantPosSettings: MerchantPosSettingsPort;
	readonly existence: OrganizationExistencePort;
	readonly audit: OrganizationAuditWriter;
}
