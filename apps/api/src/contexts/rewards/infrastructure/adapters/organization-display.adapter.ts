import type { OrganizationReadPort } from "../../../organizations/public-api";
import type { RewardOrganizationDisplay } from "../persistence/reward-response.mapper";

/**
 * The merchants' names and logos for a page of rewards, from the organizations context: ONE
 * batched read for every distinct organization of the page (no N+1, no join into its tables).
 */
export class OrganizationDisplayAdapter {
	public constructor(private readonly organizations: OrganizationReadPort) {}

	public async displayData(organizationIds: readonly string[]): Promise<ReadonlyMap<string, RewardOrganizationDisplay>> {
		const unique = [...new Set(organizationIds)];
		if (unique.length === 0) {
			return new Map();
		}
		const found = await this.organizations.getDisplayData(unique);
		return new Map(
			[...found.values()].map((organization): [string, RewardOrganizationDisplay] => [
				organization.organizationId,
				{ displayName: organization.displayName, logoUrl: organization.logo?.url ?? null, logoSources: organization.logo?.sources ?? [] },
			]),
		);
	}
}
