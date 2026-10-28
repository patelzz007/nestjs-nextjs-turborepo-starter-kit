import type { Prisma } from "@prisma/client";
import { DAY_MS } from "@workspace/shared";

import { deterministicUuid } from "./deterministic-uuid";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";
import { buildProductSeedId } from "./products";
import { REWARD_SEED_IDS } from "./rewards";

const ACL_NAMESPACE = "kernel-seed-acl";
/** The seeded product the location-scoped ACL targets (a `PRODUCT` / `UPDATE` check is what `FileAuthorizationService` runs for product images). */
const ACL_TARGET_PRODUCT_SEQUENCE = 1;

/** Fixed ids of the kernel seed rows the unit test (and docs) refer to. */
export const KERNEL_SEED_IDS = Object.freeze({
	productScopedAcl: deterministicUuid(ACL_NAMESPACE, "mlk-cashier-archived-product-update"),
	retiredAcl: deterministicUuid(ACL_NAMESPACE, "retired-kl-owner-payment-read"),
	productTarget: buildProductSeedId(ACL_TARGET_PRODUCT_SEQUENCE),
});

export interface KernelSeedActors {
	readonly adminUserId: string;
	readonly managerUserId: string;
	readonly userRoleId: string;
	readonly managerRoleId: string;
}

/** A create input whose id is always set (seeds upsert by it). */
export type WithId<TInput extends { id?: string }> = Omit<TInput, "id"> & { readonly id: string };

export interface KernelSeedRows {
	readonly acls: readonly WithId<Prisma.ResourceAclUncheckedCreateInput>[];
}

/**
 * Every legacy `ResourceAcl` seed row, deterministic ids so the seed upserts
 * (idempotent). Nothing decides with these rows any more (ADR 067: shares are
 * the per-record path); they keep every column of the table seeded until the
 * legacy ACL columns are dropped. The tenant-bound rows use the Jonker Street Kitchen tenant / Bukit Beruang
 * location, so they only apply inside that server-verified tenant.
 */
export function buildKernelSeedRows(actors: KernelSeedActors, now: number): KernelSeedRows {
	const acl = (key: string, row: Omit<Prisma.ResourceAclUncheckedCreateInput, "id">): WithId<Prisma.ResourceAclUncheckedCreateInput> => ({
		id: deterministicUuid(ACL_NAMESPACE, key),
		...row,
	});

	const acls: WithId<Prisma.ResourceAclUncheckedCreateInput>[] = [
		acl("admin-delete-users", {
			subjectType: "USER",
			subjectId: actors.adminUserId,
			action: "DELETE",
			resourceType: "USER",
			resourceId: null,
			scope: "GLOBAL",
			effect: "ALLOW",
			reason: "Admin explicitly allowed to delete users globally",
			assignedBy: actors.adminUserId,
		}),
		acl("manager-create-tenants", {
			subjectType: "USER",
			subjectId: actors.managerUserId,
			action: "CREATE",
			resourceType: "TENANT",
			resourceId: null,
			scope: "TENANT",
			effect: "DENY",
			reason: "Manager explicitly denied from creating tenants",
			assignedBy: actors.adminUserId,
		}),
		acl("user-role-read-locations", {
			subjectType: "ROLE",
			subjectId: actors.userRoleId,
			action: "READ",
			resourceType: "LOCATION",
			resourceId: null,
			scope: "LOCATION",
			effect: "ALLOW",
			reason: "User role can read locations they belong to",
			assignedBy: actors.adminUserId,
		}),
		acl("manager-role-update-payments", {
			subjectType: "ROLE",
			subjectId: actors.managerRoleId,
			action: "UPDATE",
			resourceType: "PAYMENT",
			resourceId: null,
			scope: "TENANT",
			effect: "DENY",
			reason: "Manager role explicitly denied from updating payments",
			assignedBy: actors.adminUserId,
			expiresAt: now + 365 * DAY_MS,
		}),
		{
			id: KERNEL_SEED_IDS.productScopedAcl,
			subjectType: "USER",
			subjectId: REWARD_SEED_IDS.mlkCashierUser,
			action: "UPDATE",
			resourceType: "PRODUCT",
			resourceId: KERNEL_SEED_IDS.productTarget,
			scope: "LOCATION",
			tenantId: TENANT_SEED_IDS.mlkTenant,
			locationId: TENANT_SEED_IDS.mlkLocationBeruang,
			effect: "DENY",
			reason: "The Bukit Beruang cashier may not edit this product (or its images) once it is archived",
			assignedBy: actors.adminUserId,
			expiresAt: now + 180 * DAY_MS,
		},
		{
			id: KERNEL_SEED_IDS.retiredAcl,
			subjectType: "USER",
			subjectId: REWARD_SEED_IDS.klOwnerUser,
			action: "READ",
			resourceType: "PAYMENT",
			resourceId: null,
			scope: "TENANT",
			tenantId: TENANT_SEED_IDS.klTenant,
			effect: "ALLOW",
			reason: "Retired exception: payment read access for the audit window that has ended",
			assignedBy: actors.adminUserId,
			isDeleted: true,
			deletedAt: now - 7 * DAY_MS,
		},
	];

	return { acls };
}
