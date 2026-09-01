import { Injectable, Logger } from "@nestjs/common";
import { getPermissionDefinitions, type PermissionDefinition } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCacheService } from "../cache/authorization-cache.service";

/**
 * Result of a migration sync.
 */
export interface MigrationResult {
	/** Permissions that were newly inserted. */
	readonly created: readonly PermissionDefinition[];
	/** Permissions that existed but had stale metadata. */
	readonly updated: readonly PermissionDefinition[];
	/** Permissions in the DB that don't appear in the registry (orphans). */
	readonly orphaned: readonly { readonly id: string; readonly action: string; readonly resource: string }[];
}

/**
 * Syncs the code registry (`permissions-registry.ts`) with the `permissions` table.
 *
 * Direction is **registry → database** only. Permissions created in the admin UI
 * live in the DB for runtime RBAC but are not written back to TypeScript source.
 */
@Injectable()
export class PermissionMigrationService {
	private readonly logger: Logger = new Logger(PermissionMigrationService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly cache: AuthorizationCacheService,
	) {}

	/** Sync `PERMISSION_DEFINITIONS` from `@workspace/shared` into the database. */
	public async syncFromRegistry(): Promise<MigrationResult> {
		return this.syncDefinitions(getPermissionDefinitions());
	}

	/**
	 * Sync explicit permission definitions into the database.
	 */
	public async syncDefinitions(definitions: readonly PermissionDefinition[]): Promise<MigrationResult> {
		const created: PermissionDefinition[] = [];
		const updated: PermissionDefinition[] = [];

		const existing = await this.prisma.permission.findMany({
			where: { isDeleted: false },
			select: { id: true, action: true, resource: true, description: true, group: true, isSystem: true },
		});

		const existingMap = new Map<
			string,
			{
				readonly id: string;
				readonly action: string;
				readonly resource: string;
				readonly description: string | null;
				readonly group: string | null;
				readonly isSystem: boolean;
			}
		>();
		for (const perm of existing) {
			existingMap.set(`${perm.action}:${perm.resource}`, perm);
		}

		for (const definition of definitions) {
			const key = `${definition.action}:${definition.resource}`;
			const dbPerm = existingMap.get(key);

			if (dbPerm === undefined) {
				await this.prisma.permission.create({
					data: {
						action: definition.action,
						resource: definition.resource,
						description: definition.description,
						group: definition.group,
						isSystem: definition.isSystem ?? false,
					},
				});
				created.push(definition);
				this.logger.log(`Created permission: ${key}`);
			} else {
				const needsUpdate: boolean = dbPerm.description !== definition.description || dbPerm.group !== definition.group || dbPerm.isSystem !== (definition.isSystem ?? false);

				if (needsUpdate) {
					await this.prisma.permission.update({
						where: { id: dbPerm.id },
						data: {
							description: definition.description,
							group: definition.group,
							isSystem: definition.isSystem ?? false,
						},
					});
					updated.push(definition);
				}
			}

			existingMap.delete(key);
		}

		const orphaned: { readonly id: string; readonly action: string; readonly resource: string }[] = Array.from(existingMap.values()).map((p) => ({
			id: p.id,
			action: p.action,
			resource: p.resource,
		}));

		if (orphaned.length > 0) {
			this.logger.warn(`Found ${String(orphaned.length)} permission(s) in DB not listed in code registry (admin-created or legacy)`);
		}

		if (created.length > 0 || updated.length > 0) {
			this.cache.clear();
		}

		return { created, updated, orphaned };
	}
}
