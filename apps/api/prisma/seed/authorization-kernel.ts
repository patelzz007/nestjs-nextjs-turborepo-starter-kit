import type { Prisma } from "@prisma/client";

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

	const policies: Prisma.PolicyDefinitionCreateManyInput[] = [
		{
			name: "business-hours-access",
			description: "Allow access only during business hours (9 AM - 5 PM UTC)",
			scope: "GLOBAL",
			actions: ["READ"],
			resources: ["ADMIN_DASHBOARD"],
			effect: "ALLOW",
			conditions: JSON.stringify({
				all: [
					{
						operator: "gte",
						path: "context.hour",
						value: 9,
					},
					{
						operator: "lte",
						path: "context.hour",
						value: 17,
					},
				],
			}),
			isActive: true,
			version: 1,
		},
		{
			name: "ip-whitelist-policy",
			description: "Allow access from specific IP addresses",
			scope: "GLOBAL",
			actions: ["MANAGE"],
			resources: ["SYSTEM_SETTINGS"],
			effect: "ALLOW",
			conditions: JSON.stringify({
				any: [
					{
						operator: "in",
						path: "context.ipAddress",
						value: ["192.168.1.1", "10.0.0.1"],
					},
				],
			}),
			isActive: true,
			version: 1,
		},
		{
			name: "owner-only-delete",
			description: "Only resource owner can delete their own resources",
			scope: "OWN",
			actions: ["DELETE"],
			resources: ["ORDER"],
			effect: "ALLOW",
			conditions: JSON.stringify({
				all: [
					{
						operator: "eq",
						path: "resource.ownerId",
						value: { ref: "user.id" },
					},
				],
			}),
			isActive: true,
			version: 1,
		},
		{
			name: "deny-weekend-writes",
			description: "Deny write operations on weekends",
			scope: "GLOBAL",
			actions: ["UPDATE"],
			resources: ["PAYMENT"],
			effect: "DENY",
			conditions: JSON.stringify({
				any: [
					{
						operator: "eq",
						path: "context.dayOfWeek",
						value: 0,
					},
					{
						operator: "eq",
						path: "context.dayOfWeek",
						value: 6,
					},
				],
			}),
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
