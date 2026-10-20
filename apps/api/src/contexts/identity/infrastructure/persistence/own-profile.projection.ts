import type { Prisma } from "@prisma/client";
import { epochMs, OwnProfileSchema, type OwnProfile, type OwnProfileAvatar } from "@workspace/shared";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import { IMAGE_RENDITIONS_SELECT, toImageSources } from "../../../files/public-api";

/**
 * Everything the own-profile payload is built from — the user row and its avatar binding
 * (`UserAvatar` → `StoredFile` → its renditions), in ONE query.
 */
export const OWN_PROFILE_SELECT = {
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
			file: { select: { status: true, isDeleted: true, publicPath: true, variants: IMAGE_RENDITIONS_SELECT } },
		},
	},
} satisfies Prisma.UserSelect;

type OwnProfileRow = Prisma.UserGetPayload<{ select: typeof OWN_PROFILE_SELECT }>;

/**
 * The avatar a profile shows: the binding is live and its file is a live, READY (scanned) public
 * image. A soft-deleted binding or file, or one still awaiting its scan verdict, is no avatar at all.
 */
function toLiveAvatar(avatar: OwnProfileRow["avatar"], resolve: PublicUrlResolve): OwnProfileAvatar | null {
	if (avatar === null || avatar.isDeleted || avatar.file.isDeleted || avatar.file.status !== "READY") {
		return null;
	}
	const url = resolve(avatar.file.publicPath);
	if (url === null) {
		return null;
	}
	return { fileId: avatar.fileId, url, sources: toImageSources(avatar.file.variants, resolve), updatedAt: epochMs(Number(avatar.updatedAt)) };
}

export function toOwnProfile(row: OwnProfileRow, resolve: PublicUrlResolve): OwnProfile {
	return OwnProfileSchema.parse({
		id: row.id,
		email: row.email,
		fullName: row.fullName,
		avatar: toLiveAvatar(row.avatar, resolve),
		version: row.profileVersion,
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	});
}

/** The live user's profile on `db`, or `null` (missing or soft-deleted). */
export async function readOwnProfile(db: Pick<Prisma.TransactionClient, "user">, userId: string, resolve: PublicUrlResolve): Promise<OwnProfile | null> {
	const row = await db.user.findFirst({ where: { id: userId, isDeleted: false }, select: OWN_PROFILE_SELECT });
	return row === null ? null : toOwnProfile(row, resolve);
}
