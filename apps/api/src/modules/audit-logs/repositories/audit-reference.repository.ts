import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { toAuditLogReferences, type AuditLogOrganizationRow, type AuditLogReferenceIds, type AuditLogReferences, type AuditLogUserRow } from "../audit-references";

/**
 * Resolves the user and organization names a page of audit records
 * references — shared by both audit viewers. Reads run on the caller's audit
 * read transaction (`db`, a system operation). Soft-deleted users and
 * organizations are included on purpose: an audit record outlives its actor.
 */
@Injectable()
export class AuditReferenceRepository {
	/** The users and organizations with these ids, indexed by id. */
	public async load(ids: AuditLogReferenceIds, db: Prisma.TransactionClient): Promise<AuditLogReferences> {
		// Sequential: an interactive transaction runs its statements on one connection anyway.
		const users: readonly AuditLogUserRow[] = await this.findUsers(ids.userIds, db);
		const organizations: readonly AuditLogOrganizationRow[] = await this.findOrganizations(ids.organizationIds, db);
		return toAuditLogReferences(users, organizations);
	}

	private async findUsers(ids: readonly string[], db: Prisma.TransactionClient): Promise<readonly AuditLogUserRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, email: true, fullName: true } });
	}

	private async findOrganizations(ids: readonly string[], db: Prisma.TransactionClient): Promise<readonly AuditLogOrganizationRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return db.organization.findMany({ where: { id: { in: [...ids] } }, select: { id: true, displayName: true } });
	}
}
