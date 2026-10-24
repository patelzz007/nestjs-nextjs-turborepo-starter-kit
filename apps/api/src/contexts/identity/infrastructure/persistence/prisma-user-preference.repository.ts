import type { Prisma } from "@prisma/client";
import { UserPreferenceSchema, type UserPreference, type UserPreferenceKey, type UserPreferenceValue } from "@workspace/shared";

import type { UserPreferenceRepository } from "../../domain/repositories/user-preference.repository";

/** {@link UserPreferenceRepository} over Prisma, bound to the unit of work's transaction. */
export class PrismaUserPreferenceRepository implements UserPreferenceRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/** One `INSERT … ON CONFLICT` on the partial unique index: a concurrent write updates the row the other created instead of failing. */
	public async set(id: string, userId: string, key: UserPreferenceKey, value: UserPreferenceValue): Promise<UserPreference> {
		const json = JSON.stringify(value);
		const rows = await this.db.$queryRaw<{ readonly key: string; readonly value: Prisma.JsonValue; readonly version: number }[]>`
			INSERT INTO "UserPreference" ("id", "userId", "key", "value")
			VALUES (${id}, ${userId}, ${key}, ${json}::jsonb)
			ON CONFLICT ("userId", "key") WHERE "isDeleted" = false
			DO UPDATE SET "value" = EXCLUDED."value", "version" = "UserPreference"."version" + 1,
				"updatedAt" = ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint
			RETURNING "key", "value", "version"`;
		const [row] = rows;
		return UserPreferenceSchema.parse(row);
	}

	public async reset(userId: string, key: UserPreferenceKey, deletedBy: string, deletedAt: number): Promise<void> {
		await this.db.userPreference.updateMany({ where: { userId, key, isDeleted: false }, data: { isDeleted: true, deletedAt: BigInt(deletedAt), deletedBy } });
	}
}
