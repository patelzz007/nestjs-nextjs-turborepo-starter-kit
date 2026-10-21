import { Global, Module } from "@nestjs/common";

import { TenancyConfigService } from "../../../config/tenancy.config";
import { SERVED_TENANT_POLICY } from "../../application/tenancy/served-tenant.port";
import { TENANT_PROVISIONING_GATE } from "../../application/tenancy/tenant-provisioning.port";
import { TENANT_SOURCE, type TenantSource } from "../../application/tenancy/tenant-source.port";
import { DefaultTenantService } from "./default-tenant.service";
import { FixedTenantSource } from "./fixed-tenant.source";
import { PrismaTenantRouteLookup } from "./prisma-tenant-route.lookup";
import { RouteTenantSource } from "./route-tenant.source";
import { ModeServedTenantPolicy } from "./served-tenant.policy";
import { ModeTenantProvisioningGate } from "./tenant-provisioning.gate";

/** Single mode serves the fixed tenant. Multi mode resolves `:tenantSlug`. This is the mode branch. */
export function selectTenantSource(tenancy: TenancyConfigService, fixed: FixedTenantSource, route: RouteTenantSource): TenantSource {
	return tenancy.mode === "single" ? fixed : route;
}

/** Resolves the tenant a request is scoped to, verifies the single-mode tenant at boot, and says which tenants are served and whether new ones may be created. */
@Global()
@Module({
	providers: [
		DefaultTenantService,
		PrismaTenantRouteLookup,
		FixedTenantSource,
		RouteTenantSource,
		{
			provide: TENANT_SOURCE,
			useFactory: selectTenantSource,
			inject: [TenancyConfigService, FixedTenantSource, RouteTenantSource],
		},
		ModeTenantProvisioningGate,
		{ provide: TENANT_PROVISIONING_GATE, useExisting: ModeTenantProvisioningGate },
		ModeServedTenantPolicy,
		{ provide: SERVED_TENANT_POLICY, useExisting: ModeServedTenantPolicy },
	],
	exports: [DefaultTenantService, TENANT_SOURCE, TENANT_PROVISIONING_GATE, SERVED_TENANT_POLICY],
})
export class TenancyModule {}
