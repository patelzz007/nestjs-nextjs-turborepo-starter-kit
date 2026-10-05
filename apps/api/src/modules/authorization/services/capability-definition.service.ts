import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { CapabilityScope } from "@prisma/client";
import { CapabilityDefinitionSchema, type CapabilityDefinition, type CapabilitySlug, CapabilitySlugSchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { derivePlatformCapabilityRows } from "../reference-data/platform-capability-rows";
import { SystemPrismaService } from "../../../prisma/system-prisma.service";

type CatalogCache = ReadonlyMap<CapabilityScope, readonly CapabilityDefinition[]>;

/**
 * Generic capability catalog — reads from `capability_definitions`.
 * Cached in-memory per process; invalidated after admin writes.
 */
@Injectable()
export class CapabilityDefinitionService implements OnModuleInit {
	private readonly logger: Logger = new Logger(CapabilityDefinitionService.name);
	private catalogCache: CatalogCache | null = null;

	public constructor(
		private readonly prisma: PrismaService,
		private readonly systemDb: SystemPrismaService,
	) {}

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
		const rows = await derivePlatformCapabilityRows(this.systemDb);
		for (const row of rows) {
			await this.systemDb.capabilityDefinition.upsert({
				where: { slug: row.slug },
				create: { ...row, scope: "PLATFORM" },
				update: { ...row, updatedAt: Date.now() },
			});
		}

		this.invalidateCache();
		this.logger.log(`Synced ${String(rows.length)} platform capability definition(s) from permissions`);
	}

	private async loadCatalogCache(): Promise<CatalogCache> {
		if (this.catalogCache !== null) {
			return this.catalogCache;
		}

		const rows = await this.prisma.capabilityDefinition.findMany({
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
