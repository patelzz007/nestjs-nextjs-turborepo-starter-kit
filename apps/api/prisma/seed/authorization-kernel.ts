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
			resource: "USER",
			resourceId: null,
			scope: "GLOBAL",
			effect: "ALLOW",
			reason: "Admin explicitly allowed to delete users globally",
			grantedById: adminUser.id,
			expiresAt: null,
		},
		{
			subjectType: "USER",
			subjectId: managerUser.id,
			action: "CREATE",
			resource: "ORGANIZATION",
			resourceId: null,
			scope: "ORGANIZATION",
			effect: "DENY",
			reason: "Manager explicitly denied from creating organizations",
			grantedById: adminUser.id,
			expiresAt: null,
		},
		{
			subjectType: "ROLE",
			subjectId: userRole.id,
			action: "READ",
			resource: "LOCATION",
			resourceId: null,
			scope: "LOCATION",
			effect: "ALLOW",
			reason: "User role can read locations they belong to",
			grantedById: adminUser.id,
			expiresAt: null,
		},
		{
			subjectType: "ROLE",
			subjectId: managerRole.id,
			action: "UPDATE",
			resource: "PAYMENT",
			resourceId: null,
			scope: "ORGANIZATION",
			effect: "DENY",
			reason: "Manager role explicitly denied from updating payments",
			grantedById: adminUser.id,
			expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
		},
	];

	await prisma.resourceAcl.createMany({ data: acls, skipDuplicates: true });

	const policies: Prisma.PolicyDefinitionCreateManyInput[] = [
		{
			name: "business-hours-access",
			description: "Allow access only during business hours (9 AM - 5 PM UTC)",
			scope: "GLOBAL",
			action: "READ",
			resource: "ADMIN_DASHBOARD",
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
			priority: 100,
			isActive: true,
			version: 1,
			createdById: adminUser.id,
		},
		{
			name: "ip-whitelist-policy",
			description: "Allow access from specific IP addresses",
			scope: "GLOBAL",
			action: "MANAGE",
			resource: "SYSTEM_SETTINGS",
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
			priority: 200,
			isActive: true,
			version: 1,
			createdById: adminUser.id,
		},
		{
			name: "owner-only-delete",
			description: "Only resource owner can delete their own resources",
			scope: "OWN",
			action: "DELETE",
			resource: "ORDER",
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
			priority: 150,
			isActive: true,
			version: 1,
			createdById: adminUser.id,
		},
		{
			name: "deny-weekend-writes",
			description: "Deny write operations on weekends",
			scope: "GLOBAL",
			action: "UPDATE",
			resource: "PAYMENT",
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
			priority: 300,
			isActive: true,
			version: 1,
			createdById: adminUser.id,
		},
	];

	await prisma.policyDefinition.createMany({ data: policies, skipDuplicates: true });

	return {
		acls: acls.length,
		policies: policies.length,
	};
}
