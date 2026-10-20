import type { TenantLifecycleState } from "@workspace/shared";
import { TenantLifecycleStateSchema } from "@workspace/shared";
import { z } from "zod";

/** What a tenant source resolved for one request. `none` is a route that has no tenant. */
export const TenantResolutionSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("tenant"),
		tenantId: z.uuid(),
		lifecycleState: TenantLifecycleStateSchema,
	}),
	z.object({ kind: z.literal("none") }),
]);

export type TenantResolution = z.output<typeof TenantResolutionSchema>;

/** The route input a tenant source needs. A missing slug is a route that is not tenant-scoped. */
export interface TenantSourceRequest {
	readonly tenantSlug?: string;
}

/**
 * Where this process's tenant id comes from. Single mode binds {@link FixedTenantSource};
 * multi mode binds {@link RouteTenantSource}. Nothing else branches on the mode.
 */
export interface TenantSource {
	resolve(request: TenantSourceRequest): Promise<TenantResolution>;
}

/** Nest token for the mode-selected {@link TenantSource}. */
export const TENANT_SOURCE = Symbol("TENANT_SOURCE");

/** A live tenant row the slug lookup returns. */
export interface TenantRouteRecord {
	readonly id: string;
	readonly slug: string;
	readonly lifecycleState: TenantLifecycleState;
}

/** Reads a tenant by id or by the route key (current slug, previous slug, or id). */
export interface TenantRouteLookup {
	/** The single-tenant boot check's read of `DEFAULT_TENANT_ID`. */
	findLiveById(tenantId: string): Promise<TenantRouteRecord | null>;
	findLiveByRouteKey(routeKey: string): Promise<TenantRouteRecord | null>;
}

/** The resolution for a row the lookup already loaded. */
export function tenantResolution(record: TenantRouteRecord): TenantResolution {
	return { kind: "tenant", tenantId: record.id, lifecycleState: record.lifecycleState };
}
