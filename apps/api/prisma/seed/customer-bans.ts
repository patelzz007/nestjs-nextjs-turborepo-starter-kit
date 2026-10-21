import { DAY_MS } from "@workspace/shared";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { EXTRA_SEED_USER_EMAILS } from "./extra-users";
import { REWARD_SEED_IDS } from "./rewards";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";

const NAMESPACE = "seed.customer-bans";

/** How long before the seed run the active ban was made, and the lifted one made and lifted. */
const ACTIVE_BAN_DAYS_AGO = 2;
const LIFTED_BAN_DAYS_AGO = 20;
const LIFTED_AFTER_DAYS = 3;

/** Bans need two different customers; the analytics history gives every extra customer some redemptions. */
const CUSTOMERS_NEEDED = 2;

/**
 * Brew & Bean KL's customer bans, as `POST /tenants/:tenantSlug/customer-bans` and its lift write them:
 * one active ban and one lifted ban, each made from one of the customer's redemptions. Only the
 * generated extra customers are banned, never an account an e2e suite claims or redeems with.
 * Every column is written, so the banned-customers page, the redemption log's badge and the lift
 * history all have data. Re-running converges (rows are upserted by id).
 */
export async function seedCustomerBans(now: number): Promise<number> {
	const tenantId = TENANT_SEED_IDS.klTenant;
	const redemptions = await prisma.rewardRedemption.findMany({
		where: { tenantId, isDeleted: false, user: { email: { in: [...EXTRA_SEED_USER_EMAILS] } } },
		orderBy: { id: "asc" },
		select: { id: true, userId: true },
	});
	const firstPerCustomer = [...new Map(redemptions.map((row): [string, typeof row] => [row.userId, row])).values()].slice(0, CUSTOMERS_NEEDED);
	const [active, lifted] = firstPerCustomer;
	if (active === undefined || lifted === undefined) {
		return 0;
	}
	const bannedBy = REWARD_SEED_IDS.klOwnerUser;
	const activeAt = now - ACTIVE_BAN_DAYS_AGO * DAY_MS;
	const liftedBannedAt = now - LIFTED_BAN_DAYS_AGO * DAY_MS;
	const liftedAt = liftedBannedAt + LIFTED_AFTER_DAYS * DAY_MS;
	const rows = [
		{
			id: deterministicUuid(NAMESPACE, "active"),
			tenantId,
			customerUserId: active.userId,
			sourceRedemptionId: active.id,
			reason: "Tried to redeem the same voucher twice by showing a screenshot to two cashiers.",
			bannedByUserId: bannedBy,
			bannedAt: activeAt,
			liftedByUserId: null,
			liftedAt: null,
			createdAt: activeAt,
			createdBy: bannedBy,
			updatedAt: activeAt,
			updatedBy: bannedBy,
			isDeleted: false,
			deletedAt: null,
			deletedBy: null,
		},
		{
			id: deterministicUuid(NAMESPACE, "lifted"),
			tenantId,
			customerUserId: lifted.userId,
			sourceRedemptionId: lifted.id,
			reason: "Argued with staff over an expired reward.",
			bannedByUserId: bannedBy,
			bannedAt: liftedBannedAt,
			liftedByUserId: bannedBy,
			liftedAt,
			createdAt: liftedBannedAt,
			createdBy: bannedBy,
			updatedAt: liftedAt,
			updatedBy: bannedBy,
			isDeleted: false,
			deletedAt: null,
			deletedBy: null,
		},
	];
	for (const row of rows) {
		await prisma.tenantCustomerBan.upsert({ where: { id: row.id }, create: row, update: row });
	}
	return rows.length;
}
