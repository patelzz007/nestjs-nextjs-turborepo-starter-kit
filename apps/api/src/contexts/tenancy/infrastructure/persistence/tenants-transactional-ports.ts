import type { Prisma } from "@prisma/client";
import type { EpochMs } from "@workspace/shared";

import type { MerchantPosSettingsPort, TenantsTransactionalPorts, TillTenantFacts } from "../../application/ports/merchant-pos-settings.port";
import { isTenantOperating } from "../../domain/policies/tenant-operating.policy";
import type { TenantExistencePort } from "../../application/ports/tenant-existence.port";
import type { CustomerStandingPort } from "../../application/ports/customer-standing.port";
import { createTenantAuditPort, TransactionTenantAuditWriter } from "../audit/tenant-audit.adapter";

/** The merchant profile's POS policy on the caller's transaction. */
class TransactionMerchantPosSettings implements MerchantPosSettingsPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async tillTenant(tenantId: string): Promise<TillTenantFacts | null> {
		const tenant = await this.db.tenant.findUnique({
			where: { id: tenantId },
			select: { slug: true, displayName: true, lifecycleState: true, isDeleted: true, merchantProfile: { select: { requireRegisteredTerminals: true } } },
		});
		if (tenant === null) {
			return null;
		}
		return {
			slug: tenant.slug,
			displayName: tenant.displayName,
			operating: isTenantOperating(tenant),
			requireRegisteredTerminals: tenant.merchantProfile?.requireRegisteredTerminals ?? false,
		};
	}

	public async storeNames(locationIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		if (locationIds.length === 0) {
			return new Map();
		}
		const rows = await this.db.location.findMany({ where: { id: { in: [...new Set(locationIds)] } }, select: { id: true, name: true } });
		return new Map(rows.map((row): [string, string] => [row.id, row.name]));
	}

	public async lockOpenStore(tenantId: string, locationId: string): Promise<boolean> {
		const locked = await this.db.$queryRaw<{ readonly id: string }[]>`
			SELECT id FROM "Location"
			WHERE id = ${locationId} AND "tenantId" = ${tenantId} AND "isDeleted" = false AND status <> 'INACTIVE'
			FOR SHARE`;
		return locked.length === 1;
	}

	public async requireRegisteredTerminals(tenantId: string): Promise<boolean | null> {
		const profile = await this.db.tenantMerchantProfile.findUnique({ where: { tenantId }, select: { requireRegisteredTerminals: true } });
		return profile?.requireRegisteredTerminals ?? null;
	}

	public async setRequireRegisteredTerminals(tenantId: string, requireRegisteredTerminals: boolean, now: EpochMs): Promise<boolean> {
		const updated = await this.db.tenantMerchantProfile.updateMany({ where: { tenantId }, data: { requireRegisteredTerminals, updatedAt: BigInt(now) } });
		return updated.count === 1;
	}
}

/** Tenant existence and ownership on the caller's transaction. */
class TransactionTenantExistence implements TenantExistencePort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async exists(tenantId: string): Promise<boolean> {
		return (await this.db.tenant.count({ where: { id: tenantId, isDeleted: false } })) > 0;
	}

	public async isActiveOwner(tenantId: string, userId: string): Promise<boolean> {
		const owners: number = await this.db.membership.count({
			where: { tenantId, userId, role: "OWNER", status: "ACTIVE", isDeleted: false, user: { isActive: true, isDeleted: false } },
		});
		return owners > 0;
	}
}

/** The tenant's operating state and its customer bans on the caller's transaction. */
class TransactionCustomerStanding implements CustomerStandingPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async tenantOperates(tenantId: string): Promise<boolean> {
		const tenant = await this.db.tenant.findUnique({ where: { id: tenantId }, select: { lifecycleState: true, isDeleted: true } });
		return tenant !== null && isTenantOperating(tenant);
	}

	public async bannedCustomers(tenantId: string, customerUserIds: readonly string[]): Promise<ReadonlySet<string>> {
		if (customerUserIds.length === 0) {
			return new Set();
		}
		const rows = await this.db.tenantCustomerBan.findMany({
			where: { tenantId, customerUserId: { in: [...new Set(customerUserIds)] }, liftedAt: null, isDeleted: false },
			select: { customerUserId: true },
		});
		return new Set(rows.map((row): string => row.customerUserId));
	}
}

/**
 * Tenant ports bound to ANOTHER context's unit-of-work transaction
 * (plan §5.4 cross-context scopes). Only other contexts' `infrastructure/`
 * (their scope factories) may call it, with the same `db` their unit of work hands them.
 */
export function createTenantsTransactionalPorts(db: Prisma.TransactionClient): TenantsTransactionalPorts {
	return {
		merchantPosSettings: new TransactionMerchantPosSettings(db),
		existence: new TransactionTenantExistence(db),
		customerStanding: new TransactionCustomerStanding(db),
		audit: new TransactionTenantAuditWriter(db, createTenantAuditPort()),
	};
}
