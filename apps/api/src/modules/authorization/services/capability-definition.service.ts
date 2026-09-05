import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { CapabilityScope } from "@prisma/client";
import {
	CapabilityDefinitionSchema,
	PermissionActionSchema,
	PermissionResourceSchema,
	type CapabilityDefinition,
	type CapabilitySlug,
	CapabilitySlugSchema,
	toPlatformCapabilitySlug,
} from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

type CatalogCache = ReadonlyMap<CapabilityScope, readonly CapabilityDefinition[]>;

/**
 * Generic capability catalog — reads from `capability_definitions`.
 * Cached in-memory per process; invalidated after admin writes.
 */
@Injectable()
export class CapabilityDefinitionService implements OnModuleInit {
	private readonly logger: Logger = new Logger(CapabilityDefinitionService.name);
	private catalogCache: CatalogCache | null = null;

	public constructor(private readonly prisma: PrismaService) {}

	public async onModuleInit(): Promise<void> {
		await this.syncPlatformCapabilitiesFromPermissions();
	}

	public invalidateCache(): void {
		this.catalogCache = null;
	}

	public async listCatalog(scope?: CapabilityScope): Promise<CapabilityDefinition[]> {
		const cache = await this.loadCatalogCache();
		if (scope === undefined) {
			const all: CapabilityDefinition[] = [];
			for (const entries of cache.values()) {
				all.push(...entries);
			}
			return all.sort((left, right) => left.sortOrder - right.sortOrder || left.slug.localeCompare(right.slug));
		}
		return [...(cache.get(scope) ?? [])];
	}

	public async listSlugs(scope: CapabilityScope): Promise<readonly CapabilitySlug[]> {
		const catalog = await this.listCatalog(scope);
		return catalog.map((entry) => entry.slug);
	}

	public async findBySlug(slug: string): Promise<CapabilityDefinition | null> {
		const parsed = CapabilitySlugSchema.safeParse(slug);
		if (!parsed.success) {
			return null;
		}
		const cache = await this.loadCatalogCache();
		for (const entries of cache.values()) {
			const match = entries.find((entry) => entry.slug === parsed.data);
			if (match !== undefined) {
				return match;
			}
		}
		return null;
	}

	public async syncPlatformCapabilitiesFromPermissions(): Promise<void> {
		const permissions = await this.prisma.permission.findMany({
			where: { isDeleted: false },
			select: {
				id: true,
				action: true,
				resource: true,
				description: true,
				group: true,
				isSystem: true,
			},
		});

		for (const permission of permissions) {
			const actionParsed = PermissionActionSchema.safeParse(permission.action);
			const resourceParsed = PermissionResourceSchema.safeParse(permission.resource);
			if (!actionParsed.success || !resourceParsed.success) {
				continue;
			}
			const slug = toPlatformCapabilitySlug(actionParsed.data, resourceParsed.data);
			await this.prisma.capabilityDefinition.upsert({
				where: { slug },
				create: {
					slug,
					scope: "PLATFORM",
					label: permission.description ?? `${permission.action} ${permission.resource}`,
					description: permission.description,
					groupName: permission.group,
					isSystem: permission.isSystem,
					permissionId: permission.id,
				},
				update: {
					label: permission.description ?? `${permission.action} ${permission.resource}`,
					description: permission.description,
					groupName: permission.group,
					isSystem: permission.isSystem,
					permissionId: permission.id,
					isDeleted: false,
					deletedAt: null,
					updatedAt: Date.now(),
				},
			});
		}

		this.invalidateCache();
		this.logger.log(`Synced ${String(permissions.length)} platform capability definition(s) from permissions`);
	}

	private async loadCatalogCache(): Promise<CatalogCache> {
		if (this.catalogCache !== null) {
			return this.catalogCache;
		}

		const rows = await this.prisma.capabilityDefinition.findMany({
			where: { isDeleted: false },
			orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { slug: "asc" }],
			select: {
				id: true,
				slug: true,
				scope: true,
				label: true,
				description: true,
				groupName: true,
				sortOrder: true,
				isSystem: true,
			},
		});

		const grouped = new Map<CapabilityScope, CapabilityDefinition[]>();
		for (const row of rows) {
			const parsed = CapabilityDefinitionSchema.safeParse({
				id: row.id,
				slug: row.slug,
				scope: row.scope,
				label: row.label,
				description: row.description,
				groupName: row.groupName,
				sortOrder: row.sortOrder,
				isSystem: row.isSystem,
			});
			if (!parsed.success) {
				continue;
			}
			const bucket = grouped.get(row.scope) ?? [];
			bucket.push(parsed.data);
			grouped.set(row.scope, bucket);
		}

		this.catalogCache = grouped;
		return grouped;
	}
}
