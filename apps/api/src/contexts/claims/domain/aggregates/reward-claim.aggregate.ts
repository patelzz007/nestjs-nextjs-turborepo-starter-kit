import { epochMs, type EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { ClaimExpiredError, ClaimNotActiveError, CorruptClaimStateError } from "../errors/claims.errors";
import { ClaimCodesIssued, ClaimExpired, ClaimRedeemed, RewardClaimed, type ClaimDomainEvent, type ClaimEventFacts } from "../events/claim.events";
import { CLAIM_TTL_MS, RewardClaimStatusSchema, type RewardClaimStatus } from "../value-objects/claim-rules.value-object";

/** The hashes of a claim's two codes: the QR token and the backup code read out at a till. */
export interface ClaimCodeHashes {
	readonly redemptionTokenHash: string;
	readonly backupCodeHash: string;
}

/** A stored claim as a command load reads it. */
export interface RewardClaimState {
	readonly id: string;
	readonly userId: string;
	readonly rewardId: string;
	readonly referralId: string | null;
	/** Raw stored status; validated on load. */
	readonly status: string;
	readonly isReferrerCredit: boolean;
	readonly claimedAt: EpochMs;
	readonly claimExpiresAt: EpochMs;
	readonly redeemedAt: EpochMs | null;
	readonly codes: ClaimCodeHashes;
}

/** A new consumer claim. */
export interface NewRewardClaim {
	readonly id: string;
	readonly userId: string;
	readonly rewardId: string;
	readonly referralId: string | null;
	readonly codes: ClaimCodeHashes;
	/** The reward's own expiry: a claim never outlives its reward. */
	readonly rewardExpiry: EpochMs;
}

/** A referrer's credit claim: the bonus a credited referral earned them. */
export interface NewReferrerCreditClaim {
	readonly id: string;
	readonly referrerUserId: string;
	readonly referrerRewardId: string;
	readonly referralId: string;
	readonly codes: ClaimCodeHashes;
	/** Decided by referrals' credit policy (the referrer TTL, capped by the referrer reward's expiry). */
	readonly claimExpiresAt: EpochMs;
}

/** A claim as persisted after a command. */
export interface RewardClaimSnapshot extends RewardClaimState {
	readonly status: RewardClaimStatus;
}

/**
 * One customer's hold on one unit of a reward. `PENDING → REDEEMED` (checkout, unexpired) and
 * `PENDING → EXPIRED` (once `claimExpiresAt` has passed); codes rotate only while it is live.
 * Saves compare-and-set on the loaded status.
 */
export class RewardClaim extends AggregateRoot<ClaimDomainEvent> {
	private status: RewardClaimStatus;
	private codes: ClaimCodeHashes;
	private redeemedAt: EpochMs | null;
	private liveAtGuard: EpochMs | null = null;

	private constructor(
		private readonly state: RewardClaimState,
		status: RewardClaimStatus,
		private readonly loadedStatus: RewardClaimStatus | null,
	) {
		super();
		this.status = status;
		this.codes = state.codes;
		this.redeemedAt = state.redeemedAt;
	}

	/** A new PENDING claim; it stays redeemable for the claim TTL, capped by the reward's expiry. */
	public static create(claim: NewRewardClaim, now: EpochMs): RewardClaim {
		const created = new RewardClaim(
			{
				id: claim.id,
				userId: claim.userId,
				rewardId: claim.rewardId,
				referralId: claim.referralId,
				status: "PENDING",
				isReferrerCredit: false,
				claimedAt: now,
				claimExpiresAt: epochMs(Math.min(now + CLAIM_TTL_MS, claim.rewardExpiry)),
				redeemedAt: null,
				codes: claim.codes,
			},
			"PENDING",
			null,
		);
		created.record(new RewardClaimed(now, created.facts()));
		return created;
	}

	/** A new PENDING credit claim for a referrer; its unit was already held on the referrer reward by the credit. */
	public static createReferrerCredit(claim: NewReferrerCreditClaim, now: EpochMs): RewardClaim {
		const created = new RewardClaim(
			{
				id: claim.id,
				userId: claim.referrerUserId,
				rewardId: claim.referrerRewardId,
				referralId: claim.referralId,
				status: "PENDING",
				isReferrerCredit: true,
				claimedAt: now,
				claimExpiresAt: claim.claimExpiresAt,
				redeemedAt: null,
				codes: claim.codes,
			},
			"PENDING",
			null,
		);
		created.record(new RewardClaimed(now, created.facts()));
		return created;
	}

	public static rehydrate(state: RewardClaimState): RewardClaim {
		const parsed = RewardClaimStatusSchema.safeParse(state.status);
		if (!parsed.success || (parsed.data === "REDEEMED") !== (state.redeemedAt !== null)) {
			throw new CorruptClaimStateError(state.id);
		}
		return new RewardClaim(state, parsed.data, parsed.data);
	}

	public get id(): string {
		return this.state.id;
	}

	public get rewardId(): string {
		return this.state.rewardId;
	}

	public get userId(): string {
		return this.state.userId;
	}

	public get claimExpiresAt(): EpochMs {
		return this.state.claimExpiresAt;
	}

	public get currentStatus(): RewardClaimStatus {
		return this.status;
	}

	/** The status the claim was loaded with (compare-and-set input); null for a claim created in this unit of work. */
	public get concurrencyToken(): RewardClaimStatus | null {
		return this.loadedStatus;
	}

	/** Set when this unit of work rotated the codes: the save must still find the claim unexpired at this instant. */
	public get mustBeLiveAt(): EpochMs | null {
		return this.liveAtGuard;
	}

	/** Replaces both codes; only a PENDING, unexpired claim may (D07). */
	public issueCodes(codes: ClaimCodeHashes, now: EpochMs): void {
		this.assertLive(now);
		this.codes = codes;
		this.liveAtGuard = now;
		this.record(new ClaimCodesIssued(now, this.facts()));
	}

	/** Whether the expiry job should expire it: still PENDING and past `claimExpiresAt`. */
	public isOverdue(now: EpochMs): boolean {
		return this.status === "PENDING" && this.state.claimExpiresAt < now;
	}

	/** PENDING → EXPIRED once overdue; the caller returns the unit to the reward in the same transaction. */
	public expire(tenantId: string, now: EpochMs): void {
		if (!this.isOverdue(now)) {
			throw new ClaimNotActiveError(this.id);
		}
		this.status = "EXPIRED";
		this.record(new ClaimExpired(now, this.facts(), tenantId));
	}

	/** Whether a checkout paid at `now` may redeem it: still PENDING and not past its expiry. */
	public isRedeemableAt(now: EpochMs): boolean {
		return this.status === "PENDING" && this.state.claimExpiresAt >= now;
	}

	/** PENDING → REDEEMED at a checkout paid at `now`. */
	public redeem(now: EpochMs): void {
		this.assertLive(now);
		this.status = "REDEEMED";
		this.redeemedAt = now;
		this.liveAtGuard = now;
		this.record(new ClaimRedeemed(now, this.facts()));
	}

	public snapshot(): RewardClaimSnapshot {
		return { ...this.state, status: this.status, codes: this.codes, redeemedAt: this.redeemedAt };
	}

	private assertLive(now: EpochMs): void {
		if (this.status !== "PENDING") {
			throw new ClaimNotActiveError(this.id);
		}
		if (this.state.claimExpiresAt < now) {
			throw new ClaimExpiredError(this.id);
		}
	}

	private facts(): ClaimEventFacts {
		return { claimId: this.state.id, userId: this.state.userId, rewardId: this.state.rewardId, isReferrerCredit: this.state.isReferrerCredit };
	}
}
