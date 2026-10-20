import { Injectable } from "@nestjs/common";
import { TenantLifecycleStateSchema, UuidParamSchema } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import type { TenantRouteLookup, TenantRouteRecord } from "../../application/tenancy/tenant-source.port";
import { AUTH_MEMBERSHIP_LOOKUP_OPERATION } from "../../application/shared-system-operations";

const TENANT_ROUTE_SELECT = { id: true, slug: true, lifecycleState: true };

/** Tenant lookups: by route key for request resolution (`auth.membership.lookup`), by id for the single-tenant boot check. */
@Injectable()
export class PrismaTenantRouteLookup implements TenantRouteLookup {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	public async findLiveById(tenantId: string): Promise<TenantRouteRecord | null> {
		const row = await this.tenantTx.withSystemOperation(
			{ operation: "tenancy.default_tenant.verify", reason: "Verify the single-tenant tenant at boot", actorUserId: null },
			async (tx) => tx.tenant.findFirst({ where: { id: tenantId, isDeleted: false }, select: TENANT_ROUTE_SELECT }),
		);
		return row === null ? null : toRecord(row);
	}

	public async findLiveByRouteKey(routeKey: string): Promise<TenantRouteRecord | null> {
		const slugMatches = [{ slug: routeKey }, { slugHistory: { some: { slug: routeKey } } }];
		const row = await this.tenantTx.withSystemOperation(
			{ operation: AUTH_MEMBERSHIP_LOOKUP_OPERATION, reason: "Resolve the tenant named by the route slug", actorUserId: null },
			async (tx) =>
				tx.tenant.findFirst({
					where: {
						isDeleted: false,
						OR: UuidParamSchema.safeParse(routeKey).success ? [{ id: routeKey }, ...slugMatches] : slugMatches,
					},
					select: TENANT_ROUTE_SELECT,
				}),
		);
		return row === null ? null : toRecord(row);
	}
}

function toRecord(row: { readonly id: string; readonly slug: string; readonly lifecycleState: string }): TenantRouteRecord {
	return { id: row.id, slug: row.slug, lifecycleState: TenantLifecycleStateSchema.parse(row.lifecycleState) };
}
