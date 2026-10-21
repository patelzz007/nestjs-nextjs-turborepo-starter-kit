import { Injectable } from "@nestjs/common";

import { TenancyConfigService } from "../../../config/tenancy.config";
import type { ServedTenantPolicy } from "../../application/tenancy/served-tenant.port";

/** Multi mode serves every tenant; single mode serves only its configured tenant. */
@Injectable()
export class ModeServedTenantPolicy implements ServedTenantPolicy {
	public constructor(private readonly tenancy: TenancyConfigService) {}

	public servesTenant(tenantId: string): boolean {
		return this.tenancy.mode === "multi" || tenantId === this.tenancy.defaultTenantId();
	}
}
