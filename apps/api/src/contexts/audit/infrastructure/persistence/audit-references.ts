import type { Prisma } from "@prisma/client";
import type { AuditLogTenant, AuditLogUser } from "@workspace/shared";

// ── The people and tenants an audit record names ──────────────────────────
// Both audit trails (HTTP requests — ADR 025; row changes — ADR 051) store
// bare ids with no foreign keys: a record outlives its actor and tenant. The
// viewer resolves the ids of one page at a time; an id that no longer
// resolves is still shown, because the id itself is the forensic fact.

/** A user an audit record names, as the viewer shows it. */
export type AuditLogUserRow = Prisma.UserGetPayload<{ select: { id: true; email: true; fullName: true } }>;

/** A tenant an audit record is scoped to, as the viewer shows it. */
export type AuditLogTenantRow = Prisma.TenantGetPayload<{ select: { id: true; displayName: true } }>;

/** The user and tenant rows a page of audit records references, keyed by id. */
export interface AuditLogReferences {
	readonly users: ReadonlyMap<string, AuditLogUserRow>;
	readonly tenants: ReadonlyMap<string, AuditLogTenantRow>;
}

/** The ids a page of records names — what {@link AuditLogReferences} are loaded for. */
export interface AuditLogReferenceIds {
	readonly userIds: readonly string[];
	readonly tenantIds: readonly string[];
}

/** The distinct, non-null ids, in first-seen order. */
export function distinctReferenceIds(ids: readonly (string | null)[]): string[] {
	return [...new Set(ids.filter((id): id is string => id !== null))];
}

/** Index looked-up rows by id. */
export function toAuditLogReferences(users: readonly AuditLogUserRow[], tenants: readonly AuditLogTenantRow[]): AuditLogReferences {
	return {
		users: new Map(users.map((user): [string, AuditLogUserRow] => [user.id, user])),
		tenants: new Map(tenants.map((tenant): [string, AuditLogTenantRow] => [tenant.id, tenant])),
	};
}

/** The user a record names; `email` / `fullName` are `null` when the id no longer resolves. `null` when the record names none. */
export function toAuditLogUser(id: string | null, references: AuditLogReferences): AuditLogUser | null {
	if (id === null) {
		return null;
	}
	const user: AuditLogUserRow | undefined = references.users.get(id);
	return { id, email: user?.email ?? null, fullName: user?.fullName ?? null };
}

/** The tenant a record is scoped to; `name` is `null` when the id no longer resolves. `null` when the record names none. */
export function toAuditLogTenant(id: string | null, references: AuditLogReferences): AuditLogTenant | null {
	if (id === null) {
		return null;
	}
	return { id, name: references.tenants.get(id)?.displayName ?? null };
}
