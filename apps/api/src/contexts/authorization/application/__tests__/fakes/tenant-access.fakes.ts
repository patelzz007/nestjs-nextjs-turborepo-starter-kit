import {
	epochMs,
	TENANT_ROLE_TEMPLATE_NAMES,
	TENANT_ROLE_TEMPLATES,
	type EpochMs,
	type MembershipRole,
	type PermissionPair,
	type ShareableResource,
	type ShareLevel,
	type TenantGrantResponse,
	type TenantMemberAccessResponse,
	type TenantRoleResponse,
	type TenantShareResponse,
} from "@workspace/shared";

import type { AccessFacts } from "../../../domain/access/access-facts";
import { StoreScope } from "../../../domain/access/store-scope";
import type { AccessFactsReader } from "../../ports/access-facts.port";
import type { TenantAccessAuditEntry, TenantAccessStore, TenantAccessUnit, TenantMemberRow } from "../../ports/tenant-access-store.port";
import { NOW } from "./authorization.fakes";

export const TENANT_ID = "tenant-1";
export const TENANT_SLUG = "brew";

interface RoleRow {
	id: string;
	name: string;
	templateKey: MembershipRole | null;
	permissions: PermissionPair[];
}

interface MemberRow {
	readonly id: string;
	readonly userId: string;
	roleId: string;
	stores: StoreScope;
}

interface RecordRow {
	readonly id: string;
	readonly locationIds: readonly string[];
}

/**
 * One tenant in memory, behind BOTH ports the service uses — the store it writes and the facts it
 * decides on — so a decision always sees what the last write left (as the database does).
 */
export class InMemoryTenant implements TenantAccessStore, AccessFactsReader {
	public readonly roles: RoleRow[] = [];
	public readonly members: MemberRow[] = [];
	public readonly grants: TenantGrantResponse[] = [];
	public readonly shares: TenantShareResponse[] = [];
	/** The shareable records, by type. */
	public readonly records: Readonly<Record<ShareableResource, RecordRow[]>> = { REWARD: [] };
	public readonly audit: TenantAccessAuditEntry[] = [];
	private nextId = 0;

	public constructor() {
		for (const template of ["OWNER", "MANAGER", "CASHIER"] satisfies MembershipRole[]) {
			this.roles.push({
				id: `role-${template.toLowerCase()}`,
				name: TENANT_ROLE_TEMPLATE_NAMES[template],
				templateKey: template,
				permissions: [...TENANT_ROLE_TEMPLATES[template]],
			});
		}
	}

	public id(prefix: string): string {
		this.nextId += 1;
		return `${prefix}-${String(this.nextId)}`;
	}

	/** Adds a member holding the tenant's copy of a template (`OWNER` / `MANAGER` / `CASHIER`) or the role with that id, at `stores`. */
	public addMember(userId: string, role: string, stores: StoreScope = StoreScope.all()): string {
		const roleId = this.roles.find((candidate) => candidate.templateKey === role)?.id ?? role;
		const id = `member-${userId}`;
		this.members.push({ id, userId, roleId, stores });
		return id;
	}

	public roleIdOf(template: MembershipRole): string {
		return this.roles.find((role) => role.templateKey === template)?.id ?? "";
	}

	// ── AccessFactsReader ─────────────────────────────────────────────────

	public read(userId: string, tenantId: string | undefined): Promise<AccessFacts | null> {
		const member = this.members.find((candidate) => candidate.userId === userId);
		if (tenantId !== TENANT_ID || member === undefined) {
			return Promise.resolve(null);
		}
		return Promise.resolve({
			rolePermissions: this.roles.find((role) => role.id === member.roleId)?.permissions ?? [],
			stores: member.stores,
			grants: this.grants
				.filter((grant) => grant.membershipId === member.id)
				.map((grant) => ({ permission: grant.permission, locationId: grant.locationId, expiresAt: grant.expiresAt })),
			shares: this.shares
				.filter((share) => share.membershipId === member.id)
				.map((share) => ({ resource: share.resource, resourceId: share.resourceId, level: share.level, expiresAt: share.expiresAt })),
		});
	}

	// ── TenantAccessStore ─────────────────────────────────────────────────

	public tenantIdBySlug(slug: string): Promise<string | null> {
		return Promise.resolve(slug === TENANT_SLUG ? TENANT_ID : null);
	}

	public run<TResult>(_tenantId: string, actorUserId: string, work: (unit: TenantAccessUnit) => Promise<TResult>): Promise<TResult> {
		return work(new InMemoryUnit(this, actorUserId));
	}

	public viewOf(role: RoleRow): TenantRoleResponse {
		return {
			id: role.id,
			name: role.name,
			templateKey: role.templateKey,
			permissions: [...role.permissions],
			holderCount: this.members.filter((member) => member.roleId === role.id).length,
		};
	}

	public rowOf(member: MemberRow): TenantMemberRow {
		return {
			id: member.id,
			userId: member.userId,
			fullName: member.userId,
			email: `${member.userId}@example.com`,
			roleId: member.roleId,
			templateKey: this.roles.find((role) => role.id === member.roleId)?.templateKey ?? null,
		};
	}
}

class InMemoryUnit implements TenantAccessUnit {
	public constructor(
		private readonly tenant: InMemoryTenant,
		private readonly actorUserId: string,
	) {}

	public roles(): Promise<readonly TenantRoleResponse[]> {
		return Promise.resolve(this.tenant.roles.map((role) => this.tenant.viewOf(role)));
	}

	public role(roleId: string): Promise<TenantRoleResponse | null> {
		const role = this.tenant.roles.find((candidate) => candidate.id === roleId);
		return Promise.resolve(role === undefined ? null : this.tenant.viewOf(role));
	}

	public createRole(name: string, permissions: readonly PermissionPair[]): Promise<TenantRoleResponse> {
		const role: RoleRow = { id: this.tenant.id("role"), name, templateKey: null, permissions: [...permissions] };
		this.tenant.roles.push(role);
		return Promise.resolve(this.tenant.viewOf(role));
	}

	public updateRole(
		roleId: string,
		change: { readonly name?: string | undefined; readonly permissions?: readonly PermissionPair[] | undefined },
	): Promise<TenantRoleResponse> {
		const role = this.requireRole(roleId);
		role.name = change.name ?? role.name;
		role.permissions = change.permissions === undefined ? role.permissions : [...change.permissions];
		return Promise.resolve(this.tenant.viewOf(role));
	}

	public deleteRole(roleId: string): Promise<void> {
		this.tenant.roles.splice(this.tenant.roles.indexOf(this.requireRole(roleId)), 1);
		return Promise.resolve();
	}

	public resetRole(roleId: string, template: MembershipRole): Promise<TenantRoleResponse> {
		const role = this.requireRole(roleId);
		role.permissions = [...TENANT_ROLE_TEMPLATES[template]];
		return Promise.resolve(this.tenant.viewOf(role));
	}

	public holders(roleId: string): Promise<readonly TenantMemberRow[]> {
		return Promise.resolve(this.tenant.members.filter((member) => member.roleId === roleId).map((member) => this.tenant.rowOf(member)));
	}

	public member(membershipId: string): Promise<TenantMemberRow | null> {
		const member = this.tenant.members.find((candidate) => candidate.id === membershipId);
		return Promise.resolve(member === undefined ? null : this.tenant.rowOf(member));
	}

	public memberAccess(membershipId: string): Promise<TenantMemberAccessResponse | null> {
		const member = this.tenant.members.find((candidate) => candidate.id === membershipId);
		const role = this.tenant.roles.find((candidate) => candidate.id === member?.roleId);
		return Promise.resolve(
			member === undefined || role === undefined
				? null
				: {
						membershipId: member.id,
						userId: member.userId,
						fullName: member.userId,
						email: `${member.userId}@example.com`,
						roleId: role.id,
						roleName: role.name,
						templateKey: role.templateKey,
						locationScopeType: "ALL_LOCATIONS",
						locationIds: [],
					},
		);
	}

	public memberByUser(userId: string): Promise<TenantMemberRow | null> {
		const member = this.tenant.members.find((candidate) => candidate.userId === userId);
		return Promise.resolve(member === undefined ? null : this.tenant.rowOf(member));
	}

	public ownerCount(): Promise<number> {
		return Promise.resolve(this.tenant.members.filter((member) => member.roleId === this.tenant.roleIdOf("OWNER")).length);
	}

	public setMemberRole(membershipId: string, roleId: string): Promise<void> {
		const member = this.tenant.members.find((candidate) => candidate.id === membershipId);
		if (member !== undefined) {
			member.roleId = roleId;
		}
		return Promise.resolve();
	}

	public removeMember(membershipId: string): Promise<void> {
		const index = this.tenant.members.findIndex((member) => member.id === membershipId);
		this.tenant.members.splice(index, 1);
		return Promise.resolve();
	}

	public grants(membershipId: string): Promise<readonly TenantGrantResponse[]> {
		return Promise.resolve(this.tenant.grants.filter((grant) => grant.membershipId === membershipId));
	}

	public grant(grantId: string): Promise<TenantGrantResponse | null> {
		return Promise.resolve(this.tenant.grants.find((grant) => grant.id === grantId) ?? null);
	}

	public createGrant(
		member: TenantMemberRow,
		grant: { readonly permission: PermissionPair; readonly locationId: string | null; readonly expiresAt: EpochMs | null; readonly grantedVia: string },
	): Promise<TenantGrantResponse> {
		const row: TenantGrantResponse = { id: this.tenant.id("grant"), membershipId: member.id, ...grant, grantedBy: this.actorUserId, grantedAt: NOW };
		this.tenant.grants.push(row);
		return Promise.resolve(row);
	}

	public revokeGrant(grantId: string): Promise<void> {
		this.tenant.grants.splice(
			this.tenant.grants.findIndex((grant) => grant.id === grantId),
			1,
		);
		return Promise.resolve();
	}

	public shares(): Promise<readonly TenantShareResponse[]> {
		return Promise.resolve(this.tenant.shares);
	}

	public share(shareId: string): Promise<TenantShareResponse | null> {
		return Promise.resolve(this.tenant.shares.find((share) => share.id === shareId) ?? null);
	}

	public recordStores(resource: ShareableResource, resourceId: string): Promise<{ readonly locationIds: readonly string[] } | null> {
		const record = this.tenant.records[resource].find((candidate) => candidate.id === resourceId);
		return Promise.resolve(record === undefined ? null : { locationIds: record.locationIds });
	}

	public createShare(share: {
		readonly resource: ShareableResource;
		readonly resourceId: string;
		readonly membershipId: string;
		readonly level: ShareLevel;
		readonly expiresAt: EpochMs | null;
	}): Promise<TenantShareResponse> {
		const row: TenantShareResponse = { id: this.tenant.id("share"), ...share, sharedBy: this.actorUserId, sharedAt: epochMs(NOW) };
		this.tenant.shares.push(row);
		return Promise.resolve(row);
	}

	public deleteShare(shareId: string): Promise<void> {
		this.tenant.shares.splice(
			this.tenant.shares.findIndex((share) => share.id === shareId),
			1,
		);
		return Promise.resolve();
	}

	public audit(entry: TenantAccessAuditEntry): Promise<void> {
		this.tenant.audit.push(entry);
		return Promise.resolve();
	}

	private requireRole(roleId: string): RoleRow {
		const role = this.tenant.roles.find((candidate) => candidate.id === roleId);
		if (role === undefined) {
			throw new Error(`no role ${roleId}`);
		}
		return role;
	}
}
