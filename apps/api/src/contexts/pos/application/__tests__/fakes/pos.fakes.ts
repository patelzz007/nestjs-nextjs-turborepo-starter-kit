import {
	epochMs,
	PosPairingCodeSchema,
	type EpochMs,
	type MerchantTerminalSummary,
	type PosPairingCode,
	type RedemptionCheckoutInput,
	type RedemptionCode,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import type { SystemOperationName } from "../../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { ClaimNoLongerRedeemableError, type ClaimRedemptionLookup, type ClaimRedemptionPort } from "../../../../claims/public-api";
import type { CustomerStandingPort, MerchantPosSettingsPort, TillTenantFacts } from "../../../../tenancy/public-api";
import type { ReferralCreditPort } from "../../../../referrals/public-api";
import type {
	ClaimableRewardFacts,
	ReferrerCreditFacts,
	RewardAuditEntry,
	RewardAuditPort,
	RewardInventoryPort,
	RewardRedemptionFacts,
	RewardRedemptionFactsPort,
} from "../../../../rewards/public-api";
import { TenantApiKey, type NewApiKey, type TenantApiKeyState } from "../../../domain/aggregates/tenant-api-key.aggregate";
import { TenantTerminal, type TenantTerminalState } from "../../../domain/aggregates/tenant-terminal.aggregate";
import type { RewardSale } from "../../../domain/aggregates/reward-sale.aggregate";
import { SaleIdempotencyKeyTakenError } from "../../../domain/errors/pos.errors";
import { terminalStatus } from "../../../domain/policies/terminal-status.policy";
import type { CodeLockoutRepository, TenantApiKeyRepository, TenantTerminalRepository, RewardSaleRepository, StoredSale } from "../../../domain/repositories/pos.repositories";
import type { PosScope } from "../../pos-scope";
import type { CheckoutFingerprintPort } from "../../ports/checkout-fingerprint.port";
import type { IssuedApiKeySecret, IssuedPairingSecret, PosCredentialsPort } from "../../ports/pos-credentials.port";
import type { TerminalViewPort } from "../../ports/pos-read.port";
import type { PosIdGenerator } from "../../ports/pos.tokens";

/** A fixed instant every pos application test measures from. */
export const NOW: EpochMs = epochMs(1_792_195_200_000);
export const TENANT_ID = "org-1";
export const STORE_A = "store-a";
export const STORE_B = "store-b";
export const CUSTOMER = "customer-1";
export const MEMBER = "member-1";

/** One hour: how far in the future the fixture claims expire. */
export const FIXTURE_CLAIM_TTL_MS = 3_600_000;

const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

export function apiKeyActor(apiKeyId = "key-1", locationId: string | null = STORE_A): ActorContext {
	return { kind: "api_key", apiKeyId, tenantId: TENANT_ID, locationId, terminalId: "TERM-AAAA2222", request: REQUEST };
}

export function member(userId = MEMBER): ActorContext {
	return { kind: "user", userId, sessionId: "session-1", tenantId: null, isSuperAdmin: false, accessScope: "tenant", impersonatorUserId: null, request: REQUEST };
}

export function anonymous(): ActorContext {
	return { kind: "anonymous", tenantId: null, request: REQUEST };
}

/** Sequential ids per prefix (`sale-1`, `sale-2`, …). */
export class SequentialIds implements PosIdGenerator {
	private counter = 0;

	public constructor(private readonly prefix: string) {}

	public next(): string {
		this.counter += 1;
		return `${this.prefix}-${String(this.counter)}`;
	}
}

/** The bill and its codes, joined (deterministic, distinct per payload). */
export class JoinedFingerprint implements CheckoutFingerprintPort {
	public of(input: RedemptionCheckoutInput): string {
		return [String(input.billTotalMinor), input.currency, ...input.codes.map((code) => code.token ?? code.backupCode ?? "")].join("|");
	}
}

/** Letters a pairing code may end in (the backup-code alphabet has no 0/O, 1/I). */
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Deterministic secrets: a counter names each one; hashes are `hash:<secret>`. */
export class FakeCredentials implements PosCredentialsPort {
	public readonly terminalIds: string[] = [];
	private counter = 0;

	public newPairingCode(): IssuedPairingSecret {
		this.counter += 1;
		const code = PosPairingCodeSchema.parse(`PARKCDQ${CODE_LETTERS.charAt(this.counter % CODE_LETTERS.length)}`);
		return { code, hash: `hash:${code}` };
	}

	public pairingCodeLookups(code: PosPairingCode): readonly string[] {
		return [`hash:${code}`];
	}

	public newTerminalId(): string {
		this.counter += 1;
		return this.terminalIds.shift() ?? `TERM-GEN${String(this.counter).padStart(5, "2")}`;
	}

	public newApiKey(): IssuedApiKeySecret {
		this.counter += 1;
		const plaintext = `mk_live_secret-${String(this.counter)}`;
		return { plaintext, hash: `hash:${plaintext}`, prefix: plaintext.slice(0, 16) };
	}
}

/** Claims the merchant's codes resolve to; redeeming is a compare-and-set on PENDING, as in Postgres. */
export class InMemoryClaimRedemption implements ClaimRedemptionPort {
	public readonly claims = new Map<string, ClaimRedemptionLookup>();
	/** Claims a concurrent checkout redeems just before this one does. */
	public readonly takenConcurrently = new Set<string>();
	private readonly codes = new Map<string, string>();

	/** `Reward` holds the unit each seeded PENDING claim reserved, as a real claim does. */
	public constructor(private readonly rewards: InMemoryRewards) {}

	public seed(
		claimId: string,
		patch: {
			readonly userId?: string;
			readonly rewardId?: string;
			readonly status?: ClaimRedemptionLookup["claim"]["status"];
			readonly claimExpiresAt?: EpochMs;
			readonly reward?: Partial<RewardRedemptionFacts>;
		} = {},
	): { readonly token: string; readonly backupCode: string } {
		const rewardId = patch.rewardId ?? "reward-1";
		if ((patch.status ?? "PENDING") === "PENDING") {
			this.rewards.holdUnit(rewardId);
		}
		this.claims.set(claimId, {
			claim: {
				id: claimId,
				userId: patch.userId ?? CUSTOMER,
				rewardId,
				status: patch.status ?? "PENDING",
				claimExpiresAt: patch.claimExpiresAt ?? epochMs(NOW + FIXTURE_CLAIM_TTL_MS),
			},
			reward: {
				id: rewardId,
				tenantId: TENANT_ID,
				title: "Free latte",
				rewardType: "FREE_ITEM",
				expiryDate: epochMs(NOW + FIXTURE_CLAIM_TTL_MS),
				locationScopeType: "ALL_LOCATIONS",
				locationIds: [],
				minSpendMinor: null,
				...patch.reward,
			},
		});
		const token = `token-${claimId}`;
		const backupCode = `BACKUP${claimId.slice(-2).toUpperCase()}`;
		this.codes.set(token, claimId);
		this.codes.set(backupCode, claimId);
		return { token, backupCode };
	}

	public findMerchantClaim(code: RedemptionCode, tenantId: string): Promise<ClaimRedemptionLookup | null> {
		const claimId = this.codes.get(code.token ?? code.backupCode ?? "");
		const lookup = claimId === undefined ? undefined : this.claims.get(claimId);
		return Promise.resolve(lookup?.reward.tenantId === tenantId ? lookup : null);
	}

	public redeem(claimIds: readonly string[]): Promise<void> {
		for (const claimId of [...claimIds].sort((left, right) => left.localeCompare(right))) {
			const lookup = this.claims.get(claimId);
			if (lookup?.claim.status !== "PENDING" || this.takenConcurrently.has(claimId)) {
				return Promise.reject(new ClaimNoLongerRedeemableError(claimId));
			}
			this.claims.set(claimId, { ...lookup, claim: { ...lookup.claim, status: "REDEEMED" } });
		}
		return Promise.resolve();
	}

	public rewardIdsOf(claimIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		return Promise.resolve(
			new Map(
				claimIds.flatMap((claimId): [string, string][] => {
					const lookup = this.claims.get(claimId);
					return lookup === undefined ? [] : [[claimId, lookup.claim.rewardId]];
				}),
			),
		);
	}
}

/** A redemption with no reserved unit left (the Reward aggregate refuses it the same way). */
export class NoReservedUnitError extends Error {
	public constructor(rewardId: string) {
		super(`Reward ${rewardId} has no reserved unit to redeem`);
		this.name = "NoReservedUnitError";
	}
}

/**
 * Rewards' redemption counters and titles. A redemption spends one reserved unit and needs the
 * checkout's lock on the reward, as the Prisma adapter's row lock and non-negative compare-and-set do.
 */
export class InMemoryRewards implements RewardInventoryPort, RewardRedemptionFactsPort {
	public readonly redemptions: string[] = [];
	public readonly titles = new Map<string, string>([["reward-1", "Free latte"]]);
	/** Reserved units per reward: each seeded PENDING claim holds one. */
	public readonly reserved = new Map<string, number>();
	/** Each `lockForCheckout` call, ids as given. */
	public readonly checkoutLocks: (readonly string[])[] = [];
	/** A reward whose redemption write fails with `error`, after the claims were already redeemed. */
	public failRedemption: { readonly rewardId: string; readonly error: Error } | null = null;

	public holdUnit(rewardId: string): void {
		this.reserved.set(rewardId, (this.reserved.get(rewardId) ?? 0) + 1);
	}

	public assertClaimable(): Promise<ClaimableRewardFacts> {
		return Promise.reject(new Error("checkout never claims"));
	}

	public reserve(): Promise<ClaimableRewardFacts> {
		return Promise.reject(new Error("checkout never reserves"));
	}

	public release(): Promise<void> {
		return Promise.reject(new Error("checkout never releases"));
	}

	public lockForCheckout(rewardIds: readonly string[]): Promise<void> {
		this.checkoutLocks.push([...rewardIds]);
		return Promise.resolve();
	}

	public recordRedemption(rewardId: string): Promise<void> {
		if (!this.checkoutLocks.some((locked): boolean => locked.includes(rewardId))) {
			return Promise.reject(new Error(`Reward ${rewardId} redeemed without the checkout lock`));
		}
		if (this.failRedemption?.rewardId === rewardId) {
			return Promise.reject(this.failRedemption.error);
		}
		const reserved = this.reserved.get(rewardId) ?? 0;
		if (reserved === 0) {
			return Promise.reject(new NoReservedUnitError(rewardId));
		}
		this.reserved.set(rewardId, reserved - 1);
		this.redemptions.push(rewardId);
		return Promise.resolve();
	}

	public creditReferral(): Promise<ReferrerCreditFacts | null> {
		return Promise.reject(new Error("pos credits through referrals"));
	}

	public factsFor(): Promise<RewardRedemptionFacts | null> {
		return Promise.reject(new Error("pos reads facts through claims"));
	}

	public titlesOf(rewardIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		return Promise.resolve(new Map(rewardIds.flatMap((rewardId): [string, string][] => (this.titles.has(rewardId) ? [[rewardId, this.titles.get(rewardId) ?? ""]] : []))));
	}
}

export class RecordingAudit implements RewardAuditPort {
	public readonly entries: RewardAuditEntry[] = [];

	public append(entry: RewardAuditEntry): Promise<void> {
		this.entries.push(entry);
		return Promise.resolve();
	}

	public actions(): readonly string[] {
		return this.entries.map((entry) => entry.action);
	}
}

/**
 * Referrals' credit port: records each call (the real behaviour is specified in referrals). A reward
 * in `pendingReferrals` has a PENDING referral for its referee, credited once; `pendingSignupReferral`
 * is the referee's not-yet-successful signup referral.
 */
export class RecordingReferralCredit implements ReferralCreditPort {
	public readonly credited: { readonly rewardId: string; readonly refereeUserId: string }[] = [];
	public readonly stamped: string[] = [];
	public readonly pendingReferrals = new Map<string, string>();
	public pendingSignupReferral: string | null = null;

	public creditReferrer(rewardId: string, refereeUserId: string): Promise<string | null> {
		this.credited.push({ rewardId, refereeUserId });
		const referralId = this.pendingReferrals.get(rewardId) ?? null;
		this.pendingReferrals.delete(rewardId);
		return Promise.resolve(referralId);
	}

	public markSignupReferralSuccessful(refereeUserId: string): Promise<string | null> {
		this.stamped.push(refereeUserId);
		const signupReferralId = this.pendingSignupReferral;
		this.pendingSignupReferral = null;
		return Promise.resolve(signupReferralId);
	}
}

/** Sales by `(tenant, idempotency key)`, with the unique index's refusal of a second insert. */
export class InMemorySales implements RewardSaleRepository {
	public readonly rows = new Map<string, StoredSale>();
	/** A concurrent checkout with the same key that commits just before this one inserts. */
	public concurrentWinner: StoredSale | null = null;
	/** Sales the caller's principal cannot read (another store's, for a store-limited key): the unique index still sees them. */
	public readonly hiddenFromReplay = new Set<string>();
	/** Sales other transactions committed: this unit of work's rollback never touches them. */
	private readonly committedElsewhere = new Map<string, StoredSale>();
	private redemptionCounter = 0;

	public findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<StoredSale | null> {
		const key = `${tenantId}:${idempotencyKey}`;
		const stored = this.rows.get(key) ?? this.committedElsewhere.get(key) ?? null;
		return Promise.resolve(stored === null || this.hiddenFromReplay.has(stored.id) ? null : stored);
	}

	public add(sale: RewardSale): Promise<StoredSale> {
		const state = sale.snapshot();
		const key = `${state.point.tenantId}:${state.idempotencyKey}`;
		if (this.concurrentWinner !== null) {
			this.committedElsewhere.set(key, this.concurrentWinner);
			this.concurrentWinner = null;
		}
		if (this.rows.has(key) || this.committedElsewhere.has(key)) {
			return Promise.reject(new SaleIdempotencyKeyTakenError(state.idempotencyKey));
		}
		const stored: StoredSale = {
			id: state.id,
			billTotalMinor: state.billTotalMinor,
			currency: state.currency,
			paidAt: state.paidAt,
			idempotencyKey: state.idempotencyKey,
			requestHash: state.requestHash,
			lines: state.lines.map((line) => {
				this.redemptionCounter += 1;
				return { redemptionId: `redemption-${String(this.redemptionCounter)}`, claimId: line.claimId, method: line.method };
			}),
		};
		this.rows.set(key, stored);
		return Promise.resolve(stored);
	}
}

/** The lockout counters of each key over one window, as the conditional updates keep them. */
export class InMemoryLockout implements CodeLockoutRepository {
	public readonly locks = new Map<string, EpochMs>();
	public readonly failures = new Map<string, number>();

	public lockedUntil(apiKeyId: string): Promise<EpochMs | null> {
		return Promise.resolve(this.locks.get(apiKeyId) ?? null);
	}

	public addFailures(apiKeyId: string, failures: number): Promise<number> {
		const total = (this.failures.get(apiKeyId) ?? 0) + failures;
		this.failures.set(apiKeyId, total);
		return Promise.resolve(total);
	}

	public lock(apiKeyId: string, now: EpochMs, lockedUntil: EpochMs): Promise<boolean> {
		const current = this.locks.get(apiKeyId);
		if (current !== undefined && current > now) {
			return Promise.resolve(false);
		}
		this.locks.set(apiKeyId, lockedUntil);
		this.failures.delete(apiKeyId);
		return Promise.resolve(true);
	}
}

/** A stored terminal: its state, whether it is deleted, and who deleted it. */
export interface StoredTerminal {
	readonly state: TenantTerminalState;
	readonly deleted: boolean;
	readonly createdByUserId: string | null;
}

/** Terminals as stored rows; removal soft-deletes; a live terminal id is unique per tenant. */
export class InMemoryTerminals implements TenantTerminalRepository {
	public readonly rows = new Map<string, StoredTerminal>();
	public readonly locked: string[] = [];
	/** Terminal ids retired by soft-deleted tills (they still count as used). */
	public readonly retiredTerminalIds = new Set<string>();

	public seed(state: Partial<TenantTerminalState> & Pick<TenantTerminalState, "id">): void {
		this.rows.set(state.id, {
			state: {
				tenantId: TENANT_ID,
				locationId: STORE_A,
				terminalId: `TERM-${state.id.toUpperCase().slice(-8).padStart(8, "2")}`,
				label: null,
				apiKeyId: null,
				pairingCode: null,
				pairedAt: null,
				...state,
			},
			deleted: false,
			createdByUserId: MEMBER,
		});
	}

	public add(terminal: TenantTerminal): Promise<void> {
		const state = terminal.snapshot();
		if ([...this.rows.values()].some((row) => !row.deleted && row.state.tenantId === state.tenantId && row.state.terminalId === state.terminalId)) {
			return Promise.reject(new Error("TERMINAL_ID_TAKEN"));
		}
		this.rows.set(state.id, { state, deleted: false, createdByUserId: terminal.registrant });
		return Promise.resolve();
	}

	public terminalIdExists(tenantId: string, terminalId: string): Promise<boolean> {
		return Promise.resolve(
			this.retiredTerminalIds.has(terminalId) || [...this.rows.values()].some((row) => row.state.tenantId === tenantId && row.state.terminalId === terminalId),
		);
	}

	public lockLive(id: string, tenantId: string): Promise<TenantTerminal | null> {
		this.locked.push(id);
		const row = this.rows.get(id);
		return Promise.resolve(row === undefined || row.deleted || row.state.tenantId !== tenantId ? null : TenantTerminal.rehydrate(row.state));
	}

	public consumePairingCode(codeHashes: readonly string[], now: EpochMs): Promise<TenantTerminal | null> {
		const row = [...this.rows.values()].find((candidate) => candidate.state.pairingCode !== null && codeHashes.includes(candidate.state.pairingCode.hash));
		if (row === undefined || row.deleted || row.state.pairingCode === null || row.state.pairingCode.expiresAt < now) {
			return Promise.resolve(null);
		}
		this.rows.set(row.state.id, { ...row, state: { ...row.state, pairingCode: null } });
		return Promise.resolve(TenantTerminal.rehydrate(row.state));
	}

	public save(terminal: TenantTerminal): Promise<void> {
		const row = this.rows.get(terminal.id);
		const change = terminal.pendingChange;
		if (row === undefined || change === null) {
			return Promise.reject(new Error("nothing to save"));
		}
		this.rows.set(terminal.id, { ...row, state: terminal.snapshot(), deleted: change.kind === "removed" ? true : row.deleted });
		return Promise.resolve();
	}
}

/** Keys as stored rows; revocation is a compare-and-set on `revokedAt IS NULL`. */
export class InMemoryApiKeys implements TenantApiKeyRepository {
	public readonly rows = new Map<
		string,
		TenantApiKeyState & { readonly name: string; readonly scope: NewApiKey["scope"]; readonly createdByUserId: string; readonly keyHash: string }
	>();
	/** Keys a concurrent request revokes just before this one saves. */
	public readonly revokedConcurrently = new Set<string>();

	public seed(id: string, patch: Partial<TenantApiKeyState> = {}): void {
		this.rows.set(id, {
			id,
			tenantId: TENANT_ID,
			locationId: null,
			revokedAt: null,
			name: id,
			scope: "POS",
			createdByUserId: MEMBER,
			keyHash: `hash:${id}`,
			...patch,
		});
	}

	public add(key: NewApiKey): Promise<void> {
		this.rows.set(key.id, {
			id: key.id,
			tenantId: key.tenantId,
			locationId: key.locationId,
			revokedAt: null,
			name: key.name,
			scope: key.scope,
			createdByUserId: key.createdByUserId,
			keyHash: key.keyHash,
		});
		return Promise.resolve();
	}

	public findInTenant(id: string, tenantId: string): Promise<TenantApiKey | null> {
		const row = this.rows.get(id);
		return Promise.resolve(row?.tenantId === tenantId ? TenantApiKey.rehydrate(row) : null);
	}

	public findById(id: string): Promise<TenantApiKey | null> {
		const row = this.rows.get(id);
		return Promise.resolve(row === undefined ? null : TenantApiKey.rehydrate(row));
	}

	public save(key: TenantApiKey): Promise<boolean> {
		const row = this.rows.get(key.id);
		const revokedAt = key.revokedInThisUnitOfWork;
		if (row === undefined || revokedAt === null || row.revokedAt !== null || this.revokedConcurrently.has(key.id)) {
			return Promise.resolve(false);
		}
		this.rows.set(key.id, { ...row, revokedAt });
		return Promise.resolve(true);
	}
}

/** Tenants' POS facts for {@link TENANT_ID}. */
export class InMemoryPosSettings implements MerchantPosSettingsPort {
	public tenant: TillTenantFacts | null = { slug: "brew-bean", displayName: "Brew & Bean", operating: true, requireRegisteredTerminals: false };
	public hasProfile = true;
	public readonly stores = new Map<string, string>([
		[STORE_A, "Store A"],
		[STORE_B, "Store B"],
	]);

	/** Stores that are closed (or soft-deleted): a till cannot be registered there. */
	public readonly closedStores = new Set<string>();
	/** Each store lock taken, as `tenantId/locationId`. */
	public readonly lockedStores: string[] = [];

	public lockOpenStore(tenantId: string, locationId: string): Promise<boolean> {
		this.lockedStores.push(`${tenantId}/${locationId}`);
		return Promise.resolve(tenantId === TENANT_ID && this.stores.has(locationId) && !this.closedStores.has(locationId));
	}

	public tillTenant(): Promise<TillTenantFacts | null> {
		return Promise.resolve(this.tenant);
	}

	public storeNames(locationIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		return Promise.resolve(
			new Map(locationIds.flatMap((locationId): [string, string][] => (this.stores.has(locationId) ? [[locationId, this.stores.get(locationId) ?? ""]] : []))),
		);
	}

	public requireRegisteredTerminals(): Promise<boolean | null> {
		return Promise.resolve(this.hasProfile && this.tenant !== null ? this.tenant.requireRegisteredTerminals : null);
	}

	public setRequireRegisteredTerminals(_tenantId: string, requireRegisteredTerminals: boolean): Promise<boolean> {
		if (!this.hasProfile || this.tenant === null) {
			return Promise.resolve(false);
		}
		this.tenant = { ...this.tenant, requireRegisteredTerminals };
		return Promise.resolve(true);
	}
}

/** The terminal summary the console shows, built from the stored rows. */
export class StoreTerminalViews implements TerminalViewPort {
	public constructor(
		private readonly terminals: InMemoryTerminals,
		private readonly keys: InMemoryApiKeys,
		private readonly settings: InMemoryPosSettings,
	) {}

	public getSummary(id: string, now: EpochMs): Promise<MerchantTerminalSummary> {
		const row = this.terminals.rows.get(id);
		if (row === undefined) {
			return Promise.reject(new Error(`no terminal ${id}`));
		}
		const { state } = row;
		const key = state.apiKeyId === null ? undefined : this.keys.rows.get(state.apiKeyId);
		const status = terminalStatus(
			{
				pairingCodeHash: state.pairingCode?.hash ?? null,
				pairingCodeExpiresAt: state.pairingCode?.expiresAt ?? null,
				pairedAt: state.pairedAt,
				hasLiveApiKey: key?.revokedAt === null,
			},
			now,
		);
		return Promise.resolve({
			id: state.id,
			terminalId: state.terminalId,
			name: state.label ?? state.terminalId,
			locationId: state.locationId,
			locationName: this.settings.stores.get(state.locationId) ?? "",
			status,
			pairingCodeExpiresAt: status === "AWAITING_PAIRING" ? (state.pairingCode?.expiresAt ?? null) : null,
			pairedAt: state.pairedAt,
			lastSeenAt: null,
			createdAt: NOW,
			updatedAt: now,
			isDeleted: row.deleted,
			deletedAt: null,
		});
	}
}

function restorableMap<Key, Value>(map: Map<Key, Value>): () => void {
	const saved: [Key, Value][] = [...map.entries()];
	return (): void => {
		map.clear();
		for (const [key, value] of saved) {
			map.set(key, value);
		}
	};
}

/** Restores an append-only record to its current length (any array: only `length` is touched). */
function restorableArray(items: { length: number }): () => void {
	const length: number = items.length;
	return (): void => {
		items.length = length;
	};
}

/** Tenants' customer standing in memory: every tenant operates unless stopped; bans are per tenant. */
export class InMemoryCustomerStanding implements CustomerStandingPort {
	private readonly stopped = new Set<string>();
	private readonly bans = new Map<string, Set<string>>();

	/** The tenant no longer operates (suspended, banned, not live). */
	public stop(tenantId: string): void {
		this.stopped.add(tenantId);
	}

	public ban(tenantId: string, customerUserId: string): void {
		const banned = this.bans.get(tenantId) ?? new Set<string>();
		banned.add(customerUserId);
		this.bans.set(tenantId, banned);
	}

	public tenantOperates(tenantId: string): Promise<boolean> {
		return Promise.resolve(!this.stopped.has(tenantId));
	}

	public bannedCustomers(tenantId: string, customerUserIds: readonly string[]): Promise<ReadonlySet<string>> {
		const banned = this.bans.get(tenantId);
		return Promise.resolve(new Set(customerUserIds.filter((userId): boolean => banned?.has(userId) === true)));
	}
}

/** One pos database in memory; its unit of work rolls everything back when the work throws. */
export class InMemoryPosStore {
	public readonly sales = new InMemorySales();
	public readonly lockout = new InMemoryLockout();
	public readonly terminals = new InMemoryTerminals();
	public readonly apiKeys = new InMemoryApiKeys();
	public readonly posSettings = new InMemoryPosSettings();
	public readonly customerStanding = new InMemoryCustomerStanding();
	public readonly rewards = new InMemoryRewards();
	public readonly claims = new InMemoryClaimRedemption(this.rewards);
	public readonly audit = new RecordingAudit();
	public readonly referrals = new RecordingReferralCredit();
	public readonly events = new TransactionalEventCollector();
	public readonly uow: InMemoryPosUnitOfWork;

	public constructor() {
		this.uow = new InMemoryPosUnitOfWork(this);
	}

	public get scope(): PosScope {
		return {
			sales: this.sales,
			lockout: this.lockout,
			terminals: this.terminals,
			terminalViews: new StoreTerminalViews(this.terminals, this.apiKeys, this.posSettings),
			apiKeys: this.apiKeys,
			posSettings: this.posSettings,
			customerStanding: this.customerStanding,
			claims: this.claims,
			rewards: this.rewards,
			rewardFacts: this.rewards,
			rewardAudit: this.audit,
			referrals: this.referrals,
			events: this.events,
		};
	}

	public checkpoint(): () => void {
		const restorers: (() => void)[] = [
			restorableMap(this.sales.rows),
			restorableMap(this.lockout.locks),
			restorableMap(this.lockout.failures),
			restorableMap(this.terminals.rows),
			restorableMap(this.apiKeys.rows),
			restorableMap(this.claims.claims),
			restorableArray(this.rewards.redemptions),
			restorableMap(this.rewards.reserved),
			restorableMap(this.referrals.pendingReferrals),
			restorableArray(this.audit.entries),
			restorableArray(this.referrals.credited),
			restorableArray(this.referrals.stamped),
		];
		const pendingEvents: number = this.events.pendingCount();
		const pendingSignupReferral: string | null = this.referrals.pendingSignupReferral;
		return (): void => {
			this.referrals.pendingSignupReferral = pendingSignupReferral;
			for (const restore of restorers) {
				restore();
			}
			const collected = this.events.take();
			for (const event of collected.slice(0, pendingEvents)) {
				this.events.collect(event);
			}
		};
	}

	public eventNames(): readonly string[] {
		return this.events.take().map((event): string => event.eventName);
	}
}

export class InMemoryPosUnitOfWork implements UnitOfWork<PosScope> {
	public readonly committed: { readonly operation: SystemOperationName | null; readonly actor: ActorContext }[] = [];
	/** Every unit of work that threw and was rolled back, with the actor it ran as. */
	public readonly rolledBack: { readonly operation: SystemOperationName | null; readonly actor: ActorContext }[] = [];

	public constructor(private readonly store: InMemoryPosStore) {}

	public run<TResult>(actor: ActorContext, work: (scope: PosScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(null, actor, work);
	}

	public runSystemOperation<TResult>(operation: SystemOperationName, actor: ActorContext, work: (scope: PosScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(operation, actor, work);
	}

	private async execute<TResult>(operation: SystemOperationName | null, actor: ActorContext, work: (scope: PosScope) => Promise<TResult>): Promise<TResult> {
		const rollback: () => void = this.store.checkpoint();
		try {
			const result: TResult = await work(this.store.scope);
			this.committed.push({ operation, actor });
			return result;
		} catch (error) {
			rollback();
			this.rolledBack.push({ operation, actor });
			throw error;
		}
	}
}
