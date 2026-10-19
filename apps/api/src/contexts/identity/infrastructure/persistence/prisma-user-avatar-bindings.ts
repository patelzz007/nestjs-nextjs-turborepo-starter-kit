import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { UserAvatarBindings, UserAvatarFileScope } from "../../application/ports/user-avatar-bindings.port";
import { newRowId } from "@workspace/shared";

class PrismaUserAvatarBindings implements UserAvatarBindings {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/** `userId` is unique: the upsert replaces the previous avatar and revives a released row. */
	public async bindReadyAvatar(userId: string, fileId: string, boundAt: number): Promise<void> {
		await this.db.userAvatar.upsert({
			where: { userId },
			create: { id: newRowId(), userId, fileId },
			update: { fileId, isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: BigInt(boundAt) },
		});
	}

	public async releaseFile(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		const at = BigInt(deletedAt);
		await this.db.userAvatar.updateMany({ where: { fileId, isDeleted: false }, data: { isDeleted: true, deletedAt: at, deletedBy, updatedAt: at } });
	}
}

/** Binds identity's avatar rows to the files transaction that reacts to a file event. Never cached. */
export class UserAvatarFileScopeFactory implements ScopeFactory<UserAvatarFileScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient): UserAvatarFileScope {
		return { avatars: new PrismaUserAvatarBindings(db) };
	}
}
