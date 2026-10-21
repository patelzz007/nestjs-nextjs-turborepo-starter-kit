import type { PilotCity } from "@workspace/shared";

import type { Tenant } from "../aggregates/tenant.aggregate";

/** Persistence port of the {@link Tenant} aggregate (bound to one unit of work). */
export interface TenantRepository {
	nextId(): string;
	/** The first free slug derived from `displayName` (`name`, `name-2`, …), checked against live slugs and slug history. */
	allocateSlug(displayName: string): Promise<string>;
	/** Inserts the tenant with its merchant profile, placement and lifecycle events. A taken slug throws `TenantSlugTakenError`. */
	add(tenant: Tenant): Promise<void>;
	/** A live tenant. */
	findById(tenantId: string): Promise<Tenant | null>;
	/** A live, not DELETED tenant by its route key (current slug, previous slug or id) — any other lifecycle state. */
	findByRouteKey(routeKey: string): Promise<Tenant | null>;
	/** The pilot city on the live tenant's merchant profile; `null` when it has no merchant profile. */
	findMerchantCity(tenantId: string): Promise<PilotCity | null>;
	/** Writes the lifecycle change (compare-and-set on the loaded state), rename and lifecycle events. */
	save(tenant: Tenant): Promise<void>;
}
