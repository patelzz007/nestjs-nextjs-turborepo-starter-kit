import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { epochMs, nowEpochMs, OwnProfileSchema, type OwnProfile, type OwnProfileAvatar, type OwnProfileEditableFields } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Everything the own-profile payload is built from — the user row and its
 * avatar binding (`user_avatars` → `stored_files`), in ONE query.
 */
const OWN_PROFILE_SELECT = {
	id: true,
	email: true,
	fullName: true,
	profileVersion: true,
	createdAt: true,
	updatedAt: true,
	avatar: {
		select: {
			fileId: true,
			isDeleted: true,
			updatedAt: true,
			file: { select: { status: true, isDeleted: true, publicPath: true } },
		},
	},
} satisfies Prisma.UserSelect;

type OwnProfileRow = Prisma.UserGetPayload<{ select: typeof OWN_PROFILE_SELECT }>;

/** A Prisma client or an interactive transaction — reads run on either. */
export type OwnProfileDbClient = Pick<Prisma.TransactionClient, "user">;

/** The profile fields one update writes; an absent field is left unchanged. */
export type OwnProfileChanges = Partial<OwnProfileEditableFields>;

/**
 * The avatar a profile shows: the binding is live and its file is a live,
 * READY (scanned) public image. A soft-deleted binding or file, or one still
 * awaiting its scan verdict, is no avatar at all.
 */
function toLiveAvatar(avatar: OwnProfileRow["avatar"]): OwnProfileAvatar | null {
	if (avatar === null || avatar.isDeleted || avatar.file.isDeleted || avatar.file.status !== "READY" || avatar.file.publicPath === null) {
		return null;
	}
	return { fileId: avatar.fileId, url: avatar.file.publicPath, updatedAt: epochMs(Number(avatar.updatedAt)) };
}

function toOwnProfile(row: OwnProfileRow): OwnProfile {
	return OwnProfileSchema.parse({
		id: row.id,
		email: row.email,
		fullName: row.fullName,
		avatar: toLiveAvatar(row.avatar),
		version: row.profileVersion,
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	});
}

/** Each editable field → its column, explicitly (never a spread of client input). */
function toUserUpdate(changes: OwnProfileChanges): Prisma.UserUpdateManyMutationInput {
	return {
		...(changes.fullName === undefined ? {} : { fullName: changes.fullName }),
	};
}

/**
 * Persistence of the signed-in user's own profile. Reads and writes are always
 * scoped to one user id AND to a live (not soft-deleted) row — the update runs
 * under an RLS bypass, so the id in the `where` is the boundary.
 */
@Injectable()
export class OwnProfileRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/** The live user's profile, or `null` when the account does not exist (or is soft-deleted). */
	public async findLive(userId: string, db: OwnProfileDbClient = this.prisma): Promise<OwnProfile | null> {
		const row: OwnProfileRow | null = await db.user.findFirst({ where: { id: userId, isDeleted: false }, select: OWN_PROFILE_SELECT });
		return row === null ? null : toOwnProfile(row);
	}

	/** Whether a live account with this id exists (tells a vanished row from a stale version). */
	public async existsLive(userId: string, db: OwnProfileDbClient = this.prisma): Promise<boolean> {
		const row: { readonly id: string } | null = await db.user.findFirst({ where: { id: userId, isDeleted: false }, select: { id: true } });
		return row !== null;
	}

	/**
	 * Optimistic-lock write: applies `changes` only while the live profile is
	 * STILL at `expectedVersion` at the instant the statement runs, and moves
	 * the version forward. Two concurrent edits based on the same version cannot
	 * both win. `false` when nothing matched (stale version or no live account).
	 * Runs in the caller's transaction so the audit row commits with it.
	 */
	public async updateIfVersionMatches(tx: OwnProfileDbClient, userId: string, expectedVersion: number, changes: OwnProfileChanges): Promise<boolean> {
		const result: Prisma.BatchPayload = await tx.user.updateMany({
			where: { id: userId, isDeleted: false, profileVersion: expectedVersion },
			data: { ...toUserUpdate(changes), profileVersion: { increment: 1 }, updatedAt: nowEpochMs() },
		});
		return result.count === 1;
	}
}
