import { epochMs, type EmailSendResult, type EpochMs, type RewardBackupCode, type RewardClaimResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { Clock } from "../../../../../platform/application/clock.port";
import { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import type { SystemOperationName } from "../../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { BaseEmailProps, BaseEmailTemplate, EmailRequestTransactionalPort } from "../../../../notifications/public-api";
import type {
	ClaimedSignupSuccessNotice,
	OwedSignupSuccessNotice,
	ReferrerCreditCursor,
	ReferrerCreditNoticesPort,
	SignupSuccessNoticesPort,
	UnnotifiedReferrerCredit,
} from "../../../../referrals/public-api";
import type {
	ClaimableRewardFacts,
	LegalAcceptanceCheck,
	ReferrerCreditFacts,
	RewardAuditEntry,
	RewardAuditPort,
	RewardInventoryPort,
	RewardRedemptionFacts,
	RewardRedemptionFactsPort,
} from "../../../../rewards/public-api";
import { OtpChallenge, type OtpChallengeState } from "../../../domain/aggregates/otp-challenge.aggregate";
import { RewardClaim, type RewardClaimSnapshot, type RewardClaimState } from "../../../domain/aggregates/reward-claim.aggregate";
import { ClaimNotActiveError, ClaimNotFoundError } from "../../../domain/errors/claims.errors";
import type { OtpChallengeRepository, OverdueClaim, RewardClaimRepository } from "../../../domain/repositories/claims.repositories";
import { LIMIT_COUNTED_CLAIM_STATUSES } from "../../../domain/value-objects/claim-rules.value-object";
import type { ClaimsScope } from "../../claims-scope";
import type { ClaimCodesPort, IssuedClaimCodes, IssuedOtp } from "../../ports/claim-codes.port";
import type { ClaimantPort, ClaimantProfile, ClaimViewPort, ReferralAttributionPort, RewardNotice, RewardNotificationInbox } from "../../ports/claims-transactional.ports";
import type { ClaimCodeLookup } from "../../services/claim-redemption.application-service";

export const NOW: EpochMs = epochMs(1_800_000_000_000);

export class FixedClock implements Clock {
	public constructor(private current: EpochMs = NOW) {}

	public now(): EpochMs {
		return this.current;
	}

	public advance(ms: number): void {
		this.current = epochMs(this.current + ms);
	}
}

export class SequentialIds {
	private counter = 0;

	public constructor(private readonly prefix: string) {}

	public next(): string {
		this.counter += 1;
		return `${this.prefix}-${String(this.counter)}`;
	}
}

/** Claims as stored rows; writes compare-and-set on the loaded status (and the expiry when asked), as in Postgres. */
export class InMemoryClaims implements RewardClaimRepository, ClaimCodeLookup {
	public readonly rows = new Map<string, RewardClaimSnapshot>();
	public readonly tenants = new Map<string, string>();
	private race: { readonly claimId: string; readonly status: RewardClaimSnapshot["status"] } | null = null;

	public seed(state: Partial<RewardClaimState> & Pick<RewardClaimState, "id" | "userId" | "rewardId">, tenantId = "org-1"): void {
		const claim = RewardClaim.rehydrate({
			referralId: null,
			status: "PENDING",
			isReferrerCredit: false,
			claimedAt: NOW,
			claimExpiresAt: epochMs(NOW + 1000),
			redeemedAt: null,
			codes: { redemptionTokenHash: `token-hash-${state.id}`, backupCodeHash: `backup-hash-${state.id}` },
			...state,
		});
		this.rows.set(state.id, claim.snapshot());
		this.tenants.set(state.id, tenantId);
	}

	public add(claim: RewardClaim): Promise<void> {
		this.rows.set(claim.id, claim.snapshot());
		return Promise.resolve();
	}

	public async getForUser(claimId: string, userId: string): Promise<RewardClaim> {
		const claim = await this.findById(claimId);
		if (claim?.userId !== userId) {
			throw new ClaimNotFoundError(claimId);
		}
		return claim;
	}

	public findById(claimId: string): Promise<RewardClaim | null> {
		const row = this.rows.get(claimId);
		return Promise.resolve(row === undefined ? null : RewardClaim.rehydrate(row));
	}

	public rewardIdsOf(claimIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		return Promise.resolve(
			new Map(
				claimIds.flatMap((claimId): [string, string][] => {
					const row = this.rows.get(claimId);
					return row === undefined ? [] : [[claimId, row.rewardId]];
				}),
			),
		);
	}

	public findReferrerCredit(referralId: string): Promise<RewardClaim | null> {
		const row = [...this.rows.values()].find((candidate): boolean => candidate.referralId === referralId && candidate.isReferrerCredit);
		return Promise.resolve(row === undefined ? null : RewardClaim.rehydrate(row));
	}

	public countHeld(userId: string, rewardId: string): Promise<number> {
		return Promise.resolve(
			[...this.rows.values()].filter((row): boolean => row.userId === userId && row.rewardId === rewardId && LIMIT_COUNTED_CLAIM_STATUSES.includes(row.status)).length,
		);
	}

	public listOverdue(isReferrerCredit: boolean, now: EpochMs, take: number): Promise<readonly OverdueClaim[]> {
		return Promise.resolve(
			[...this.rows.values()]
				.filter((row): boolean => row.status === "PENDING" && row.isReferrerCredit === isReferrerCredit && row.claimExpiresAt < now)
				.slice(0, take)
				.map((row): OverdueClaim => ({ claimId: row.id, tenantId: this.tenants.get(row.id) ?? "org-1" })),
		);
	}

	public async save(claim: RewardClaim): Promise<void> {
		if (!(await this.saveIfUnchanged(claim))) {
			throw new ClaimNotActiveError(claim.id);
		}
	}

	public saveIfUnchanged(claim: RewardClaim): Promise<boolean> {
		if (this.race !== null) {
			this.moveConcurrently(this.race.claimId, this.race.status);
			this.race = null;
		}
		const stored = this.rows.get(claim.id);
		const liveAt: EpochMs | null = claim.mustBeLiveAt;
		if (stored?.status !== claim.concurrencyToken || (liveAt !== null && stored.claimExpiresAt < liveAt)) {
			return Promise.resolve(false);
		}
		this.rows.set(claim.id, claim.snapshot());
		return Promise.resolve(true);
	}

	public findByRedemptionTokenHash(hashes: readonly string[]): Promise<string | null> {
		return Promise.resolve([...this.rows.values()].find((row): boolean => hashes.includes(row.codes.redemptionTokenHash))?.id ?? null);
	}

	public findByBackupCodeHash(hashes: readonly string[]): Promise<string | null> {
		return Promise.resolve([...this.rows.values()].find((row): boolean => hashes.includes(row.codes.backupCodeHash))?.id ?? null);
	}

	/** A concurrent writer (a checkout redeeming the claim) lands between the next read and its save. */
	public moveBeforeNextSave(claimId: string, status: RewardClaimSnapshot["status"]): void {
		this.race = { claimId, status };
	}

	private moveConcurrently(claimId: string, status: RewardClaimSnapshot["status"]): void {
		const row = this.rows.get(claimId);
		if (row !== undefined) {
			this.rows.set(claimId, { ...row, status, redeemedAt: status === "REDEEMED" ? NOW : row.redeemedAt });
		}
	}
}

export class InMemoryOtpChallenges implements OtpChallengeRepository {
	public readonly rows = new Map<string, OtpChallengeState>();

	public add(challenge: OtpChallenge): Promise<void> {
		this.rows.set(challenge.id, challenge.snapshot());
		return Promise.resolve();
	}

	public findActive(userId: string, phone: string, rewardId: string, now: EpochMs): Promise<OtpChallenge | null> {
		const row = [...this.rows.values()]
			.reverse()
			.find(
				(candidate): boolean =>
					candidate.userId === userId && candidate.phone === phone && candidate.rewardId === rewardId && candidate.consumedAt === null && candidate.expiresAt >= now,
			);
		return Promise.resolve(row === undefined ? null : OtpChallenge.rehydrate(row));
	}

	public recordAttempt(challenge: OtpChallenge): Promise<void> {
		this.rows.set(challenge.id, challenge.snapshot());
		return Promise.resolve();
	}
}

export class InMemoryInbox implements RewardNotificationInbox {
	public readonly notices: (RewardNotice & { readonly readAt: EpochMs | null; readonly id: string })[] = [];
	/** Users whose inbox insert fails (as a lost database connection would). */
	public readonly failingFor = new Set<string>();

	public add(notices: readonly RewardNotice[]): Promise<void> {
		if (notices.some((notice): boolean => this.failingFor.has(notice.userId))) {
			return Promise.reject(new Error("inbox unavailable"));
		}
		for (const notice of notices) {
			this.notices.push({ ...notice, readAt: null, id: `notice-${String(this.notices.length + 1)}` });
		}
		return Promise.resolve();
	}

	public markRead(userId: string, selection: { readonly notificationIds: readonly string[] } | "all", now: EpochMs): Promise<void> {
		for (const [index, notice] of this.notices.entries()) {
			if (notice.userId === userId && notice.readAt === null && (selection === "all" || selection.notificationIds.includes(notice.id))) {
				this.notices.splice(index, 1, { ...notice, readAt: now });
			}
		}
		return Promise.resolve();
	}
}

export class StoreClaimView implements ClaimViewPort {
	public constructor(private readonly claims: InMemoryClaims) {}

	public getResponse(claimId: string): Promise<RewardClaimResponse> {
		const row = this.claims.rows.get(claimId);
		if (row === undefined) {
			return Promise.reject(new ClaimNotFoundError(claimId));
		}
		return Promise.resolve({
			id: row.id,
			rewardId: row.rewardId,
			rewardTitle: "Free latte",
			status: row.status,
			claimedAt: row.claimedAt,
			claimExpiresAt: row.claimExpiresAt,
			redeemedAt: row.redeemedAt,
			isReferrerCredit: row.isReferrerCredit,
			createdAt: row.claimedAt,
			updatedAt: row.claimedAt,
			isDeleted: false,
			deletedAt: null,
		});
	}
}

export class InMemoryClaimants implements ClaimantPort {
	public readonly profiles = new Map<string, ClaimantProfile>();
	public readonly locks: string[] = [];
	/** Registered names by account id (deleted accounts keep theirs). */
	public readonly names = new Map<string, string>();

	public displayName(userId: string): Promise<string | null> {
		return Promise.resolve(this.names.get(userId) ?? null);
	}

	public profile(userId: string): Promise<ClaimantProfile | null> {
		return Promise.resolve(this.profiles.get(userId) ?? null);
	}

	public lockForClaim(userId: string): Promise<ClaimantProfile | null> {
		this.locks.push(userId);
		return this.profile(userId);
	}

	public recordVerifiedPhone(userId: string, phone: string, now: EpochMs): Promise<void> {
		const profile = this.profiles.get(userId);
		if (profile !== undefined) {
			this.profiles.set(userId, { ...profile, phone, phoneVerifiedAt: now, pendingAttributionToken: null, pendingAttributionExpiresAt: null });
		}
		return Promise.resolve();
	}
}

export class ScriptedAttribution implements ReferralAttributionPort {
	public readonly referrals = new Map<string, string>();
	public readonly attached: { readonly token: string; readonly rewardId: string; readonly refereeUserId: string }[] = [];

	public attach(attributionToken: string, rewardId: string, refereeUserId: string): Promise<string | null> {
		this.attached.push({ token: attributionToken, rewardId, refereeUserId });
		return Promise.resolve(this.referrals.get(`${attributionToken}:${rewardId}`) ?? null);
	}
}

/** One reward's stock, sold out at zero, with its claim-relevant facts. */
export class InMemoryInventory implements RewardInventoryPort, RewardRedemptionFactsPort {
	public remaining: number;
	public reserved = 0;
	public redemptions = 0;
	public facts: ClaimableRewardFacts;

	public constructor(quantity: number, overrides: Partial<ClaimableRewardFacts> = {}) {
		this.remaining = quantity;
		this.facts = { rewardId: "reward-1", tenantId: "org-1", title: "Free latte", expiryDate: epochMs(NOW + 30 * 86_400_000), maxClaimsPerUser: null, ...overrides };
	}

	public assertClaimable(): Promise<ClaimableRewardFacts> {
		return this.remaining > 0 ? Promise.resolve(this.facts) : Promise.reject(new Error("REWARD_OUT_OF_STOCK"));
	}

	public reserve(): Promise<ClaimableRewardFacts> {
		if (this.remaining <= 0) {
			return Promise.reject(new Error("REWARD_OUT_OF_STOCK"));
		}
		this.remaining -= 1;
		this.reserved += 1;
		return Promise.resolve(this.facts);
	}

	public release(): Promise<void> {
		this.remaining += 1;
		this.reserved -= 1;
		return Promise.resolve();
	}

	/** Claims never checks out; pos's checkout locks its rewards before redeeming. */
	public lockForCheckout(): Promise<void> {
		return Promise.resolve();
	}

	public recordRedemption(): Promise<void> {
		this.reserved -= 1;
		this.redemptions += 1;
		return Promise.resolve();
	}

	/** Claims never credits referrals; checkout (pos) does. */
	public creditReferral(): Promise<ReferrerCreditFacts | null> {
		return Promise.resolve(null);
	}

	public titlesOf(rewardIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		return Promise.resolve(
			new Map(rewardIds.filter((rewardId): boolean => rewardId === this.facts.rewardId).map((rewardId): [string, string] => [rewardId, this.facts.title])),
		);
	}

	public factsFor(rewardId: string): Promise<RewardRedemptionFacts | null> {
		return Promise.resolve(
			rewardId !== this.facts.rewardId
				? null
				: {
						id: rewardId,
						tenantId: this.facts.tenantId,
						title: this.facts.title,
						rewardType: "FREE_ITEM",
						expiryDate: this.facts.expiryDate,
						locationScopeType: "ALL_LOCATIONS",
						locationIds: [],
						minSpendMinor: null,
					},
		);
	}
}

export class ScriptedLegal implements LegalAcceptanceCheck {
	public readonly accepted = new Set<string>();

	public hasAccepted(userId: string): Promise<boolean> {
		return Promise.resolve(this.accepted.has(userId));
	}
}

export class RecordingRewardAudit implements RewardAuditPort {
	public readonly entries: RewardAuditEntry[] = [];

	public append(entry: RewardAuditEntry): Promise<void> {
		this.entries.push(entry);
		return Promise.resolve();
	}
}

export class RecordingEmails implements EmailRequestTransactionalPort {
	public readonly sent: { readonly key: string; readonly props: BaseEmailProps }[] = [];
	/** The email log cannot be written (`{ ok: false, reason: "persistence" }`) while set. */
	public failing = false;
	/** Recipients whose email log cannot be written right now (a transient `persistence` failure). */
	public readonly failingFor = new Set<string>();
	/** Recipients whose email can never be built (`{ ok: false, reason: "invalid-props" }`). */
	public readonly invalidFor = new Set<string>();

	public request<TProps extends BaseEmailProps>(template: BaseEmailTemplate<TProps>): Promise<EmailSendResult> {
		if (this.invalidFor.has(template.props.to)) {
			return Promise.resolve({ ok: false, reason: "invalid-props", detail: "props do not match the template" });
		}
		if (this.failing || this.failingFor.has(template.props.to)) {
			return Promise.resolve({ ok: false, reason: "persistence", detail: "email log unavailable" });
		}
		this.sent.push({ key: template.key, props: template.props });
		return Promise.resolve({ ok: true, id: `email-${String(this.sent.length)}`, mode: "queued" });
	}
}

/** Deterministic codes: a counter names each issue; hashes are `hash:<code>`. */
export class FakeClaimCodes implements ClaimCodesPort {
	private counter = 0;

	public issueClaimCodes(): IssuedClaimCodes {
		this.counter += 1;
		const qrPayload = `qr-${String(this.counter)}`;
		const backupCode: RewardBackupCode = `BACKUP${String(this.counter).padStart(2, "0")}`;
		return { qrPayload, backupCode, hashes: { redemptionTokenHash: `hash:${qrPayload}`, backupCodeHash: `hash:${backupCode}` } };
	}

	public issueOtp(): IssuedOtp {
		return { code: "123456", codeHash: "hash:123456" };
	}

	public hashOtp(code: string): string {
		return `hash:${code}`;
	}

	public lookupCandidates(code: string): readonly string[] {
		return [`hash:${code}`];
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

/** Referrals' credited referrals and their `creditNotifiedAt`, as the claims scope sees them. */
export class InMemoryReferrerCreditNotices implements ReferrerCreditNoticesPort {
	public readonly unnotified = new Map<string, UnnotifiedReferrerCredit>();
	public readonly notified = new Map<string, EpochMs>();
	/** Every page the sweeper asked for: its size and cursor. */
	public readonly pages: { readonly take: number; readonly after: ReferrerCreditCursor | null }[] = [];

	public credit(referralId: string, referrerUserId: string, creditedAt: EpochMs = NOW): this {
		this.unnotified.set(referralId, { referralId, referrerUserId, creditedAt });
		return this;
	}

	public listUnnotified(take: number, after: ReferrerCreditCursor | null): Promise<readonly UnnotifiedReferrerCredit[]> {
		this.pages.push({ take, after });
		const isAfter = (credit: UnnotifiedReferrerCredit): boolean =>
			after === null || credit.creditedAt > after.creditedAt || (credit.creditedAt === after.creditedAt && credit.referralId > after.referralId);
		return Promise.resolve(
			[...this.unnotified.values()]
				.filter((credit): boolean => !this.notified.has(credit.referralId) && isAfter(credit))
				.sort((left, right) => left.creditedAt - right.creditedAt || left.referralId.localeCompare(right.referralId))
				.slice(0, take),
		);
	}

	public markNotified(referralId: string, notifiedAt: EpochMs): Promise<boolean> {
		if (!this.unnotified.has(referralId) || this.notified.has(referralId)) {
			return Promise.resolve(false);
		}
		this.notified.set(referralId, notifiedAt);
		return Promise.resolve(true);
	}
}

/** Successful signup referrals and their `successNotifiedAt`, as the claims scope sees them; a claim is a compare-and-set. */
export class InMemorySignupSuccessNotices implements SignupSuccessNoticesPort {
	public readonly referrals = new Map<string, OwedSignupSuccessNotice & ClaimedSignupSuccessNotice>();
	public readonly notified = new Map<string, EpochMs>();
	/** Every page asked for: its size and cursor. */
	public readonly pages: { readonly take: number; readonly after: OwedSignupSuccessNotice | null }[] = [];

	public succeed(signupReferralId: string, referrerUserId: string, refereeUserId: string, successfulAt: EpochMs = NOW): this {
		this.referrals.set(signupReferralId, { signupReferralId, successfulAt, referrerUserId, refereeUserId });
		return this;
	}

	public listOwed(take: number, after: OwedSignupSuccessNotice | null): Promise<readonly OwedSignupSuccessNotice[]> {
		this.pages.push({ take, after });
		const isAfter = (owed: OwedSignupSuccessNotice): boolean =>
			after === null || owed.successfulAt > after.successfulAt || (owed.successfulAt === after.successfulAt && owed.signupReferralId > after.signupReferralId);
		return Promise.resolve(
			[...this.referrals.values()]
				.filter((owed): boolean => !this.notified.has(owed.signupReferralId) && isAfter(owed))
				.sort((left, right) => left.successfulAt - right.successfulAt || left.signupReferralId.localeCompare(right.signupReferralId))
				.slice(0, take)
				.map((owed): OwedSignupSuccessNotice => ({ signupReferralId: owed.signupReferralId, successfulAt: owed.successfulAt })),
		);
	}

	public claim(signupReferralId: string, now: EpochMs): Promise<ClaimedSignupSuccessNotice | null> {
		const referral = this.referrals.get(signupReferralId);
		if (referral === undefined || this.notified.has(signupReferralId)) {
			return Promise.resolve(null);
		}
		this.notified.set(signupReferralId, now);
		return Promise.resolve({ referrerUserId: referral.referrerUserId, refereeUserId: referral.refereeUserId });
	}
}

/** One claims database in memory; its unit of work rolls everything back when the work throws. */
export class InMemoryClaimsStore {
	public readonly clock = new FixedClock();
	public readonly claims = new InMemoryClaims();
	public readonly otpChallenges = new InMemoryOtpChallenges();
	public readonly inbox = new InMemoryInbox();
	public readonly claimants = new InMemoryClaimants();
	public readonly attribution = new ScriptedAttribution();
	public readonly referrerCreditNotices = new InMemoryReferrerCreditNotices();
	public readonly signupSuccessNotices = new InMemorySignupSuccessNotices();
	public readonly legal = new ScriptedLegal();
	public readonly rewardAudit = new RecordingRewardAudit();
	public readonly emails = new RecordingEmails();
	public readonly events = new TransactionalEventCollector();
	public readonly uow: InMemoryClaimsUnitOfWork;

	public constructor(public readonly inventory: InMemoryInventory = new InMemoryInventory(10)) {
		this.uow = new InMemoryClaimsUnitOfWork(this);
	}

	public get scope(): ClaimsScope {
		return {
			claims: this.claims,
			otpChallenges: this.otpChallenges,
			notifications: this.inbox,
			views: new StoreClaimView(this.claims),
			claimants: this.claimants,
			referralAttribution: this.attribution,
			referrerCreditNotices: this.referrerCreditNotices,
			signupSuccessNotices: this.signupSuccessNotices,
			rewards: this.inventory,
			rewardFacts: this.inventory,
			legal: this.legal,
			rewardAudit: this.rewardAudit,
			emails: this.emails,
			events: this.events,
		};
	}

	public checkpoint(): () => void {
		const remaining: number = this.inventory.remaining;
		const reserved: number = this.inventory.reserved;
		const restorers: (() => void)[] = [
			restorableMap(this.claims.rows),
			restorableMap(this.otpChallenges.rows),
			restorableMap(this.claimants.profiles),
			restorableMap(this.referrerCreditNotices.notified),
			restorableMap(this.signupSuccessNotices.notified),
			restorableArray(this.inbox.notices),
			restorableArray(this.rewardAudit.entries),
			restorableArray(this.emails.sent),
		];
		const pendingEvents: number = this.events.pendingCount();
		return (): void => {
			for (const restore of restorers) {
				restore();
			}
			this.inventory.remaining = remaining;
			this.inventory.reserved = reserved;
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

export class InMemoryClaimsUnitOfWork implements UnitOfWork<ClaimsScope> {
	public readonly committed: { readonly operation: SystemOperationName | null }[] = [];

	public constructor(private readonly store: InMemoryClaimsStore) {}

	public run<TResult>(_actor: ActorContext, work: (scope: ClaimsScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(null, work);
	}

	public runSystemOperation<TResult>(operation: SystemOperationName, _actor: ActorContext, work: (scope: ClaimsScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(operation, work);
	}

	private async execute<TResult>(operation: SystemOperationName | null, work: (scope: ClaimsScope) => Promise<TResult>): Promise<TResult> {
		const rollback: () => void = this.store.checkpoint();
		try {
			const result: TResult = await work(this.store.scope);
			this.committed.push({ operation });
			return result;
		} catch (error) {
			rollback();
			throw error;
		}
	}
}

const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

export function customer(userId: string): ActorContext {
	return { kind: "user", userId, sessionId: "session-1", tenantId: null, isSuperAdmin: false, accessScope: "tenant", impersonatorUserId: null, request: REQUEST };
}

export function claimantProfile(overrides: Partial<ClaimantProfile> = {}): ClaimantProfile {
	return { email: "jane@example.com", phone: "+60123000000", phoneVerifiedAt: NOW, pendingAttributionToken: null, pendingAttributionExpiresAt: null, ...overrides };
}
