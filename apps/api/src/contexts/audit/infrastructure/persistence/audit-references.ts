import type { Prisma } from "@prisma/client";
import type { AuditLogOrganization, AuditLogUser } from "@workspace/shared";

// ── The people and tenants an audit record names ──────────────────────────
// Both audit trails (HTTP requests — ADR 025; row changes — ADR 051) store
// bare ids with no foreign keys: a record outlives its actor and tenant. The
// viewer resolves the ids of one page at a time; an id that no longer
// resolves is still shown, because the id itself is the forensic fact.

/** A user an audit record names, as the viewer shows it. */
export type AuditLogUserRow = Prisma.UserGetPayload<{ select: { id: true; email: true; fullName: true } }>;

/** An organization an audit record is scoped to, as the viewer shows it. */
export type AuditLogOrganizationRow = Prisma.OrganizationGetPayload<{ select: { id: true; displayName: true } }>;

/** The user and organization rows a page of audit records references, keyed by id. */
export interface AuditLogReferences {
	readonly users: ReadonlyMap<string, AuditLogUserRow>;
	readonly organizations: ReadonlyMap<string, AuditLogOrganizationRow>;
}

/** The ids a page of records names — what {@link AuditLogReferences} are loaded for. */
export interface AuditLogReferenceIds {
	readonly userIds: readonly string[];
	readonly organizationIds: readonly string[];
}

/** The distinct, non-null ids, in first-seen order. */
export function distinctReferenceIds(ids: readonly (string | null)[]): string[] {
	return [...new Set(ids.filter((id): id is string => id !== null))];
}

/** Index looked-up rows by id. */
export function toAuditLogReferences(users: readonly AuditLogUserRow[], organizations: readonly AuditLogOrganizationRow[]): AuditLogReferences {
	return {
		users: new Map(users.map((user): [string, AuditLogUserRow] => [user.id, user])),
		organizations: new Map(organizations.map((organization): [string, AuditLogOrganizationRow] => [organization.id, organization])),
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

/** The organization a record is scoped to; `name` is `null` when the id no longer resolves. `null` when the record names none. */
export function toAuditLogOrganization(id: string | null, references: AuditLogReferences): AuditLogOrganization | null {
	if (id === null) {
		return null;
	}
	return { id, name: references.organizations.get(id)?.displayName ?? null };
}
