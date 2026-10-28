// Tenant access seed rows (ADR 067): each tenant's role copies, and a demo of the two
// things a tenant hands out on top of a role — grants (permanent or temporary) and
// one-record shares — so every new column has a row and the screens have data.

import type { AclEffect, PermissionAction, PermissionResource, Prisma, ShareLevel } from "@prisma/client";

import { TenantRoleCopies } from "../../src/contexts/authorization/public-api";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { REWARD_SEED_IDS } from "./rewards";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";
import { upsertSeedGrant } from "./tenant-roles";

const HOUR_MS = 60 * 60 * 1000;
/** The temporary grant runs out 48 hours after the seed (the "48 h for a cashier" case). */
const TEMPORARY_GRANT_HOURS = 48;
/** The temporary share runs out a week after the seed. */
const TEMPORARY_SHARE_HOURS = 7 * 24;
/** The lapsed grant ended this long before the seed: shown, but no longer in force. */
const LAPSED_GRANT_HOURS_AGO = 6;

export interface TenantAccessSeedSummary {
	readonly tenantsProvisioned: number;
	readonly grants: number;
	readonly shares: number;
}

interface DemoGrant {
	readonly key: string;
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
	readonly locationId: string | null;
	readonly expiresAt: bigint | null;
	readonly effect: AclEffect;
	readonly lapsed: boolean;
}

/**
 * Every tenant gets its role copies; the KL cashier gets three grants from the KL owner — analytics for
 * 48 hours, customer bans permanently at the KL store, and a lapsed one — and one reward shared to
 * edit for a week. Runs after the tenants, memberships and rewards exist.
 */
export async function seedTenantAccess(): Promise<TenantAccessSeedSummary> {
	const tenants = await prisma.tenant.findMany({ select: { id: true } });
	for (const tenant of tenants) {
		await new TenantRoleCopies(prisma).provision(tenant.id, null);
	}

	const owner = await prisma.membership.findUniqueOrThrow({ where: { id: TENANT_SEED_IDS.klOwnerMembership }, include: { tenantRole: true } });
	const cashier = await prisma.membership.findUniqueOrThrow({ where: { id: TENANT_SEED_IDS.klCashierMembership } });
	const now = Date.now();
	const at = (hours: number): bigint => BigInt(now + hours * HOUR_MS);

	const demoGrants: readonly DemoGrant[] = [
		{ key: "temporary", action: "READ", resource: "ANALYTICS", locationId: null, expiresAt: at(TEMPORARY_GRANT_HOURS), effect: "ALLOW", lapsed: false },
		{ key: "permanent", action: "CREATE", resource: "CUSTOMER_BAN", locationId: TENANT_SEED_IDS.klLocation, expiresAt: null, effect: "ALLOW", lapsed: false },
		{ key: "lapsed", action: "READ", resource: "MEMBER", locationId: null, expiresAt: at(-LAPSED_GRANT_HOURS_AGO), effect: "ALLOW", lapsed: true },
	];
	for (const grant of demoGrants) {
		const permission = await prisma.permission.findFirstOrThrow({ where: { action: grant.action, resource: grant.resource, scope: "GLOBAL", isDeleted: false } });
		const assignedAt = BigInt(now);
		await upsertSeedGrant(prisma, {
			userId: cashier.userId,
			permissionId: permission.id,
			tenantId: TENANT_SEED_IDS.klTenant,
			data: {
				id: deterministicUuid("tenant-grant", `kl-cashier:${grant.key}`),
				effect: grant.effect,
				locationId: grant.locationId,
				expiresAt: grant.expiresAt,
				assignedAt,
				assignedBy: owner.userId,
				grantedVia: owner.tenantRole.name,
				createdBy: owner.userId,
				updatedBy: owner.userId,
				// The hourly expiry job retires a lapsed grant; the seed writes it as that job would have.
				isDeleted: grant.lapsed,
				deletedAt: grant.lapsed ? grant.expiresAt : null,
				deletedBy: grant.lapsed ? "maintenance.permission_expiry" : null,
			},
		});
	}

	const level: ShareLevel = "EDIT";
	const shareId = deterministicUuid("tenant-share", "kl-cashier:reward");
	const share = {
		subjectType: "MEMBERSHIP",
		subjectId: cashier.id,
		membershipId: cashier.id,
		action: level,
		level,
		resourceType: "REWARD",
		resourceId: REWARD_SEED_IDS.klRewardPending,
		effect: "ALLOW",
		scope: null,
		tenantId: TENANT_SEED_IDS.klTenant,
		locationId: null,
		expiresAt: at(TEMPORARY_SHARE_HOURS),
		assignedBy: owner.userId,
		reason: "Help finish the weekend brunch reward",
		createdBy: owner.userId,
		updatedBy: owner.userId,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
	} satisfies Omit<Prisma.ResourceAclUncheckedCreateInput, "id">;
	await prisma.resourceAcl.upsert({ where: { id: shareId }, create: { id: shareId, ...share }, update: share });

	return { tenantsProvisioned: tenants.length, grants: demoGrants.length, shares: 1 };
}
