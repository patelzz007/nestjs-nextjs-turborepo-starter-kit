import type { TenantReadPort } from "../../../tenancy/public-api";
import type { AnalyticsTenant, AnalyticsTenantReadPort } from "../../application/ports/analytics-tenant-read.port";

/** Tenant display data for analytics, over the tenants `TenantReadPort`. */
export class TenantAnalyticsReadAdapter implements AnalyticsTenantReadPort {
	public constructor(private readonly tenants: TenantReadPort) {}

	public async findById(tenantId: string): Promise<AnalyticsTenant | null> {
		const tenant = (await this.tenants.getDisplayData([tenantId])).get(tenantId);
		return tenant === undefined ? null : { slug: tenant.slug, displayName: tenant.displayName, timeZone: tenant.timeZone };
	}
}
