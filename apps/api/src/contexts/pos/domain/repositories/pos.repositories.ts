import type { EpochMs, SaleCurrency } from "@workspace/shared";

import type { NewApiKey, OrganizationApiKey } from "../aggregates/organization-api-key.aggregate";
import type { OrganizationTerminal } from "../aggregates/organization-terminal.aggregate";
import type { RedemptionMethod, RewardSale } from "../aggregates/reward-sale.aggregate";

/** One redemption line of a stored sale. */
export interface StoredSaleLine {
	readonly redemptionId: string;
	readonly claimId: string;
	readonly method: RedemptionMethod;
}

/** A recorded bill as checkout answers it (and replays it for a retried idempotency key). */
export interface StoredSale {
	readonly id: string;
	readonly billTotalMinor: number;
	readonly currency: SaleCurrency;
	readonly paidAt: EpochMs;
	readonly idempotencyKey: string;
	readonly requestHash: string;
	/** In redemption id order, as the legacy checkout answered. */
	readonly lines: readonly StoredSaleLine[];
}

/** Persistence port of {@link RewardSale}, bound to one transaction. */
export interface RewardSaleRepository {
	/** The organization's sale recorded under this idempotency key, or null. */
	findByIdempotencyKey(organizationId: string, idempotencyKey: string): Promise<StoredSale | null>;

	/**
	 * Inserts the sale and one redemption row per line. A concurrent checkout that already used the
	 * key fails the insert on the `(organization_id, idempotency_key)` unique index
	 * (`SaleIdempotencyKeyTakenError`); the caller's transaction rolls back and the winner is replayed.
	 */
	add(sale: RewardSale): Promise<StoredSale>;
}

/** The backup-code lockout counters on the API key row (`organization_api_keys.code_*`), bound to one transaction. */
export interface CodeLockoutRepository {
	/** Until when code redemption with the key is locked (null = never locked). */
	lockedUntil(apiKeyId: string): Promise<EpochMs | null>;

	/**
	 * Adds `failures` to the key's live window, race-safe (conditional updates: concurrent requests
	 * either increment the live window or exactly one of them opens a new one). Returns the failures
	 * counted in the live window after this call.
	 */
	addFailures(apiKeyId: string, failures: number, now: EpochMs, windowMs: number): Promise<number>;

	/** Locks the key until `lockedUntil` unless it is already locked; true when THIS call set the lock. */
	lock(apiKeyId: string, now: EpochMs, lockedUntil: EpochMs): Promise<boolean>;
}

/** Persistence port of {@link OrganizationTerminal}, bound to one transaction. */
export interface OrganizationTerminalRepository {
	/** Inserts a new till; a live till of the organization with the same terminal id throws `TerminalIdTakenError`. */
	add(terminal: OrganizationTerminal): Promise<void>;

	/** Whether the organization ever used this terminal id (soft-deleted tills count: a retired id is never reused). */
	terminalIdExists(organizationId: string, terminalId: string): Promise<boolean>;

	/**
	 * The live terminal of the organization, row-locked `FOR UPDATE` until commit: concurrent code issues
	 * (D33), removals and pairings of one till run one at a time.
	 */
	lockLive(id: string, organizationId: string): Promise<OrganizationTerminal | null>;

	/**
	 * Consumes a live, unexpired pairing code exactly once: the conditional update makes a concurrent
	 * second use of the same code find nothing. Returns the terminal as it was when the code was
	 * consumed (with the code's issuer), or null.
	 */
	consumePairingCode(codeHashes: readonly string[], now: EpochMs): Promise<OrganizationTerminal | null>;

	/** Writes the terminal's {@link OrganizationTerminal.pendingChange}. */
	save(terminal: OrganizationTerminal): Promise<void>;
}

/** Persistence port of {@link OrganizationApiKey}, bound to one transaction. */
export interface OrganizationApiKeyRepository {
	add(key: NewApiKey): Promise<void>;

	/** A live (not deleted) key of the organization, revoked or not; null otherwise. */
	findInOrganization(id: string, organizationId: string): Promise<OrganizationApiKey | null>;

	/** A key by id regardless of organization (pairing and removal revoke the till's bound key). */
	findById(id: string): Promise<OrganizationApiKey | null>;

	/** Writes a revocation as a compare-and-set on `revoked_at IS NULL` (D34); false when another request revoked it first. */
	save(key: OrganizationApiKey): Promise<boolean>;
}
