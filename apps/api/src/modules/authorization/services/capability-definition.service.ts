import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { CapabilityScope } from "@prisma/client";
import { CapabilityDefinitionSchema, type CapabilityDefinition, type CapabilitySlug, CapabilitySlugSchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import type { SystemOperation } from "../../../prisma/system-operation.registry";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { convergePlatformCapabilities, type PlatformCapabilityConvergence } from "../reference-data/platform-capability-rows";

type CatalogCache = ReadonlyMap<CapabilityScope, readonly CapabilityDefinition[]>;

/** The allowlisted system operation the boot sync runs under (system-operation.registry.ts). */
export const CAPABILITY_CATALOG_SYNC_OPERATION: SystemOperation = "authorization.capability_catalog.sync";

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
		private readonly tenantTx: TenantTransactionService,
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

	/**
	 * Boot sync: converge the PLATFORM capability definitions to the permission catalog in ONE
	 * attributed transaction (`authorization.capability_catalog.sync`). Only missing or changed rows
	 * are written, so an up-to-date database records no change (ADR 051).
	 */
	public async syncPlatformCapabilitiesFromPermissions(): Promise<void> {
		const change: PlatformCapabilityConvergence = await this.tenantTx.withSystemOperation(
			{ operation: CAPABILITY_CATALOG_SYNC_OPERATION, reason: "Converge platform capability definitions to the permission catalog at boot", actorUserId: null },
			async (tx) => convergePlatformCapabilities(tx),
		);

		this.invalidateCache();
		this.logger.log(`Platform capability definitions: ${String(change.created)} created, ${String(change.updated)} updated`);
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
