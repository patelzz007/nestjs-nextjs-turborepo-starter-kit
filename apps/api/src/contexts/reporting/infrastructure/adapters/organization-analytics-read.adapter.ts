import type { OrganizationReadPort } from "../../../organizations/public-api";
import type { AnalyticsOrganization, AnalyticsOrganizationReadPort } from "../../application/ports/analytics-organization-read.port";

/** Organization display data for analytics, over the organizations `OrganizationReadPort`. */
export class OrganizationAnalyticsReadAdapter implements AnalyticsOrganizationReadPort {
	public constructor(private readonly organizations: OrganizationReadPort) {}

	public async findById(organizationId: string): Promise<AnalyticsOrganization | null> {
		const organization = (await this.organizations.getDisplayData([organizationId])).get(organizationId);
		return organization === undefined ? null : { slug: organization.slug, displayName: organization.displayName, timeZone: organization.timeZone };
	}
}
