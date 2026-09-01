import type { Permission } from "@prisma/client";
import { getPermissionDefinitions } from "@workspace/shared";

import { prisma } from "./client";

export async function createPermissions(): Promise<Permission[]> {
	const definitions = getPermissionDefinitions();

	for (const definition of definitions) {
		await prisma.permission.upsert({
			where: { action_resource: { action: definition.action, resource: definition.resource } },
			update: {
				description: definition.description,
				group: definition.group,
				isSystem: definition.isSystem ?? false,
			},
			create: {
				action: definition.action,
				resource: definition.resource,
				description: definition.description,
				group: definition.group,
				isSystem: definition.isSystem ?? false,
			},
		});
	}

	return prisma.permission.findMany();
}
