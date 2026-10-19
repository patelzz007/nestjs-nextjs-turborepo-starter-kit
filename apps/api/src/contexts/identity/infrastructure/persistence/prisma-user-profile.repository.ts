import type { Prisma } from "@prisma/client";
import { nowEpochMs, type OwnProfile } from "@workspace/shared";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import { ConcurrentModificationError } from "../../../../platform/infrastructure/persistence/persistence.errors";
import { UserProfile } from "../../domain/aggregates/user-profile.aggregate";
import { ProfileNotFoundError } from "../../domain/errors/identity.errors";
import type { UserProfileRepository } from "../../domain/repositories/user-profile.repository";
import { readOwnProfile } from "./own-profile.projection";

/**
 * Own profiles. Reads and writes are always scoped to one user id AND a live row — the edit runs under
 * an RLS bypass (`auth.profile.update`), so the id in the `where` is the boundary.
 */
export class PrismaUserProfileRepository implements UserProfileRepository {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly resolvePublicUrl: PublicUrlResolve,
	) {}

	public async findLive(userId: string): Promise<UserProfile | null> {
		const row = await this.db.user.findFirst({ where: { id: userId, isDeleted: false }, select: { id: true, fullName: true, profileVersion: true } });
		return row === null ? null : UserProfile.rehydrate({ userId: row.id, fullName: row.fullName, version: row.profileVersion });
	}

	public readOwnProfile(userId: string): Promise<OwnProfile | null> {
		return readOwnProfile(this.db, userId, this.resolvePublicUrl);
	}

	public async save(profile: UserProfile): Promise<void> {
		const changes = profile.changes;
		if (changes === null) {
			return;
		}
		// Optimistic lock: applies only while the live profile is STILL at the version the client read.
		const written = await this.db.user.updateMany({
			where: { id: profile.userId, isDeleted: false, profileVersion: profile.concurrencyToken },
			data: { ...(changes.fullName === undefined ? {} : { fullName: changes.fullName }), profileVersion: { increment: 1 }, updatedAt: nowEpochMs() },
		});
		if (written.count === 1) {
			return;
		}
		const live = await this.db.user.findFirst({ where: { id: profile.userId, isDeleted: false }, select: { id: true } });
		throw live === null ? new ProfileNotFoundError(profile.userId) : new ConcurrentModificationError(profile.userId);
	}
}
