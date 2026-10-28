import { prisma } from "./client";
import { buildKernelSeedRows } from "./authorization-kernel-rows";

/**
 * Seed the legacy resource ACL rows built by `buildKernelSeedRows` (global, role- and user-bound, a
 * tenant/location/resource-bound DENY, and one retired (soft-deleted) entry). Every row has a
 * deterministic id and is upserted, so re-seeding never duplicates.
 */
export async function seedAuthorizationKernel(users: readonly { id: string; email: string }[], roles: readonly { id: string; name: string }[]): Promise<{ acls: number }> {
	const adminUser = users.find((u) => u.email === "admin@example.com");
	const managerUser = users.find((u) => u.email === "manager@example.com");
	const userRole = roles.find((r) => r.name === "User");
	// The platform Manager role was retired (ADR 067); the kernel rows that named it now name Admin.
	const managerRole = roles.find((r) => r.name === "Admin");

	if (adminUser === undefined || managerUser === undefined || userRole === undefined || managerRole === undefined) {
		throw new Error("Required users or roles not found for kernel seed");
	}

	const { acls } = buildKernelSeedRows({ adminUserId: adminUser.id, managerUserId: managerUser.id, userRoleId: userRole.id, managerRoleId: managerRole.id }, Date.now());

	for (const { id, ...data } of acls) {
		await prisma.resourceAcl.upsert({ where: { id }, create: { id, ...data }, update: data });
	}

	return { acls: acls.length };
}
