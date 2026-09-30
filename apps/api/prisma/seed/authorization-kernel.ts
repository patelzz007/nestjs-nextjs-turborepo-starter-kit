import type { Prisma } from "@prisma/client";
import { PolicyConditionsSchema, type PolicyConditions } from "@workspace/shared";

import { parsePrismaInputJson } from "../../src/common/utils/prisma-json";

import { prisma } from "./client";

/**
 * Seed Authorization Kernel components:
 * - Resource ACLs (ALLOW/DENY rules)
 * - Policy Definitions (ABAC policies with Zod-validated DSL)
 */
export async function seedAuthorizationKernel(
	users: readonly { id: string; email: string }[],
	roles: readonly { id: string; name: string }[],
): Promise<{ acls: number; policies: number }> {
	const adminUser = users.find((u) => u.email === "admin@example.com");
	const managerUser = users.find((u) => u.email === "manager@example.com");
	const userRole = roles.find((r) => r.name === "User");
	const managerRole = roles.find((r) => r.name === "Manager");

	if (adminUser === undefined || managerUser === undefined || userRole === undefined || managerRole === undefined) {
		throw new Error("Required users or roles not found for kernel seed");
	}

	const acls: Prisma.ResourceAclCreateManyInput[] = [
		{
			subjectType: "USER",
			subjectId: adminUser.id,
			action: "DELETE",
			resourceType: "USER",
			resourceId: null,
			scope: "GLOBAL",
			effect: "ALLOW",
			reason: "Admin explicitly allowed to delete users globally",
			assignedBy: adminUser.id,
			expiresAt: null,
		},
		{
			subjectType: "USER",
			subjectId: managerUser.id,
			action: "CREATE",
			resourceType: "ORGANIZATION",
			resourceId: null,
			scope: "ORGANIZATION",
			effect: "DENY",
			reason: "Manager explicitly denied from creating organizations",
			assignedBy: adminUser.id,
			expiresAt: null,
		},
		{
			subjectType: "ROLE",
			subjectId: userRole.id,
			action: "READ",
			resourceType: "LOCATION",
			resourceId: null,
			scope: "LOCATION",
			effect: "ALLOW",
			reason: "User role can read locations they belong to",
			assignedBy: adminUser.id,
			expiresAt: null,
		},
		{
			subjectType: "ROLE",
			subjectId: managerRole.id,
			action: "UPDATE",
			resourceType: "PAYMENT",
			resourceId: null,
			scope: "ORGANIZATION",
			effect: "DENY",
			reason: "Manager role explicitly denied from updating payments",
			assignedBy: adminUser.id,
			expiresAt: BigInt(Date.now() + 365 * 24 * 60 * 60 * 1000),
		},
	];

	await prisma.resourceAcl.createMany({ data: acls, skipDuplicates: true });

	// Conditions use the Zod-validated policy DSL (`PolicyConditionsSchema`) —
	// never executable code. The policy engine fails closed on malformed rules.
	const completedOrderLock: PolicyConditions = {
		condition: { field: "order.status", operator: "equals", value: "COMPLETED" },
	};
	const refundLimit: PolicyConditions = {
		all: [
			{ condition: { field: "payment.status", operator: "equals", value: "PAID" } },
			{ condition: { field: "payment.amount", operator: "less_than_or_equals", value: 500 } },
		],
	};
	const sameOrganizationInventory: PolicyConditions = {
		condition: { field: "inventory.organizationId", operator: "equals", valueRef: "$user.organizationId" },
	};

	const policies: Prisma.PolicyDefinitionCreateManyInput[] = [
		{
			name: "completed-orders-are-immutable",
			description: "Completed orders cannot be updated or deleted",
			scope: "GLOBAL",
			actions: ["UPDATE", "DELETE"],
			resources: ["ORDER"],
			effect: "DENY",
			conditions: parsePrismaInputJson(PolicyConditionsSchema.parse(completedOrderLock)),
			isActive: true,
			version: 1,
		},
		{
			name: "payment-update-limit",
			description: "Payments may only be updated while PAID and at most 500",
			scope: "ORGANIZATION",
			actions: ["UPDATE"],
			resources: ["PAYMENT"],
			effect: "ALLOW",
			conditions: parsePrismaInputJson(PolicyConditionsSchema.parse(refundLimit)),
			isActive: true,
			version: 1,
		},
		{
			name: "inventory-same-organization",
			description: "Inventory changes are limited to the caller's verified organization",
			scope: "ORGANIZATION",
			actions: ["UPDATE", "DELETE"],
			resources: ["INVENTORY"],
			effect: "ALLOW",
			conditions: parsePrismaInputJson(PolicyConditionsSchema.parse(sameOrganizationInventory)),
			isActive: true,
			version: 1,
		},
	];

	await prisma.policyDefinition.createMany({ data: policies, skipDuplicates: true });

	return {
		acls: acls.length,
		policies: policies.length,
	};
}
