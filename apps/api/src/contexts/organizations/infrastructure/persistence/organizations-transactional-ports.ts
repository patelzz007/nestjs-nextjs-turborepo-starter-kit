import type { Prisma } from "@prisma/client";
import type { EpochMs } from "@workspace/shared";

import type { MerchantPosSettingsPort, OrganizationsTransactionalPorts, TillOrganizationFacts } from "../../application/ports/merchant-pos-settings.port";
import { isOrganizationOperating } from "../../domain/policies/organization-operating.policy";
import type { OrganizationExistencePort } from "../../application/ports/organization-existence.port";
import { createOrganizationAuditPort, TransactionOrganizationAuditWriter } from "../audit/organization-audit.adapter";

/** The merchant profile's POS policy on the caller's transaction. */
class TransactionMerchantPosSettings implements MerchantPosSettingsPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async tillOrganization(organizationId: string): Promise<TillOrganizationFacts | null> {
		const organization = await this.db.organization.findUnique({
			where: { id: organizationId },
			select: { slug: true, displayName: true, lifecycleState: true, isDeleted: true, merchantProfile: { select: { requireRegisteredTerminals: true } } },
		});
		if (organization === null) {
			return null;
		}
		return {
			slug: organization.slug,
			displayName: organization.displayName,
			operating: isOrganizationOperating(organization),
			requireRegisteredTerminals: organization.merchantProfile?.requireRegisteredTerminals ?? false,
		};
	}

	public async storeNames(locationIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		if (locationIds.length === 0) {
			return new Map();
		}
		const rows = await this.db.organizationLocation.findMany({ where: { id: { in: [...new Set(locationIds)] } }, select: { id: true, name: true } });
		return new Map(rows.map((row): [string, string] => [row.id, row.name]));
	}

	public async lockOpenStore(organizationId: string, locationId: string): Promise<boolean> {
		const locked = await this.db.$queryRaw<{ readonly id: string }[]>`
			SELECT id FROM "OrganizationLocation"
			WHERE id = ${locationId} AND "organizationId" = ${organizationId} AND "isDeleted" = false AND status <> 'INACTIVE'
			FOR SHARE`;
		return locked.length === 1;
	}

	public async requireRegisteredTerminals(organizationId: string): Promise<boolean | null> {
		const profile = await this.db.organizationMerchantProfile.findUnique({ where: { organizationId }, select: { requireRegisteredTerminals: true } });
		return profile?.requireRegisteredTerminals ?? null;
	}

	public async setRequireRegisteredTerminals(organizationId: string, requireRegisteredTerminals: boolean, now: EpochMs): Promise<boolean> {
		const updated = await this.db.organizationMerchantProfile.updateMany({ where: { organizationId }, data: { requireRegisteredTerminals, updatedAt: BigInt(now) } });
		return updated.count === 1;
	}
}

/** Organization existence and ownership on the caller's transaction. */
class TransactionOrganizationExistence implements OrganizationExistencePort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async exists(organizationId: string): Promise<boolean> {
		return (await this.db.organization.count({ where: { id: organizationId, isDeleted: false } })) > 0;
	}

	public async isActiveOwner(organizationId: string, userId: string): Promise<boolean> {
		const owners: number = await this.db.organizationMembership.count({
			where: { organizationId, userId, role: "OWNER", status: "ACTIVE", isDeleted: false, user: { isActive: true, isDeleted: false } },
		});
		return owners > 0;
	}
}

/**
 * Organization ports bound to ANOTHER context's unit-of-work transaction
 * (plan §5.4 cross-context scopes). Only other contexts' `infrastructure/`
 * (their scope factories) may call it, with the same `db` their unit of work hands them.
 */
export function createOrganizationsTransactionalPorts(db: Prisma.TransactionClient): OrganizationsTransactionalPorts {
	return {
		merchantPosSettings: new TransactionMerchantPosSettings(db),
		existence: new TransactionOrganizationExistence(db),
		audit: new TransactionOrganizationAuditWriter(db, createOrganizationAuditPort()),
	};
}
