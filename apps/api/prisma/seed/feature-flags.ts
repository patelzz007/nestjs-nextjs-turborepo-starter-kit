// Runtime feature flags (enhancement 5.6): the component gallery set ON (what a development build defaults to
// anyway), merchant invites back on DEFAULT, and the gallery's earlier 50% rollout kept as a removed row.
// Per-store settings (enhancement 5.11): till redemption on for every Jonker Street Kitchen branch, but off at
// its Bukit Katil branch (a branch decides over its merchant), and an earlier Bukit Katil setting kept removed.

import type { Prisma } from "@prisma/client";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";

const NAMESPACE = "feature-flags";
const DAY_MS = 86_400_000;

export async function seedFeatureFlags(now: number): Promise<number> {
	const superAdmin = await prisma.user.findFirstOrThrow({ where: { email: "superadmin@example.com", isDeleted: false }, select: { id: true } });
	const developer = await prisma.user.findFirstOrThrow({ where: { email: "developer@example.com", isDeleted: false }, select: { id: true } });
	const rows: Prisma.FeatureFlagSettingUncheckedCreateInput[] = [
		{
			id: deterministicUuid(NAMESPACE, "component-gallery:rollout"),
			key: "component-gallery",
			mode: "PERCENTAGE",
			percentage: 50,
			reason: "Trying the gallery with half of the staff first",
			createdBy: developer.id,
			updatedBy: developer.id,
			createdAt: BigInt(now - 14 * DAY_MS),
			updatedAt: BigInt(now - 14 * DAY_MS),
			isDeleted: true,
			deletedAt: BigInt(now - 7 * DAY_MS),
			deletedBy: superAdmin.id,
		},
		{
			id: deterministicUuid(NAMESPACE, "component-gallery"),
			key: "component-gallery",
			mode: "ON",
			percentage: null,
			reason: "Everyone on staff uses the gallery now",
			createdBy: superAdmin.id,
			updatedBy: superAdmin.id,
			createdAt: BigInt(now - 7 * DAY_MS),
			updatedAt: BigInt(now - 7 * DAY_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "merchant-invites"),
			key: "merchant-invites",
			mode: "DEFAULT",
			percentage: null,
			reason: "Back to the deployment's own setting after the onboarding drive",
			createdBy: superAdmin.id,
			updatedBy: developer.id,
			createdAt: BigInt(now - 3 * DAY_MS),
			updatedAt: BigInt(now - DAY_MS),
		},
	];
	for (const row of rows) {
		await prisma.featureFlagSetting.upsert({ where: { id: row.id ?? "" }, update: {}, create: row });
	}
	const overrides: Prisma.FeatureFlagStoreOverrideUncheckedCreateInput[] = [
		{
			id: deterministicUuid(NAMESPACE, "till-redemption:jonker"),
			key: "till-redemption",
			tenantId: TENANT_SEED_IDS.mlkTenant,
			locationId: null,
			enabled: true,
			reason: "Every Jonker Street Kitchen branch redeems at its tills",
			createdBy: superAdmin.id,
			updatedBy: superAdmin.id,
			createdAt: BigInt(now - 10 * DAY_MS),
			updatedAt: BigInt(now - 10 * DAY_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "till-redemption:jonker-katil:earlier"),
			key: "till-redemption",
			tenantId: TENANT_SEED_IDS.mlkTenant,
			locationId: TENANT_SEED_IDS.mlkLocationKatil,
			enabled: false,
			reason: "Bukit Katil's till was being repaired",
			createdBy: developer.id,
			updatedBy: developer.id,
			createdAt: BigInt(now - 9 * DAY_MS),
			updatedAt: BigInt(now - 9 * DAY_MS),
			isDeleted: true,
			deletedAt: BigInt(now - 6 * DAY_MS),
			deletedBy: superAdmin.id,
		},
		{
			id: deterministicUuid(NAMESPACE, "till-redemption:jonker-katil"),
			key: "till-redemption",
			tenantId: TENANT_SEED_IDS.mlkTenant,
			locationId: TENANT_SEED_IDS.mlkLocationKatil,
			enabled: false,
			reason: "Bukit Katil's tills are being replaced this week",
			createdBy: superAdmin.id,
			updatedBy: superAdmin.id,
			createdAt: BigInt(now - 2 * DAY_MS),
			updatedAt: BigInt(now - 2 * DAY_MS),
		},
	];
	for (const row of overrides) {
		// One live setting per flag and store: a store someone has since set (a test, an admin) keeps theirs.
		const taken =
			row.isDeleted !== true &&
			(await prisma.featureFlagStoreOverride.findFirst({
				where: { key: row.key, tenantId: row.tenantId, locationId: row.locationId ?? null, isDeleted: false, NOT: { id: row.id ?? "" } },
				select: { id: true },
			})) !== null;
		if (!taken) {
			await prisma.featureFlagStoreOverride.upsert({ where: { id: row.id ?? "" }, update: {}, create: row });
		}
	}
	return rows.length + overrides.length;
}
