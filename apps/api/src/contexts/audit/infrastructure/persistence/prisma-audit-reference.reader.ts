import type { Prisma } from "@prisma/client";

import { toAuditLogReferences, type AuditLogOrganizationRow, type AuditLogReferenceIds, type AuditLogReferences, type AuditLogUserRow } from "./audit-references";

/**
 * Resolves the user and organization names a page of audit records
 * references — shared by both audit viewers. Bound to the audit read's own
 * transaction (`db`, a system operation). Soft-deleted users and
 * organizations are included on purpose: an audit record outlives its actor.
 */
export class PrismaAuditReferenceReader {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/** The users and organizations with these ids, indexed by id. */
	public async load(ids: AuditLogReferenceIds): Promise<AuditLogReferences> {
		// Sequential: an interactive transaction runs its statements on one connection anyway.
		const users: readonly AuditLogUserRow[] = await this.findUsers(ids.userIds);
		const organizations: readonly AuditLogOrganizationRow[] = await this.findOrganizations(ids.organizationIds);
		return toAuditLogReferences(users, organizations);
	}

	private async findUsers(ids: readonly string[]): Promise<readonly AuditLogUserRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return this.db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, email: true, fullName: true } });
	}

	private async findOrganizations(ids: readonly string[]): Promise<readonly AuditLogOrganizationRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return this.db.organization.findMany({ where: { id: { in: [...ids] } }, select: { id: true, displayName: true } });
	}
}
