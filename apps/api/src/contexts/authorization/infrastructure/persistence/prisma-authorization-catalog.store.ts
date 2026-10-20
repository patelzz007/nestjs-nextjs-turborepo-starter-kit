import { Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { PermissionDefinition } from "@workspace/shared";

import type { AuthorizationCatalogStore, CapabilityCatalogSyncResult, PermissionRegistrySyncResult } from "../../application/ports/catalog-sync.port";
import { convergePlatformCapabilities } from "../reference-data/platform-capability-rows";

/**
 * Advisory-lock key serializing the boot-time catalog syncs across replicas (D21). Hashed from a fixed,
 * namespaced string so it cannot collide with the RBAC or policy-publish locks.
 */
export const AUTHORIZATION_CATALOG_SYNC_LOCK_KEY = "authorization_catalog_sync";

/** The persisted fields of one permission the registry sync compares. */
interface StoredPermission {
	readonly id: string;
	readonly action: string;
	readonly resource: string;
	readonly scope: string;
	readonly description: string | null;
	readonly group: string | null;
	readonly isSystem: boolean;
}

function registryKey(action: string, resource: string, scope: string): string {
	return `${action}:${resource}:${scope}`;
}

/** Boot-time writes of the permission and capability catalogs, on the sync's transaction. */
export class PrismaAuthorizationCatalogStore implements AuthorizationCatalogStore {
	private readonly logger: Logger = new Logger(PrismaAuthorizationCatalogStore.name);

	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async lockCatalogSync(): Promise<void> {
		await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${AUTHORIZATION_CATALOG_SYNC_LOCK_KEY}, 0))`;
	}

	/** Registry → database only: insert missing rows, correct stale metadata; never delete (admin-created rows stay). */
	public async syncPermissionDefinitions(definitions: readonly PermissionDefinition[]): Promise<PermissionRegistrySyncResult> {
		const created: PermissionDefinition[] = [];
		const updated: PermissionDefinition[] = [];
		const existing = new Map<string, StoredPermission>();
		const rows: StoredPermission[] = await this.db.permission.findMany({
			where: { isDeleted: false },
			select: { id: true, action: true, resource: true, scope: true, description: true, group: true, isSystem: true },
		});
		for (const row of rows) {
			existing.set(registryKey(row.action, row.resource, row.scope), row);
		}

		for (const definition of definitions) {
			const scope = definition.scope ?? "GLOBAL";
			const key: string = registryKey(definition.action, definition.resource, scope);
			const stored: StoredPermission | undefined = existing.get(key);
			const isSystem: boolean = definition.isSystem ?? false;
			if (stored === undefined) {
				await this.db.permission.create({
					data: { action: definition.action, resource: definition.resource, scope, description: definition.description, group: definition.group, isSystem },
				});
				created.push(definition);
				this.logger.log(`Created permission: ${key}`);
			} else if (stored.description !== definition.description || stored.group !== definition.group || stored.isSystem !== isSystem) {
				await this.db.permission.update({ where: { id: stored.id }, data: { description: definition.description, group: definition.group, isSystem } });
				updated.push(definition);
			}
			existing.delete(key);
		}

		const orphaned = [...existing.values()].map((row: StoredPermission) => ({ id: row.id, action: row.action, resource: row.resource }));
		return { created, updated, orphaned };
	}

	public async convergePlatformCapabilities(): Promise<CapabilityCatalogSyncResult> {
		return convergePlatformCapabilities(this.db);
	}
}
