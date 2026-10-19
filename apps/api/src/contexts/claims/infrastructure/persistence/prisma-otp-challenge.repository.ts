import type { Prisma } from "@prisma/client";
import { EpochMsSchema, nowEpochMs, type EpochMs } from "@workspace/shared";

import { OtpChallenge } from "../../domain/aggregates/otp-challenge.aggregate";
import { OtpAttemptsExhaustedError } from "../../domain/errors/claims.errors";
import type { OtpChallengeRepository } from "../../domain/repositories/claims.repositories";
import { MAX_OTP_ATTEMPTS } from "../../domain/value-objects/claim-rules.value-object";

/** Claim OTP challenges on one unit-of-work transaction. */
export class PrismaOtpChallengeRepository implements OtpChallengeRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async add(challenge: OtpChallenge): Promise<void> {
		const state = challenge.snapshot();
		await this.db.rewardOtpChallenge.create({
			data: {
				id: state.id,
				userId: state.userId,
				phone: state.phone,
				purpose: "CLAIM",
				rewardId: state.rewardId,
				codeHash: state.codeHash,
				expiresAt: state.expiresAt,
				attempts: state.attempts,
				failedAttempts: state.failedAttempts,
				consumedAt: state.consumedAt,
			},
		});
	}

	/** The newest unconsumed, unexpired claim challenge for this user, phone and reward. */
	public async findActive(userId: string, phone: string, rewardId: string, now: EpochMs): Promise<OtpChallenge | null> {
		const row = await this.db.rewardOtpChallenge.findFirst({
			where: { userId, phone, rewardId, purpose: "CLAIM", consumedAt: null, isDeleted: false, expiresAt: { gte: now } },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		if (row?.rewardId == null) {
			return null;
		}
		return OtpChallenge.rehydrate({
			id: row.id,
			userId: row.userId,
			phone: row.phone,
			rewardId: row.rewardId,
			codeHash: row.codeHash,
			expiresAt: EpochMsSchema.parse(Number(row.expiresAt)),
			attempts: row.attempts,
			failedAttempts: row.failedAttempts,
			consumedAt: row.consumedAt === null ? null : EpochMsSchema.parse(Number(row.consumedAt)),
		});
	}

	/**
	 * Stores one verification attempt (D09) as a compare-and-set: the row must still be unconsumed, under
	 * the attempt limit and at the count the aggregate read. The claim transaction also holds the
	 * claimant's row lock, so this never loses in practice; if a concurrent attempt did land first, this
	 * one is refused instead of being written over it.
	 */
	public async recordAttempt(challenge: OtpChallenge): Promise<void> {
		const state = challenge.snapshot();
		const loadedAttempts: number = state.attempts - 1;
		const updated = await this.db.rewardOtpChallenge.updateMany({
			where: { id: state.id, consumedAt: null, attempts: { equals: loadedAttempts, lt: MAX_OTP_ATTEMPTS } },
			data: { attempts: state.attempts, failedAttempts: state.failedAttempts, consumedAt: state.consumedAt, updatedAt: nowEpochMs() },
		});
		if (updated.count !== 1) {
			throw new OtpAttemptsExhaustedError();
		}
	}
}
