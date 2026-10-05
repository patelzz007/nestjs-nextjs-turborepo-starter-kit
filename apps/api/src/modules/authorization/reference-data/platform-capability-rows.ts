import type { Prisma } from "@prisma/client";
import { PermissionActionSchema, PermissionResourceSchema, toPlatformCapabilitySlug } from "@workspace/shared";

/** One PLATFORM capability definition, derived from the permission that owns it. */
export interface PlatformCapabilityRow {
	readonly slug: string;
	readonly label: string;
	readonly description: string | null;
	readonly groupName: string | null;
	readonly isSystem: boolean;
	readonly permissionId: string;
}

/** What the derivation reads: any client that can read permissions (a transaction, or the system client). */
export interface PermissionReader {
	readonly permission: Pick<Prisma.TransactionClient["permission"], "findMany">;
}

/**
 * PLATFORM capabilities are not authored: each is the `action × resource` of a permission, linked to it
 * (`capability_definitions.permission_id`). This is the ONE derivation — the API's boot sync
 * (`CapabilityDefinitionService`) and the reference-data loader both use it, so a fresh database loaded by
 * `db:sync-reference-data` or the seed holds exactly the rows the API would create on its first start.
 * `onlyKeys` (`action:resource:scope`) narrows the derivation to those permissions: the reference-data loader passes the code's registry, so
 * it never creates capabilities for operator-made permissions (the API's boot sync, which passes nothing, covers every permission).
 * MERCHANT capabilities have no permission (authorized through tenant policies), so their link stays NULL.
 */
export async function derivePlatformCapabilityRows(reader: PermissionReader, onlyKeys?: ReadonlySet<string>): Promise<PlatformCapabilityRow[]> {
	const permissions = await reader.permission.findMany({
		select: { id: true, action: true, resource: true, scope: true, description: true, group: true, isSystem: true },
		// GLOBAL rows sort first, so they own the capability when several scopes share a slug.
		orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
	});
	const rows: PlatformCapabilityRow[] = [];
	const seen = new Set<string>();
	for (const permission of permissions) {
		if (onlyKeys !== undefined && !onlyKeys.has(`${permission.action}:${permission.resource}:${permission.scope}`)) {
			continue;
		}
		const action = PermissionActionSchema.safeParse(permission.action);
		const resource = PermissionResourceSchema.safeParse(permission.resource);
		if (!action.success || !resource.success) {
			continue;
		}
		const slug: string = toPlatformCapabilitySlug(action.data, resource.data);
		// One capability per action × resource: the first (preferably GLOBAL) permission row links it.
		if (seen.has(slug)) {
			continue;
		}
		seen.add(slug);
		rows.push({
			slug,
			label: permission.description ?? `${permission.action} ${permission.resource}`,
			description: permission.description,
			groupName: permission.group,
			isSystem: permission.isSystem,
			permissionId: permission.id,
		});
	}
	return rows;
}
