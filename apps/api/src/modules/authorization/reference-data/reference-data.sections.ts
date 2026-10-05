import type { Permission, Prisma, Role, RolePermission } from "@prisma/client";
import { getPermissionDefinitions, nowEpochMs } from "@workspace/shared";

import { MERCHANT_CAPABILITY_CATALOG } from "./merchant-capability-catalog";
import { derivePlatformCapabilityRows } from "./platform-capability-rows";
import { NO_CHANGE, type ReferenceDataSection, type SectionChange } from "./reference-data.types";
import { SYSTEM_ROLE_CATALOG, type PermissionSelector, type SystemRoleDefinition } from "./system-role-catalog";

type Tx = Prisma.TransactionClient;

/** `action:resource:scope` of every permission the code defines. */
function registryPermissionKeys(): ReadonlySet<string> {
	return new Set(
		getPermissionDefinitions().map((definition) => permissionKey({ action: definition.action, resource: definition.resource, scope: definition.scope ?? "GLOBAL" })),
	);
}

function permissionKey(permission: { readonly action: string; readonly resource: string; readonly scope: string }): string {
	return `${permission.action}:${permission.resource}:${permission.scope}`;
}

/** The permission catalog (`getPermissionDefinitions`). Creates missing rows and corrects metadata; never deletes — operators may add their own. */
export class PermissionCatalogSection implements ReferenceDataSection {
	public readonly name = "permissions";

	public async sync(tx: Tx): Promise<SectionChange> {
		const existing = new Map<string, Permission>((await tx.permission.findMany()).map((row: Permission): [string, Permission] => [permissionKey(row), row]));
		const now: number = nowEpochMs();
		const missing: Prisma.PermissionCreateManyInput[] = [];
		let updated = 0;

		for (const definition of getPermissionDefinitions()) {
			const scope = definition.scope ?? "GLOBAL";
			const isSystem: boolean = definition.isSystem ?? false;
			const row: Permission | undefined = existing.get(permissionKey({ action: definition.action, resource: definition.resource, scope }));
			if (row === undefined) {
				missing.push({ action: definition.action, resource: definition.resource, scope, description: definition.description, group: definition.group, isSystem });
			} else if (row.description !== definition.description || row.group !== definition.group || row.isSystem !== isSystem) {
				await tx.permission.update({ where: { id: row.id }, data: { description: definition.description, group: definition.group, isSystem, updatedAt: now } });
				updated += 1;
			}
		}
		if (missing.length > 0) {
			await tx.permission.createMany({ data: missing });
		}
		return { ...NO_CHANGE, created: missing.length, updated };
	}
}

/** The system roles: present, `isSystem`, flat (no parent), live. A role's activation flag is an operator decision and is left alone. */
export class SystemRoleSection implements ReferenceDataSection {
	public readonly name = "system-roles";

	public async sync(tx: Tx): Promise<SectionChange> {
		const existing = new Map<string, Role>(
			(await tx.role.findMany({ where: { name: { in: SYSTEM_ROLE_CATALOG.map((role) => role.name) } } })).map((row: Role): [string, Role] => [row.name, row]),
		);
		const now: number = nowEpochMs();
		let created = 0;
		let updated = 0;
		let restored = 0;

		for (const definition of SYSTEM_ROLE_CATALOG) {
			const row: Role | undefined = existing.get(definition.name);
			if (row === undefined) {
				await tx.role.create({ data: { name: definition.name, description: definition.description, isActive: true, isSystem: true } });
				created += 1;
			} else if (row.isDeleted) {
				await tx.role.update({
					where: { id: row.id },
					data: { isDeleted: false, deletedAt: null, description: definition.description, isSystem: true, parentId: null, updatedAt: now },
				});
				restored += 1;
			} else if (row.description !== definition.description || !row.isSystem || row.parentId !== null) {
				await tx.role.update({ where: { id: row.id }, data: { description: definition.description, isSystem: true, parentId: null, updatedAt: now } });
				updated += 1;
			}
		}
		return { ...NO_CHANGE, created, updated, restored };
	}
}

/** The role → permission matrix of the system roles. Converges both ways: missing grants are added, withdrawn ones are soft-deleted. */
export class RolePermissionMatrixSection implements ReferenceDataSection {
	public readonly name = "role-permissions";

	public async sync(tx: Tx): Promise<SectionChange> {
		const roles: Role[] = await tx.role.findMany({ where: { isDeleted: false, name: { in: SYSTEM_ROLE_CATALOG.map((role) => role.name) } } });
		// The matrix covers the code's registry only. Permissions an operator created (or retired) are not ours:
		// their grants are neither added nor withdrawn here. A soft-deleted registry permission keeps its grants.
		const registry: ReadonlySet<string> = registryPermissionKeys();
		const catalog: Permission[] = (await tx.permission.findMany()).filter((permission: Permission): boolean => registry.has(permissionKey(permission)));
		const catalogIds: ReadonlySet<string> = new Set(catalog.map((permission: Permission): string => permission.id));
		const rows: RolePermission[] = await tx.rolePermission.findMany({ where: { roleId: { in: roles.map((role: Role): string => role.id) } } });
		const now: number = nowEpochMs();
		const missing: Prisma.RolePermissionCreateManyInput[] = [];
		const toRestore: string[] = [];
		const toRetire: string[] = [];

		for (const role of roles) {
			const grants: PermissionSelector | undefined = SYSTEM_ROLE_CATALOG.find((definition: SystemRoleDefinition): boolean => definition.name === role.name)?.grants;
			const desired = new Set<string>(
				catalog.filter((permission: Permission): boolean => grants?.(permission) ?? false).map((permission: Permission): string => permission.id),
			);
			const own: RolePermission[] = rows.filter((row: RolePermission): boolean => row.roleId === role.id);
			for (const permissionId of desired) {
				const row: RolePermission | undefined = own.find((candidate: RolePermission): boolean => candidate.permissionId === permissionId);
				if (row === undefined) {
					missing.push({ roleId: role.id, permissionId });
				} else if (row.isDeleted) {
					toRestore.push(row.id);
				}
			}
			for (const row of own) {
				if (!row.isDeleted && catalogIds.has(row.permissionId) && !desired.has(row.permissionId)) {
					toRetire.push(row.id);
				}
			}
		}

		if (missing.length > 0) {
			await tx.rolePermission.createMany({ data: missing });
		}
		if (toRestore.length > 0) {
			await tx.rolePermission.updateMany({ where: { id: { in: toRestore } }, data: { isDeleted: false, deletedAt: null, updatedAt: now } });
		}
		if (toRetire.length > 0) {
			await tx.rolePermission.updateMany({ where: { id: { in: toRetire } }, data: { isDeleted: true, deletedAt: now, updatedAt: now } });
		}
		return { created: missing.length, updated: 0, restored: toRestore.length, retired: toRetire.length };
	}
}

/** The MERCHANT capability catalog (`capability_definitions`). */
export class MerchantCapabilitySection implements ReferenceDataSection {
	public readonly name = "merchant-capabilities";

	public async sync(tx: Tx): Promise<SectionChange> {
		const existing = new Map((await tx.capabilityDefinition.findMany()).map((row) => [row.slug, row]));
		const now: number = nowEpochMs();
		let created = 0;
		let updated = 0;

		for (const entry of MERCHANT_CAPABILITY_CATALOG) {
			const row = existing.get(entry.slug);
			const data = {
				scope: "MERCHANT",
				label: entry.label,
				description: entry.description,
				groupName: entry.groupName,
				sortOrder: entry.sortOrder,
				isSystem: true,
			} satisfies Prisma.CapabilityDefinitionUpdateInput;
			if (row === undefined) {
				await tx.capabilityDefinition.create({ data: { slug: entry.slug, ...data } });
				created += 1;
			} else if (
				row.scope !== data.scope ||
				row.label !== data.label ||
				row.description !== data.description ||
				row.groupName !== data.groupName ||
				row.sortOrder !== data.sortOrder ||
				!row.isSystem
			) {
				await tx.capabilityDefinition.update({ where: { id: row.id }, data: { ...data, updatedAt: now } });
				updated += 1;
			}
		}
		return { ...NO_CHANGE, created, updated };
	}
}

/**
 * The PLATFORM capability definitions, derived from the permission catalog and linked to their permission
 * (`permission_id`). The API also syncs them at boot; both go through {@link derivePlatformCapabilityRows}.
 */
export class PlatformCapabilitySection implements ReferenceDataSection {
	public readonly name = "platform-capabilities";

	public async sync(tx: Tx): Promise<SectionChange> {
		const existing = new Map((await tx.capabilityDefinition.findMany()).map((row) => [row.slug, row]));
		const now: number = nowEpochMs();
		let created = 0;
		let updated = 0;

		for (const entry of await derivePlatformCapabilityRows(tx, registryPermissionKeys())) {
			const row = existing.get(entry.slug);
			const data = {
				scope: "PLATFORM",
				label: entry.label,
				description: entry.description,
				groupName: entry.groupName,
				isSystem: entry.isSystem,
				permissionId: entry.permissionId,
			} satisfies Prisma.CapabilityDefinitionUncheckedUpdateInput;
			if (row === undefined) {
				await tx.capabilityDefinition.create({ data: { slug: entry.slug, ...data } });
				created += 1;
			} else if (
				row.scope !== data.scope ||
				row.label !== data.label ||
				row.description !== data.description ||
				row.groupName !== data.groupName ||
				row.isSystem !== data.isSystem ||
				row.permissionId !== data.permissionId
			) {
				await tx.capabilityDefinition.update({ where: { id: row.id }, data: { ...data, updatedAt: now } });
				updated += 1;
			}
		}
		return { ...NO_CHANGE, created, updated };
	}
}

/** Every section, in dependency order (grants need the roles and permissions committed first). The single list the seed and the command share. */
export function createReferenceDataSections(): readonly ReferenceDataSection[] {
	return [new PermissionCatalogSection(), new SystemRoleSection(), new RolePermissionMatrixSection(), new PlatformCapabilitySection(), new MerchantCapabilitySection()];
}
