import type { Prisma } from "@prisma/client";
import { epochMs, type EpochMs } from "@workspace/shared";
import { z } from "zod";

import { ConcurrentModificationError } from "../../../../platform/infrastructure/persistence/persistence.errors";
import { TwoFactorEnrollment, type EncryptedTotpSecret, type TwoFactorChange } from "../../domain/aggregates/two-factor-enrollment.aggregate";
import { TwoFactorLoginChallenge, type MfaChallengePurpose } from "../../domain/aggregates/two-factor-login-challenge.aggregate";
import { BackupCodeRejectedError, InvalidTwoFactorCodeError, MfaChallengeAlreadyUsedError } from "../../domain/errors/identity.errors";
import type { FailedChallengeAttempt, TwoFactorEnrollmentRepository, TwoFactorLoginChallengeRepository } from "../../domain/repositories/two-factor.repository";
import { TokenVersion } from "../../domain/value-objects/token-version.value-object";
import { epochOrNull } from "./identity-row.mappers";

const BackupCodeHashesSchema = z.array(z.string().min(1));

const AttemptRowSchema = z.object({ attemptCount: z.number().int().positive() });

/** The second-factor columns cleared when 2FA is switched off (rotation, MFA recovery). */
export const CLEARED_TWO_FACTOR_COLUMNS = {
	twoFactorEnabled: false,
	twoFactorSecretCiphertext: null,
	twoFactorSecretIv: null,
	twoFactorSecretKeyVersion: null,
	twoFactorLastTotpStep: null,
	mfaAssuredAt: null,
	mfaEnrolledAt: null,
} satisfies Prisma.UserUpdateManyMutationInput;

function secretOf(ciphertext: string | null, iv: string | null, keyVersion: number | null): EncryptedTotpSecret | null {
	return ciphertext === null || iv === null || keyVersion === null ? null : { ciphertext, iv, keyVersion };
}

/** Retire the account's live backup codes (soft delete, attributed to `actorId`). */
export async function retireBackupCodes(db: Prisma.TransactionClient, userId: string, actorId: string, at: EpochMs): Promise<void> {
	await db.backupCode.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true, deletedAt: at, deletedBy: actorId } });
}

export class PrismaTwoFactorEnrollmentRepository implements TwoFactorEnrollmentRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findByUserId(userId: string): Promise<TwoFactorEnrollment | null> {
		const user = await this.db.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				twoFactorEnabled: true,
				twoFactorSecretCiphertext: true,
				twoFactorSecretIv: true,
				twoFactorSecretKeyVersion: true,
				twoFactorLastTotpStep: true,
				tokenVersion: true,
			},
		});
		if (user === null) {
			return null;
		}
		const [pending, codes] = await Promise.all([
			this.db.twoFactorPendingSetup.findUnique({ where: { userId } }),
			this.db.backupCode.findMany({ where: { userId, usedAt: null, isDeleted: false }, select: { id: true, codeHash: true } }),
		]);
		return TwoFactorEnrollment.rehydrate({
			userId: user.id,
			enabled: user.twoFactorEnabled,
			secret: secretOf(user.twoFactorSecretCiphertext, user.twoFactorSecretIv, user.twoFactorSecretKeyVersion),
			lastTotpStep: user.twoFactorLastTotpStep === null ? null : Number(user.twoFactorLastTotpStep),
			pendingSetup:
				pending === null
					? null
					: {
							secret: { ciphertext: pending.secretCiphertext, iv: pending.secretIv, keyVersion: pending.secretKeyVersion },
							backupCodeHashes: BackupCodeHashesSchema.parse(pending.backupCodesHashes),
							expiresAt: epochMs(Number(pending.expiresAt)),
						},
			activeBackupCodes: codes,
			tokenVersion: TokenVersion.of(user.tokenVersion),
		});
	}

	public async save(enrollment: TwoFactorEnrollment): Promise<void> {
		for (const change of enrollment.pendingChanges) {
			await this.apply(enrollment.userId, change);
		}
	}

	private async apply(userId: string, change: TwoFactorChange): Promise<void> {
		switch (change.kind) {
			case "setup_started": {
				const setup = {
					secretCiphertext: change.setup.secret.ciphertext,
					secretIv: change.setup.secret.iv,
					secretKeyVersion: change.setup.secret.keyVersion,
					backupCodesHashes: [...change.setup.backupCodeHashes],
					expiresAt: change.setup.expiresAt,
				} satisfies Prisma.TwoFactorPendingSetupUpdateInput;
				await this.db.twoFactorPendingSetup.upsert({ where: { userId }, update: setup, create: { userId, ...setup } });
				return;
			}
			case "enabled": {
				// D16: 2FA on and the token generation move in THIS transaction (compare-and-set on both).
				const written = await this.db.user.updateMany({
					where: { id: userId, twoFactorEnabled: false, tokenVersion: change.previousTokenVersion.value },
					data: {
						twoFactorEnabled: true,
						twoFactorSecretCiphertext: change.secret.ciphertext,
						twoFactorSecretIv: change.secret.iv,
						twoFactorSecretKeyVersion: change.secret.keyVersion,
						twoFactorLastTotpStep: BigInt(change.lastTotpStep),
						mfaEnrolledAt: change.enrolledAt,
						mfaAssuredAt: change.enrolledAt,
						tokenVersion: { increment: 1 },
						updatedAt: change.enrolledAt,
					},
				});
				if (written.count !== 1) {
					throw new ConcurrentModificationError(userId);
				}
				// Backup codes are soft-deleted (business entity): the previous set stays on record.
				await retireBackupCodes(this.db, userId, userId, change.enrolledAt);
				await this.db.backupCode.createMany({ data: change.backupCodeHashes.map((codeHash: string) => ({ userId, codeHash })) });
				// Unconfirmed enrollment state is ephemeral (not a business entity).
				await this.db.twoFactorPendingSetup.deleteMany({ where: { userId } });
				return;
			}
			case "cleared": {
				const written = await this.db.user.updateMany({
					where: { id: userId, tokenVersion: change.previousTokenVersion.value },
					data: { ...CLEARED_TWO_FACTOR_COLUMNS, tokenVersion: { increment: 1 }, updatedAt: change.clearedAt },
				});
				if (written.count !== 1) {
					throw new ConcurrentModificationError(userId);
				}
				await retireBackupCodes(this.db, userId, userId, change.clearedAt);
				await this.db.twoFactorPendingSetup.deleteMany({ where: { userId } });
				return;
			}
			case "backup_code_consumed": {
				// D17: a code is consumed once — a concurrent use (or a replay) finds `usedAt` set.
				const written = await this.db.backupCode.updateMany({ where: { id: change.codeId, userId, usedAt: null, isDeleted: false }, data: { usedAt: change.consumedAt } });
				if (written.count !== 1) {
					throw new BackupCodeRejectedError();
				}
				return;
			}
			case "login_totp_accepted": {
				// D13: the step only moves forward — a replayed (or concurrently used) code is refused.
				const step = BigInt(change.timeStep);
				const written = await this.db.user.updateMany({
					where: { id: userId, OR: [{ twoFactorLastTotpStep: null }, { twoFactorLastTotpStep: { lt: step } }] },
					data: { twoFactorLastTotpStep: step, updatedAt: change.assuredAt },
				});
				if (written.count !== 1) {
					throw new InvalidTwoFactorCodeError();
				}
				return;
			}
		}
	}
}

const CHALLENGE_SELECT = {
	id: true,
	userId: true,
	purpose: true,
	clientType: true,
	deviceInfo: true,
	ipAddress: true,
	attemptCount: true,
	maxAttempts: true,
	consumedAt: true,
	expiresAt: true,
} satisfies Prisma.TwoFactorLoginChallengeSelect;

export class PrismaTwoFactorLoginChallengeRepository implements TwoFactorLoginChallengeRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findById(id: string): Promise<TwoFactorLoginChallenge | null> {
		const row = await this.db.twoFactorLoginChallenge.findUnique({ where: { id }, select: CHALLENGE_SELECT });
		if (row === null) {
			return null;
		}
		const purpose: MfaChallengePurpose = row.purpose;
		return TwoFactorLoginChallenge.rehydrate({ ...row, purpose, consumedAt: epochOrNull(row.consumedAt), expiresAt: epochMs(Number(row.expiresAt)) });
	}

	public async add(challenge: TwoFactorLoginChallenge): Promise<void> {
		const state = challenge.snapshot;
		await this.db.twoFactorLoginChallenge.create({
			data: {
				id: state.id,
				userId: state.userId,
				purpose: state.purpose,
				clientType: state.clientType,
				deviceInfo: state.deviceInfo,
				ipAddress: state.ipAddress,
				maxAttempts: state.maxAttempts,
				expiresAt: state.expiresAt,
			},
		});
	}

	public async saveConsumed(challenge: TwoFactorLoginChallenge): Promise<void> {
		const consumedAt: EpochMs | null = challenge.snapshot.consumedAt;
		if (!challenge.wasConsumed || consumedAt === null) {
			return;
		}
		// D13: honour the compare-and-set — a challenge consumed by a concurrent completion issues no second session.
		const written = await this.db.twoFactorLoginChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt } });
		if (written.count !== 1) {
			throw new MfaChallengeAlreadyUsedError();
		}
	}

	public async recordFailedAttempt(challengeId: string, now: EpochMs): Promise<FailedChallengeAttempt> {
		const nowValue = BigInt(now);
		const rows = await this.db.$queryRaw`
			UPDATE "TwoFactorLoginChallenge"
			SET "attemptCount" = "attemptCount" + 1
			WHERE id = ${challengeId} AND "consumedAt" IS NULL AND "expiresAt" >= ${nowValue} AND "attemptCount" < "maxAttempts"
			RETURNING "attemptCount"`;
		const [row] = z.array(AttemptRowSchema).parse(rows);
		return row === undefined ? null : { attemptCount: row.attemptCount };
	}
}
