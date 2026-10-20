import type { Membership, MembershipRole, MembershipStatus, Prisma } from "@prisma/client";
import { TenantMemberDisplayNameSchema } from "@workspace/shared";

import { prisma } from "./client";

/** Every seed membership is an active one. */
const SEED_MEMBERSHIP_STATUS: MembershipStatus = "ACTIVE";

/** One seed membership: a deterministic id plus the (tenant, user) it binds. */
export interface SeedMembershipInput {
	readonly id: string;
	readonly tenantId: string;
	readonly userId: string;
	readonly role: MembershipRole;
	/** The member's own display name (`PATCH /tenants/:tenantSlug/members/me`); `null` = none; omitted = left as it is. */
	readonly displayName?: string | null;
	readonly createdAt?: bigint;
}

/** The seed membership row the transaction writes through (Prisma's interactive transaction client). */
type SeedMembershipClient = Pick<Prisma.TransactionClient, "membership">;

/**
 * Converge the ONE live membership of (tenant, user) onto `input.id`.
 *
 * `Membership` is unique on (tenant_id, user_id) only for
 * LIVE rows (a partial index — soft-deleted rows are ignored), so a plain
 * `upsert` on that key cannot be expressed (Postgres needs the index
 * predicate for ON CONFLICT). Mirroring the app's own write path, the seed
 * reads the live row first: a live row under a different id (an earlier run, or
 * an app-created membership) is soft-deleted — never hard-deleted — and the
 * seed row is then upserted by its primary key. Runs in one transaction, so a
 * re-run is idempotent on fresh and already-seeded databases alike.
 */
export async function upsertLiveSeedMembership(input: SeedMembershipInput): Promise<Membership> {
	return prisma.$transaction(async (tx: SeedMembershipClient): Promise<Membership> => {
		const live = await tx.membership.findFirst({
			where: { tenantId: input.tenantId, userId: input.userId, isDeleted: false },
			select: { id: true },
		});
		if (live !== null && live.id !== input.id) {
			await tx.membership.update({
				where: { id: live.id },
				data: { isDeleted: true, deletedAt: BigInt(Date.now()) },
			});
		}

		const state = {
			tenantId: input.tenantId,
			userId: input.userId,
			role: input.role,
			status: SEED_MEMBERSHIP_STATUS,
			// Same rule as the API: trimmed, 1–100 characters (TenantOwnMembershipUpdateSchema).
			...(input.displayName === undefined ? {} : { displayName: input.displayName === null ? null : TenantMemberDisplayNameSchema.parse(input.displayName) }),
		};
		return tx.membership.upsert({
			where: { id: input.id },
			create: { id: input.id, ...state, ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }) },
			update: { ...state, isDeleted: false, deletedAt: null },
		});
	});
}
