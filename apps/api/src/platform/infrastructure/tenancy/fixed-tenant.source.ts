import { Inject, Injectable } from "@nestjs/common";

import { NotFoundError } from "../../application/errors/app-error";
import { TenancyConfigService } from "../../../config/tenancy.config";
import { PrismaTenantRouteLookup } from "./prisma-tenant-route.lookup";
import { tenantResolution, type TenantResolution, type TenantRouteLookup, type TenantSource, type TenantSourceRequest } from "../../application/tenancy/tenant-source.port";

/**
 * Single mode. A tenant route (`:tenantSlug`) can only name the boot-configured tenant; a slug that
 * names a different tenant is a 404 — there is no other tenant to open. A route without a slug has
 * no tenant, exactly as in multi mode (customer, platform and public routes are tenantless, §4.2),
 * so the only difference between the modes is which tenant a slug may name.
 */
@Injectable()
export class FixedTenantSource implements TenantSource {
	public constructor(
		private readonly tenancy: TenancyConfigService,
		@Inject(PrismaTenantRouteLookup) private readonly lookup: TenantRouteLookup,
	) {}

	public async resolve(request: TenantSourceRequest): Promise<TenantResolution> {
		const routeKey = request.tenantSlug;
		if (routeKey === undefined) {
			return { kind: "none" };
		}
		// One lookup: the tenant the slug names (current slug, previous slug or id), which must be the
		// boot-verified default tenant.
		const named = await this.lookup.findLiveByRouteKey(routeKey);
		if (named?.id !== this.tenancy.defaultTenantId()) {
			throw new NotFoundError({ message: "Tenant not found" });
		}
		return tenantResolution(named);
	}
}
