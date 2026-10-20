import type { Prisma } from "@prisma/client";

import { toAuditLogReferences, type AuditLogTenantRow, type AuditLogReferenceIds, type AuditLogReferences, type AuditLogUserRow } from "./audit-references";

/**
 * Resolves the user and tenant names a page of audit records
 * references — shared by both audit viewers. Bound to the audit read's own
 * transaction (`db`, a system operation). Soft-deleted users and
 * tenants are included on purpose: an audit record outlives its actor.
 */
export class PrismaAuditReferenceReader {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/** The users and tenants with these ids, indexed by id. */
	public async load(ids: AuditLogReferenceIds): Promise<AuditLogReferences> {
		// Sequential: an interactive transaction runs its statements on one connection anyway.
		const users: readonly AuditLogUserRow[] = await this.findUsers(ids.userIds);
		const tenants: readonly AuditLogTenantRow[] = await this.findTenants(ids.tenantIds);
		return toAuditLogReferences(users, tenants);
	}

	private async findUsers(ids: readonly string[]): Promise<readonly AuditLogUserRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return this.db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, email: true, fullName: true } });
	}

	private async findTenants(ids: readonly string[]): Promise<readonly AuditLogTenantRow[]> {
		if (ids.length === 0) {
			return [];
		}
		return this.db.tenant.findMany({ where: { id: { in: [...ids] } }, select: { id: true, displayName: true } });
	}
}
