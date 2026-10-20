import { Injectable } from "@nestjs/common";

import { TenancyConfigService } from "../../../config/tenancy.config";
import type { TenantProvisioningGate } from "../../application/tenancy/tenant-provisioning.port";

/** Multi mode creates tenants from invites; single mode serves only its configured tenant. */
@Injectable()
export class ModeTenantProvisioningGate implements TenantProvisioningGate {
	public constructor(private readonly tenancy: TenancyConfigService) {}

	public isProvisioningAllowed(): boolean {
		return this.tenancy.mode === "multi";
	}
}
