import { Inject, Injectable } from "@nestjs/common";

import { NotFoundError } from "../../application/errors/app-error";
import { PrismaTenantRouteLookup } from "./prisma-tenant-route.lookup";
import { tenantResolution, type TenantResolution, type TenantRouteLookup, type TenantSource, type TenantSourceRequest } from "../../application/tenancy/tenant-source.port";

/**
 * Multi mode. The tenant is the `:tenantSlug` segment: the current slug, a previous slug, or the id.
 * A route with no slug has no tenant. An unknown slug is a 404.
 */
@Injectable()
export class RouteTenantSource implements TenantSource {
	public constructor(@Inject(PrismaTenantRouteLookup) private readonly lookup: TenantRouteLookup) {}

	public async resolve(request: TenantSourceRequest): Promise<TenantResolution> {
		const routeKey = request.tenantSlug;
		if (routeKey === undefined) {
			return { kind: "none" };
		}
		const tenant = await this.lookup.findLiveByRouteKey(routeKey);
		if (tenant === null) {
			throw new NotFoundError({ message: "Tenant not found" });
		}
		return tenantResolution(tenant);
	}
}
