import { Injectable } from "@nestjs/common";
import type { Prisma, RefreshToken } from "@prisma/client";

import { epochMs, nowEpochMs, type EpochMs, type PaginationInput } from "@workspace/shared";

import { BaseRepository } from "../../../platform/persistence/base.repository";
import type { ListOrder } from "../../../platform/persistence/list-query/list-order";
import type { EmptyMutationInput } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

export interface RefreshTokenSession {
	readonly id: string;
	readonly deviceInfo: string | null;
	readonly ipAddress: string | null;
	readonly createdAt: EpochMs;
	readonly expiresAt: EpochMs;
}

function toDomain(row: RefreshToken): RefreshToken {
	return row;
}

function toCreateInput(_input: EmptyMutationInput): Prisma.RefreshTokenCreateInput {
	throw new Error("RefreshTokenRepository.create is not supported");
}

function toUpdateInput(_input: EmptyMutationInput): Prisma.RefreshTokenUpdateInput {
	throw new Error("RefreshTokenRepository.update via ports is not supported");
}

const RefreshTokenRepositoryPorts = {
	toDomain,
	toCreateInput,
	toUpdateInput,
	buildListWhere: (_query: PaginationInput): Prisma.RefreshTokenWhereInput => ({
		isDeleted: false,
		expiresAt: { gte: Date.now() },
	}),
	// Internal read (no HTTP list query): newest first, offset pages only.
	buildListOrder: (): ListOrder<Prisma.RefreshTokenOrderByWithRelationInput> => ({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], isDefault: true }),
	andWhere: (left: Prisma.RefreshTokenWhereInput, right: Prisma.RefreshTokenWhereInput): Prisma.RefreshTokenWhereInput => ({ AND: [left, right] }),
	buildFindByIdWhere: (id: string): Prisma.RefreshTokenWhereInput => ({ id, isDeleted: false }),
	buildUpdateWhere: (id: string): Prisma.RefreshTokenWhereUniqueInput => ({ id }),
	stampUpdate: (data: Prisma.RefreshTokenUpdateInput): Prisma.RefreshTokenUpdateInput => ({ ...data, updatedAt: nowEpochMs() }),
	stampSoftDelete: (): Prisma.RefreshTokenUpdateInput => ({ isDeleted: true, deletedAt: nowEpochMs(), updatedAt: nowEpochMs() }),
	stampRestore: (): Prisma.RefreshTokenUpdateInput => ({ isDeleted: false, deletedAt: null, updatedAt: nowEpochMs() }),
};

export type RotateTokenResult = "rotated" | "superseded" | "missing";

@Injectable()
export class RefreshTokenRepository extends BaseRepository<
	RefreshToken,
	EmptyMutationInput,
	EmptyMutationInput,
	PaginationInput,
	RefreshToken,
	Prisma.RefreshTokenWhereInput,
	Prisma.RefreshTokenOrderByWithRelationInput,
	Prisma.RefreshTokenCreateInput,
	Prisma.RefreshTokenUpdateInput,
	Prisma.RefreshTokenWhereUniqueInput
> {
	public constructor(prisma: PrismaService) {
		super(prisma, RefreshTokenRepositoryPorts, prisma.refreshToken, { softDelete: true, concurrency: false });
	}

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

	public async rotateToken(
		id: string,
		data: { readonly token: string; readonly deviceInfo: string | null; readonly ipAddress: string | null; readonly expiresAt: EpochMs },
	): Promise<void> {
		await this.prisma.refreshToken.update({
			where: { id },
			data: {
				token: data.token,
				deviceInfo: data.deviceInfo,
				ipAddress: data.ipAddress,
				expiresAt: data.expiresAt,
				updatedAt: nowEpochMs(),
			},
		});
	}

	/**
	 * Atomically rotate a refresh token only when the stored hash still matches.
	 * Returns `superseded` when another request already rotated the token recently.
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

			const supersededGraceMs = 30_000;
			if (current.updatedAt >= now - supersededGraceMs && current.token !== expectedTokenHash) {
				return "superseded";
			}

			return "missing";
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

	/** Soft-delete one refresh token; `withinTransaction` (the caller's outbox event) commits with it. */
	public async revokeById(id: string, withinTransaction: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
		const now: number = nowEpochMs();
		await this.prisma.$transaction(async (tx): Promise<void> => {
			await tx.refreshToken.update({
				where: { id },
				data: { isDeleted: true, deletedAt: now, updatedAt: now },
			});
			await withinTransaction(tx);
		});
	}
}
