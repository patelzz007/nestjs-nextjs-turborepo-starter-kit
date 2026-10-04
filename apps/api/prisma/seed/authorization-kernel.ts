import { prisma } from "./client";
import { buildKernelSeedRows } from "./authorization-kernel-rows";

/**
 * Seed Authorization Kernel components (rows built by `buildKernelSeedRows`):
 * - Resource ACLs: global, role- and user-bound, a tenant/location/resource-bound
 *   conditional DENY, and one retired (soft-deleted) entry
 * - Policy Definitions: ABAC policies with Zod-validated DSL, a published tenant
 *   policy, the revision it superseded, and one soft-deleted policy
 * Every row has a deterministic id and is upserted, so re-seeding never duplicates.
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

	const { acls, policies } = buildKernelSeedRows(
		{ adminUserId: adminUser.id, managerUserId: managerUser.id, userRoleId: userRole.id, managerRoleId: managerRole.id },
		Date.now(),
	);

	for (const { id, ...data } of acls) {
		await prisma.resourceAcl.upsert({ where: { id }, create: { id, ...data }, update: data });
	}
	for (const { id, ...data } of policies) {
		await prisma.policyDefinition.upsert({ where: { id }, create: { id, ...data }, update: data });
	}

	return { acls: acls.length, policies: policies.length };
}
