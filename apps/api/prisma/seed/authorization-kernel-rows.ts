import type { Prisma } from "@prisma/client";
import { PolicyConditionsSchema, type PolicyConditions } from "@workspace/shared";

import { parsePrismaInputJson } from "../../src/common/utils/prisma-json";
import { deterministicUuid } from "./deterministic-uuid";
import { ORGANIZATION_SEED_IDS } from "./organization-seed-ids";
import { buildProductSeedId } from "./products";
import { REWARD_SEED_IDS } from "./rewards";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ACL_NAMESPACE = "kernel-seed-acl";
const POLICY_NAMESPACE = "kernel-seed-policy";
/** The seeded product the location-scoped ACL targets (a `PRODUCT` / `UPDATE` check is what `FileAuthorizationService` runs for product images). */
const ACL_TARGET_PRODUCT_SEQUENCE = 1;
const BERUANG_REFUND_CAP_V1 = 100;
const BERUANG_REFUND_CAP_V2 = 200;

/** Fixed ids of the kernel seed rows the unit test (and docs) refer to. */
export const KERNEL_SEED_IDS = Object.freeze({
	productScopedAcl: deterministicUuid(ACL_NAMESPACE, "mlk-cashier-archived-product-update"),
	retiredAcl: deterministicUuid(ACL_NAMESPACE, "retired-kl-owner-payment-read"),
	policyV1Superseded: deterministicUuid(POLICY_NAMESPACE, "beruang-payment-cap-v1"),
	policyV2Published: deterministicUuid(POLICY_NAMESPACE, "beruang-payment-cap-v2"),
	policyDeleted: deterministicUuid(POLICY_NAMESPACE, "legacy-payment-freeze"),
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
	readonly policies: readonly WithId<Prisma.PolicyDefinitionUncheckedCreateInput>[];
}

function conditions(rule: PolicyConditions): Prisma.InputJsonValue {
	return parsePrismaInputJson(PolicyConditionsSchema.parse(rule));
}

/**
 * Every `resource_acls` and `policy_definitions` seed row, deterministic ids so
 * the seed upserts (idempotent). Conditions use the validated policy DSL; the
 * tenant-bound rows use the Jonker Street Kitchen organization / Bukit Beruang
 * location, so they only apply inside that server-verified tenant.
 */
export function buildKernelSeedRows(actors: KernelSeedActors, now: number): KernelSeedRows {
	const acl = (key: string, row: Omit<Prisma.ResourceAclUncheckedCreateInput, "id">): WithId<Prisma.ResourceAclUncheckedCreateInput> => ({
		id: deterministicUuid(ACL_NAMESPACE, key),
		...row,
	});
	const policy = (key: string, row: Omit<Prisma.PolicyDefinitionUncheckedCreateInput, "id">): WithId<Prisma.PolicyDefinitionUncheckedCreateInput> => ({
		id: deterministicUuid(POLICY_NAMESPACE, key),
		...row,
	});
	const archivedProduct: PolicyConditions = { condition: { field: "product.status", operator: "equals", value: "ARCHIVED" } };
	const completedOrderLock: PolicyConditions = { condition: { field: "order.status", operator: "equals", value: "COMPLETED" } };
	const refundLimit: PolicyConditions = {
		all: [
			{ condition: { field: "payment.status", operator: "equals", value: "PAID" } },
			{ condition: { field: "payment.amount", operator: "less_than_or_equals", value: 500 } },
		],
	};
	const sameOrganizationInventory: PolicyConditions = { condition: { field: "inventory.organizationId", operator: "equals", valueRef: "$user.organizationId" } };
	const paymentCap = (limit: number): PolicyConditions => ({ condition: { field: "payment.amount", operator: "less_than_or_equals", value: limit } });
	const publishedAt = now - 30 * MS_PER_DAY;
	const supersededPublishedAt = now - 90 * MS_PER_DAY;

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
		acl("manager-create-organizations", {
			subjectType: "USER",
			subjectId: actors.managerUserId,
			action: "CREATE",
			resourceType: "ORGANIZATION",
			resourceId: null,
			scope: "ORGANIZATION",
			effect: "DENY",
			reason: "Manager explicitly denied from creating organizations",
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
			scope: "ORGANIZATION",
			effect: "DENY",
			reason: "Manager role explicitly denied from updating payments",
			assignedBy: actors.adminUserId,
			expiresAt: now + 365 * MS_PER_DAY,
		}),
		{
			id: KERNEL_SEED_IDS.productScopedAcl,
			subjectType: "USER",
			subjectId: REWARD_SEED_IDS.mlkCashierUser,
			action: "UPDATE",
			resourceType: "PRODUCT",
			resourceId: KERNEL_SEED_IDS.productTarget,
			scope: "LOCATION",
			organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
			locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
			effect: "DENY",
			conditions: conditions(archivedProduct),
			reason: "The Bukit Beruang cashier may not edit this product (or its images) once it is archived",
			assignedBy: actors.adminUserId,
			expiresAt: now + 180 * MS_PER_DAY,
		},
		{
			id: KERNEL_SEED_IDS.retiredAcl,
			subjectType: "USER",
			subjectId: REWARD_SEED_IDS.klOwnerUser,
			action: "READ",
			resourceType: "PAYMENT",
			resourceId: null,
			scope: "ORGANIZATION",
			organizationId: ORGANIZATION_SEED_IDS.klOrganization,
			effect: "ALLOW",
			reason: "Retired exception: payment read access for the audit window that has ended",
			assignedBy: actors.adminUserId,
			isDeleted: true,
			deletedAt: now - 7 * MS_PER_DAY,
		},
	];

	const policies: WithId<Prisma.PolicyDefinitionUncheckedCreateInput>[] = [
		policy("completed-orders-are-immutable", {
			name: "completed-orders-are-immutable",
			description: "Completed orders cannot be updated or deleted",
			scope: "GLOBAL",
			actions: ["UPDATE", "DELETE"],
			resources: ["ORDER"],
			effect: "DENY",
			conditions: conditions(completedOrderLock),
			isActive: true,
			version: 1,
		}),
		policy("payment-update-limit", {
			name: "payment-update-limit",
			description: "Payments may only be updated while PAID and at most 500",
			scope: "ORGANIZATION",
			actions: ["UPDATE"],
			resources: ["PAYMENT"],
			effect: "ALLOW",
			conditions: conditions(refundLimit),
			isActive: true,
			version: 1,
		}),
		policy("inventory-same-organization", {
			name: "inventory-same-organization",
			description: "Inventory changes are limited to the caller's verified organization",
			scope: "ORGANIZATION",
			actions: ["UPDATE", "DELETE"],
			resources: ["INVENTORY"],
			effect: "ALLOW",
			conditions: conditions(sameOrganizationInventory),
			isActive: true,
			version: 1,
		}),
		{
			id: KERNEL_SEED_IDS.policyV1Superseded,
			name: "beruang-payment-cap",
			description: "Bukit Beruang payment cap, first revision (superseded by v2)",
			scope: "LOCATION",
			actions: ["UPDATE"],
			resources: ["PAYMENT"],
			effect: "ALLOW",
			organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
			locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
			conditions: conditions(paymentCap(BERUANG_REFUND_CAP_V1)),
			isActive: false,
			version: 1,
			publishedAt: supersededPublishedAt,
			publishedBy: actors.adminUserId,
			supersededBy: KERNEL_SEED_IDS.policyV2Published,
		},
		{
			id: KERNEL_SEED_IDS.policyV2Published,
			name: "beruang-payment-cap",
			description: "Bukit Beruang may only update payments up to MYR 200",
			scope: "LOCATION",
			actions: ["UPDATE"],
			resources: ["PAYMENT"],
			effect: "ALLOW",
			organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
			locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
			conditions: conditions(paymentCap(BERUANG_REFUND_CAP_V2)),
			isActive: true,
			version: 2,
			publishedAt,
			publishedBy: actors.adminUserId,
		},
		{
			id: KERNEL_SEED_IDS.policyDeleted,
			name: "legacy-payment-freeze",
			description: "Retired policy: froze every payment update during the pilot",
			scope: "GLOBAL",
			actions: ["UPDATE"],
			resources: ["PAYMENT"],
			effect: "DENY",
			isActive: false,
			version: 1,
			publishedAt: supersededPublishedAt,
			publishedBy: actors.adminUserId,
			isDeleted: true,
			deletedAt: now - 14 * MS_PER_DAY,
		},
	];

	return { acls, policies };
}
