import { Injectable } from "@nestjs/common";
import type { Prisma, RefreshToken } from "@prisma/client";

import { epochMs, nowEpochMs, type EpochMs, type PaginationInput } from "@workspace/shared";

import { BaseRepository } from "../../../platform/persistence/base.repository";
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
	buildListOrderBy: (): Prisma.RefreshTokenOrderByWithRelationInput => ({ createdAt: "desc" }),
	buildListCursorOrderBy: (): Prisma.RefreshTokenOrderByWithRelationInput => ({ id: "asc" }),
	mergeListCursor: (where: Prisma.RefreshTokenWhereInput, cursorId: string): Prisma.RefreshTokenWhereInput => ({ ...where, id: { gt: cursorId } }),
	readListCursorId: (row: RefreshToken): string => row.id,
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
	 */
	public async rotateTokenIfHashMatches(
		id: string,
		expectedTokenHash: string,
		data: { readonly token: string; readonly deviceInfo: string | null; readonly ipAddress: string | null; readonly expiresAt: EpochMs },
	): Promise<RotateTokenResult> {
		const now: number = nowEpochMs();

		const updated = await this.prisma.refreshToken.updateMany({
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
			return "rotated";
		}

		const current = await this.findByIdIncludingDeleted(id);
		if (current === null || current.isDeleted) {
			return "missing";
		}

		const supersededGraceMs = 30_000;
		if (current.updatedAt >= now - supersededGraceMs && current.token !== expectedTokenHash) {
			return "superseded";
		}

		return "missing";
	}

	public async revokeAllForUsers(userIds: readonly string[]): Promise<void> {
		if (userIds.length === 0) {
			return;
		}
		const now: number = nowEpochMs();
		await this.prisma.refreshToken.updateMany({
			where: { userId: { in: [...userIds] }, isDeleted: false },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
	}

	public async revokeById(id: string): Promise<void> {
		const now: number = nowEpochMs();
		await this.prisma.refreshToken.update({
			where: { id },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
	}
}
