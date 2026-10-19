import { Injectable } from "@nestjs/common";
import { CapabilityDefinitionSchema, type CapabilityDefinition, type CapabilityScope } from "@workspace/shared";

import { PrismaService } from "../../../../prisma/prisma.service";
import type { CapabilityCatalogReadPort } from "../../application/ports/rbac-read.port";

type CatalogCache = ReadonlyMap<CapabilityScope, readonly CapabilityDefinition[]>;

/** `CapabilityDefinition`, kept in memory per process and dropped after the boot sync (`SyncCapabilityCatalog`). */
@Injectable()
export class CapabilityCatalogReader implements CapabilityCatalogReadPort {
	private catalogCache: CatalogCache | null = null;

	public constructor(private readonly prisma: PrismaService) {}

	public invalidate(): void {
		this.catalogCache = null;
	}

	public async listCatalog(scope: CapabilityScope | undefined): Promise<CapabilityDefinition[]> {
		const cache: CatalogCache = await this.load();
		if (scope === undefined) {
			const all: CapabilityDefinition[] = [];
			for (const entries of cache.values()) {
				all.push(...entries);
			}
			return all.sort((left, right) => left.sortOrder - right.sortOrder || left.slug.localeCompare(right.slug));
		}
		return [...(cache.get(scope) ?? [])];
	}

	private async load(): Promise<CatalogCache> {
		if (this.catalogCache !== null) {
			return this.catalogCache;
		}
		const rows = await this.prisma.capabilityDefinition.findMany({
			orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { slug: "asc" }],
			select: { id: true, slug: true, scope: true, label: true, description: true, groupName: true, sortOrder: true, isSystem: true },
		});
		const grouped = new Map<CapabilityScope, CapabilityDefinition[]>();
		for (const row of rows) {
			const parsed = CapabilityDefinitionSchema.safeParse(row);
			if (!parsed.success) {
				continue;
			}
			const bucket: CapabilityDefinition[] = grouped.get(row.scope) ?? [];
			bucket.push(parsed.data);
			grouped.set(row.scope, bucket);
		}
		this.catalogCache = grouped;
		return grouped;
	}
}
