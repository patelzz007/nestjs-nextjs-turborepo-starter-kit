import { IanaTimeZoneSchema } from "@workspace/shared";

import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { PublicUrlResolver } from "../../../../config/public-url.resolver";
import type { OrganizationDisplayData, OrganizationReadPort } from "../../application/ports/organization-read.port";
import { mapOrganizationLogo, ORGANIZATION_LOGO_ASSETS_SELECT } from "./organization-logo";

/** Allowlisted system operation of the cross-context display reads. */
const DISPLAY_DATA_OPERATION = "organization.display_data.read";

/** {@link OrganizationReadPort}: one query per call (the logo and its renditions are selected with the organizations). */
export class PrismaOrganizationReadRepository implements OrganizationReadPort {
	public constructor(
		private readonly transactions: TenantTransactionService,
		private readonly publicUrls: PublicUrlResolver,
	) {}

	public async getDisplayData(organizationIds: readonly string[]): Promise<ReadonlyMap<string, OrganizationDisplayData>> {
		const uniqueIds = [...new Set(organizationIds)];
		if (uniqueIds.length === 0) {
			return new Map();
		}
		const rows = await this.transactions.withSystemOperation(
			{ operation: DISPLAY_DATA_OPERATION, reason: "Organization names and logos for display", actorUserId: null },
			async (tx) =>
				tx.organization.findMany({
					where: { id: { in: uniqueIds }, isDeleted: false },
					select: { id: true, slug: true, displayName: true, timeZone: true, assets: ORGANIZATION_LOGO_ASSETS_SELECT },
				}),
		);
		return new Map(
			rows.map((row): [string, OrganizationDisplayData] => [
				row.id,
				{
					organizationId: row.id,
					slug: row.slug,
					displayName: row.displayName,
					timeZone: IanaTimeZoneSchema.parse(row.timeZone),
					logo: mapOrganizationLogo(row.assets, this.publicUrls.resolve),
				},
			]),
		);
	}

	public async listOwnerUserIds(organizationId: string): Promise<readonly string[]> {
		const rows = await this.transactions.withSystemOperation({ operation: DISPLAY_DATA_OPERATION, reason: "Organization owners to notify", actorUserId: null }, async (tx) =>
			tx.organizationMembership.findMany({ where: { organizationId, role: "OWNER", status: "ACTIVE", isDeleted: false }, select: { userId: true } }),
		);
		return rows.map((row) => row.userId);
	}
}
