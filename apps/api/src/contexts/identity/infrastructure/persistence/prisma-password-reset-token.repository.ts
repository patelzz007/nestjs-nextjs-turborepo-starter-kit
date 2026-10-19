import type { Prisma } from "@prisma/client";
import { epochMs, type EpochMs } from "@workspace/shared";

import { PasswordResetToken } from "../../domain/entities/password-reset-token.entity";
import { PasswordResetTokenInvalidError } from "../../domain/errors/identity.errors";
import type { PasswordResetTokenRepository } from "../../domain/repositories/password-reset-token.repository";
import { epochOrNull } from "./identity-row.mappers";

export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findUsableByDigest(tokenDigest: string, now: EpochMs): Promise<PasswordResetToken | null> {
		const row = await this.db.passwordResetToken.findFirst({
			where: { tokenDigest, usedAt: null, expiresAt: { gte: now }, isDeleted: false },
			select: { id: true, userId: true, token: true, tokenDigest: true, expiresAt: true, usedAt: true },
		});
		if (row?.tokenDigest == null) {
			return null;
		}
		return PasswordResetToken.rehydrate({
			id: row.id,
			userId: row.userId,
			tokenHash: row.token,
			tokenDigest: row.tokenDigest,
			expiresAt: epochMs(Number(row.expiresAt)),
			usedAt: epochOrNull(row.usedAt),
		});
	}

	public async expireOpenTokensOf(userId: string, now: EpochMs): Promise<void> {
		await this.db.passwordResetToken.updateMany({ where: { userId, usedAt: null, expiresAt: { gte: now } }, data: { expiresAt: now, updatedAt: now } });
	}

	public async add(token: PasswordResetToken): Promise<void> {
		const state = token.snapshot;
		await this.db.passwordResetToken.create({
			data: { id: state.id, userId: state.userId, token: state.tokenHash, tokenDigest: state.tokenDigest, expiresAt: state.expiresAt },
		});
	}

	public async saveConsumed(token: PasswordResetToken): Promise<void> {
		const usedAt: EpochMs | null = token.snapshot.usedAt;
		if (usedAt === null) {
			return;
		}
		// D12: the compare-and-set on `used_at IS NULL` — of two resets presenting the same token, one wins.
		const written = await this.db.passwordResetToken.updateMany({
			where: { id: token.id, usedAt: null, isDeleted: false, expiresAt: { gte: usedAt } },
			data: { usedAt, updatedAt: usedAt },
		});
		if (written.count !== 1) {
			throw new PasswordResetTokenInvalidError();
		}
	}

	public async retireStale(now: EpochMs, usedRetentionMs: number, expiredGraceMs: number): Promise<number> {
		// Soft-delete (never DELETE): a retired token keeps its row for the audit trail.
		const result = await this.db.passwordResetToken.updateMany({
			where: { isDeleted: false, OR: [{ usedAt: { not: null, lte: now - usedRetentionMs } }, { expiresAt: { lte: now - expiredGraceMs } }] },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
		return result.count;
	}
}
