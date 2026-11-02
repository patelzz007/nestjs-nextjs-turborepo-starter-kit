// ============================================
// platform/infrastructure/tenancy/cached-tenant-route.lookup.ts — the per-request tenant lookup, cached (ADR 072)
// ============================================
// Multi mode resolves `:tenantSlug` on every tenant-scoped request. The answer (id, slug, lifecycle
// state) is shared by every instance and dropped after the tenant's lifecycle changes, so a suspended
// tenant is refused on the next request. A short TTL is the safety net. Unknown slugs are never cached:
// a tenant created a second later must resolve at once.

import { Inject, Injectable } from "@nestjs/common";
import { TenantLifecycleStateSchema } from "@workspace/shared";
import { z } from "zod";

import { APP_CACHE, defineCache, PLATFORM_SCOPE, type AppCache, type CacheDefinition } from "../../application/ports/app-cache.port";
import type { TenantRouteCachePort } from "../../application/tenancy/tenant-route-cache.port";
import type { TenantRouteLookup, TenantRouteRecord } from "../../application/tenancy/tenant-source.port";
import { PrismaTenantRouteLookup } from "./prisma-tenant-route.lookup";

/** Safety net only: lifecycle changes drop the entry after commit. */
export const TENANT_ROUTE_TTL_MS = 30_000;
/** Never served stale: the lifecycle state decides whether the tenant may be served at all. */
const NO_STALE_MS = 0;
const TENANT_ROUTE_ENTRIES = 10_000;

const TenantRouteRecordSchema = z.object({ id: z.string(), slug: z.string(), lifecycleState: TenantLifecycleStateSchema });

function tenantRouteTag(tenantId: string): string {
	return `tenant-route:${tenantId}`;
}

@Injectable()
export class CachedTenantRouteLookup implements TenantRouteLookup, TenantRouteCachePort {
	public readonly routes: CacheDefinition<TenantRouteRecord, "platform"> = defineCache<TenantRouteRecord, "platform">({
		name: "tenancy.route",
		version: 1,
		schema: TenantRouteRecordSchema,
		scope: "platform",
		tier: "two-tier",
		ttlMs: TENANT_ROUTE_TTL_MS,
		staleMs: NO_STALE_MS,
		containsPersonalData: false,
		localMaxEntries: TENANT_ROUTE_ENTRIES,
		sharedMaxKeys: TENANT_ROUTE_ENTRIES,
		tags: (route: TenantRouteRecord): readonly string[] => [tenantRouteTag(route.id)],
	});

	public constructor(
		@Inject(PrismaTenantRouteLookup) private readonly source: TenantRouteLookup,
		@Inject(APP_CACHE) private readonly cache: AppCache,
	) {
		cache.register(this.routes);
	}

	public findLiveById(tenantId: string): Promise<TenantRouteRecord | null> {
		return this.source.findLiveById(tenantId);
	}

	public async findLiveByRouteKey(routeKey: string): Promise<TenantRouteRecord | null> {
		const cached = await this.cache.peek(this.routes, PLATFORM_SCOPE, routeKey);
		if (cached !== null) {
			return cached;
		}
		const found = await this.source.findLiveByRouteKey(routeKey);
		if (found !== null) {
			await this.cache.set(this.routes, PLATFORM_SCOPE, routeKey, found);
		}
		return found;
	}

	public async invalidateTenant(tenantId: string): Promise<void> {
		await this.cache.invalidateTag(this.routes, tenantRouteTag(tenantId));
	}
}
