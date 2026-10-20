import { IanaTimeZoneSchema } from "@workspace/shared";

import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { PublicUrlResolver } from "../../../../config/public-url.resolver";
import type { TenantDisplayData, TenantReadPort } from "../../application/ports/tenant-read.port";
import { mapTenantLogo, TENANT_LOGO_ASSETS_SELECT } from "./tenant-logo";

/** Allowlisted system operation of the cross-context display reads. */
const DISPLAY_DATA_OPERATION = "tenant.display_data.read";

/** {@link TenantReadPort}: one query per call (the logo and its renditions are selected with the tenants). */
export class PrismaTenantReadRepository implements TenantReadPort {
	public constructor(
		private readonly transactions: TenantTransactionService,
		private readonly publicUrls: PublicUrlResolver,
	) {}

	public async getDisplayData(tenantIds: readonly string[]): Promise<ReadonlyMap<string, TenantDisplayData>> {
		const uniqueIds = [...new Set(tenantIds)];
		if (uniqueIds.length === 0) {
			return new Map();
		}
		const rows = await this.transactions.withSystemOperation(
			{ operation: DISPLAY_DATA_OPERATION, reason: "Tenant names and logos for display", actorUserId: null },
			async (tx) =>
				tx.tenant.findMany({
					where: { id: { in: uniqueIds }, isDeleted: false },
					select: { id: true, slug: true, displayName: true, timeZone: true, assets: TENANT_LOGO_ASSETS_SELECT },
				}),
		);
		return new Map(
			rows.map((row): [string, TenantDisplayData] => [
				row.id,
				{
					tenantId: row.id,
					slug: row.slug,
					displayName: row.displayName,
					timeZone: IanaTimeZoneSchema.parse(row.timeZone),
					logo: mapTenantLogo(row.assets, this.publicUrls.resolve),
				},
			]),
		);
	}

	public async listOwnerUserIds(tenantId: string): Promise<readonly string[]> {
		const rows = await this.transactions.withSystemOperation({ operation: DISPLAY_DATA_OPERATION, reason: "Tenant owners to notify", actorUserId: null }, async (tx) =>
			tx.membership.findMany({ where: { tenantId, role: "OWNER", status: "ACTIVE", isDeleted: false }, select: { userId: true } }),
		);
		return rows.map((row) => row.userId);
	}
}
