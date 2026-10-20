import type { EpochMs } from "@workspace/shared";

import type { TenantAuditWriter } from "./tenant-audit.port";
import type { TenantExistencePort } from "./tenant-existence.port";

/** What a till needs to know about its tenant. */
export interface TillTenantFacts {
	readonly slug: string;
	readonly displayName: string;
	/** Only an ACTIVE, live tenant operates: pairs tills, redeems, uses merchant API keys. */
	readonly operating: boolean;
	/** The "only allow registered terminals" policy (false without a merchant profile). */
	readonly requireRegisteredTerminals: boolean;
}

/** The merchant profile's POS policy and the facts tills read, inside the caller's transaction (pos consumes it). */
export interface MerchantPosSettingsPort {
	/** The tenant as its tills see it; null when it does not exist at all. */
	tillTenant(tenantId: string): Promise<TillTenantFacts | null>;
	/** Names of the tenant's stores (soft-deleted ones included: a till keeps naming its store), one query for all. */
	storeNames(locationIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
	/**
	 * Locks the tenant's store `FOR SHARE` until the caller's transaction ends and says whether it
	 * is live and not closed (a closure leaves it `INACTIVE`). A store closure updates that row, so it waits for the caller (and then sees
	 * what the caller wrote), or committed first (and the caller sees the store closed).
	 */
	lockOpenStore(tenantId: string, locationId: string): Promise<boolean>;
	/** `null` when the tenant has no merchant profile. */
	requireRegisteredTerminals(tenantId: string): Promise<boolean | null>;
	/** Returns whether a merchant profile was updated (stamped `updatedAt = now`). */
	setRequireRegisteredTerminals(tenantId: string, requireRegisteredTerminals: boolean, now: EpochMs): Promise<boolean>;
}

/** Tenant ports another context's unit of work binds to its own transaction. */
export interface TenantsTransactionalPorts {
	readonly merchantPosSettings: MerchantPosSettingsPort;
	readonly existence: TenantExistencePort;
	readonly audit: TenantAuditWriter;
}
