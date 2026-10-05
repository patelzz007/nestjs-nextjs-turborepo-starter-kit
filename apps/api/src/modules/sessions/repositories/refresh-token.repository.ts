import { Injectable } from "@nestjs/common";
import type { Prisma, RefreshToken } from "@prisma/client";

import { epochMs, nowEpochMs, type EpochMs } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { REFRESH_SUPERSEDED_GRACE_MS } from "../constants/refresh-token-rotation.constants";

export interface RefreshTokenSession {
	readonly id: string;
	readonly deviceInfo: string | null;
	readonly ipAddress: string | null;
	readonly createdAt: EpochMs;
	readonly expiresAt: EpochMs;
}

/**
 * Outcome of {@link RefreshTokenRepository.rotateTokenIfHashMatches}:
 * - `rotated` — this call rotated the token.
 * - `superseded` — a concurrent request rotated it first and the presented
 *   token is the IMMEDIATE predecessor of the new one, within
 *   {@link REFRESH_SUPERSEDED_GRACE_MS} (a benign race).
 * - `reused` — the token moved on, and the presented token is not its immediate
 *   predecessor inside the grace window: treat as token theft.
 * - `missing` — the session is gone (revoked, expired, or deleted).
 */
export type RotateTokenResult = "rotated" | "superseded" | "reused" | "missing";

@Injectable()
export class RefreshTokenRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findByIdIncludingDeleted(id: string): Promise<RefreshToken | null> {
		return this.prisma.refreshToken.findUnique({ where: { id } });
	}

	public async listActiveSessionsForUser(userId: string): Promise<RefreshTokenSession[]> {
		const tokens = await this.prisma.refreshToken.findMany({
			where: {
				userId,
				isDeleted: false,
				expiresAt: { gte: Date.now() },
			},
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				deviceInfo: true,
				ipAddress: true,
				createdAt: true,
				expiresAt: true,
			},
		});

		return tokens.map((token) => ({
			id: token.id,
			deviceInfo: token.deviceInfo,
			ipAddress: token.ipAddress,
			createdAt: epochMs(Number(token.createdAt)),
			expiresAt: epochMs(Number(token.expiresAt)),
		}));
	}

	/**
	 * Atomically rotate a refresh token only when the stored hash still matches
	 * (compare-and-set). See {@link RotateTokenResult} for the outcomes.
	 * `onRotated` (the caller's outbox event) runs inside the same transaction,
	 * only when this call performed the rotation.
	 */
	public async rotateTokenIfHashMatches(
		id: string,
		expectedTokenHash: string,
		data: { readonly token: string; readonly deviceInfo: string | null; readonly ipAddress: string | null; readonly expiresAt: EpochMs },
		onRotated: (tx: Prisma.TransactionClient) => Promise<void>,
	): Promise<RotateTokenResult> {
		const now: number = nowEpochMs();

		return this.prisma.$transaction(async (tx): Promise<RotateTokenResult> => {
			const updated = await tx.refreshToken.updateMany({
				where: {
					id,
					token: expectedTokenHash,
					isDeleted: false,
					expiresAt: { gte: now },
				},
				data: {
					previousTokenHash: expectedTokenHash,
					token: data.token,
					deviceInfo: data.deviceInfo,
					ipAddress: data.ipAddress,
					expiresAt: data.expiresAt,
					rotationVersion: { increment: 1 },
					updatedAt: now,
				},
			});

			if (updated.count === 1) {
				await onRotated(tx);
				return "rotated";
			}

			const current = await tx.refreshToken.findUnique({ where: { id } });
			if (current === null || current.isDeleted) {
				return "missing";
			}

			if (current.token === expectedTokenHash) {
				// Same hash, but the conditional update did not match: the token expired.
				return "missing";
			}

			const isImmediatePredecessor: boolean = current.previousTokenHash === expectedTokenHash;
			const isWithinGrace: boolean = current.updatedAt >= now - REFRESH_SUPERSEDED_GRACE_MS;
			return isImmediatePredecessor && isWithinGrace ? "superseded" : "reused";
		});
	}

	/** Soft-delete every active refresh token of `userIds` (pass `db` to join a caller's transaction). */
	public async revokeAllForUsers(userIds: readonly string[], db: Prisma.TransactionClient = this.prisma): Promise<void> {
		if (userIds.length === 0) {
			return;
		}
		const now: number = nowEpochMs();
		await db.refreshToken.updateMany({
			where: { userId: { in: [...userIds] }, isDeleted: false },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
	}

	/**
	 * Soft-delete one LIVE refresh token owned by `userId`. Returns `true` only
	 * when this call revoked it; an unknown, foreign, or already-revoked token
	 * returns `false` and `withinTransaction` (the caller's outbox event) does
	 * not run. When it does run, it commits atomically with the revocation.
	 */
	public async revokeLiveToken(id: string, userId: string, withinTransaction: (tx: Prisma.TransactionClient) => Promise<void>): Promise<boolean> {
		const now: number = nowEpochMs();
		return this.prisma.$transaction(async (tx): Promise<boolean> => {
			const revoked = await tx.refreshToken.updateMany({
				where: { id, userId, isDeleted: false },
				data: { isDeleted: true, deletedAt: now, updatedAt: now },
			});
			if (revoked.count !== 1) {
				return false;
			}
			await withinTransaction(tx);
			return true;
		});
	}
}
