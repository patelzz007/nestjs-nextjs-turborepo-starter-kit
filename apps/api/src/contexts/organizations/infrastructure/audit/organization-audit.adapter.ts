import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { OrganizationAuditEntry, OrganizationAuditPort, OrganizationAuditWriter } from "../../application/ports/organization-audit.port";

/** The transaction delegate an organization audit row is written through (the caller's transaction). */
export type OrganizationAuditTransaction = Pick<Prisma.TransactionClient, "organizationAuditLog">;

/**
 * The only writer of `OrganizationAuditLog`. Every row is appended INSIDE
 * the caller's transaction, so it commits or rolls back together with the
 * state change it describes. (Kept under its established class name: other
 * contexts still construct it directly while they move to `ORGANIZATION_AUDIT`.)
 */
@Injectable()
export class OrganizationAuditService implements OrganizationAuditPort<OrganizationAuditTransaction> {
	public async recordInTx(tx: OrganizationAuditTransaction, entry: OrganizationAuditEntry): Promise<void> {
		await tx.organizationAuditLog.create({
			data: {
				organizationId: entry.organizationId,
				actorUserId: entry.actorUserId,
				action: entry.action,
				resourceType: entry.resourceType,
				resourceId: entry.resourceId,
				decision: entry.decision ?? null,
				policyVersion: entry.policyVersion,
				correlationId: entry.correlationId ?? null,
				...(entry.metadata === undefined ? {} : { metadata: { ...entry.metadata } }),
			},
		});
	}
}

/** {@link OrganizationAuditWriter} bound to one unit-of-work transaction. */
export class TransactionOrganizationAuditWriter implements OrganizationAuditWriter {
	public constructor(
		private readonly db: OrganizationAuditTransaction,
		private readonly audit: OrganizationAuditPort<OrganizationAuditTransaction>,
	) {}

	public async record(entry: OrganizationAuditEntry): Promise<void> {
		await this.audit.recordInTx(this.db, entry);
	}
}

/** The audit port for code that composes its own objects (CLIs, tests) instead of injecting `ORGANIZATION_AUDIT`. */
export function createOrganizationAuditPort(): OrganizationAuditPort<OrganizationAuditTransaction> {
	return new OrganizationAuditService();
}
