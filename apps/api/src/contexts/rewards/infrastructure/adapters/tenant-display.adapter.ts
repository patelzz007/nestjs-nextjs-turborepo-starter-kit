import type { TenantReadPort } from "../../../tenancy/public-api";
import type { RewardTenantDisplay } from "../persistence/reward-response.mapper";

/**
 * The merchants' names and logos for a page of rewards, from the tenants context: ONE
 * batched read for every distinct tenant of the page (no N+1, no join into its tables).
 */
export class TenantDisplayAdapter {
	public constructor(private readonly tenants: TenantReadPort) {}

	public async displayData(tenantIds: readonly string[]): Promise<ReadonlyMap<string, RewardTenantDisplay>> {
		const unique = [...new Set(tenantIds)];
		if (unique.length === 0) {
			return new Map();
		}
		const found = await this.tenants.getDisplayData(unique);
		return new Map(
			[...found.values()].map((tenant): [string, RewardTenantDisplay] => [
				tenant.tenantId,
				{ displayName: tenant.displayName, logoUrl: tenant.logo?.url ?? null, logoSources: tenant.logo?.sources ?? [] },
			]),
		);
	}
}
