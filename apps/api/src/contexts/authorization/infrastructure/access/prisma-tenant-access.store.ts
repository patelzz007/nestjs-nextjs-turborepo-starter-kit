// ============================================
// infrastructure/access/prisma-tenant-access.store.ts — tenant access administration rows, in Postgres (ADR 067)
// ============================================
// SOLID: implements the `TenantAccessStore` port (Dependency Inversion). It only
// reads and writes rows (Single Responsibility); every rule lives in the domain
// policies and `TenantAccessService`. Design patterns:
//   - UNIT OF WORK: one `PrismaTenantAccessUnit` per transaction, so an operation's
//     writes and its audit row commit together or not at all.
//   - Every query names the tenant: the unit is bound to one tenant at
//     construction, so a row of another tenant is simply never found.

import { Inject, Injectable } from "@nestjs/common";
import type { MembershipRole, Prisma, ResourceAcl } from "@prisma/client";
import {
	epochMs,
	ShareableResourceSchema,
	type EpochMs,
	type PermissionPair,
	type ShareableResource,
	type ShareLevel,
	type TenantGrantResponse,
	type TenantMemberAccessResponse,
	type TenantRoleResponse,
	type TenantShareResponse,
} from "@workspace/shared";
import { z } from "zod";

import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../platform/application/errors/app-error";
import { TENANT_ACCESS_WRITE_OPERATION } from "../../../../platform/application/shared-system-operations";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { TenantAccessAuditEntry, TenantAccessStore, TenantAccessUnit, TenantMemberRow } from "../../application/ports/tenant-access-store.port";
import { mapMembershipLocationScope } from "../../../tenancy/public-api";
import { TenantRoleCopies } from "./tenant-role-copies";

interface AccessTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

const LIVE = { isDeleted: false };

/** "Permanent, or ending after now" — the two alternatives both grants and shares are filtered by. */
type InForceFilters = [{ readonly expiresAt: null }, { readonly expiresAt: { readonly gt: bigint } }];

/** The ACL row a share is written as: one member, one record, one level. */
const SHARE_SUBJECT = "MEMBERSHIP";

const ROLE_VIEW = {
	rolePermissions: { where: { ...LIVE, permission: { ...LIVE, scope: "GLOBAL" } }, include: { permission: true } },
	_count: { select: { memberships: { where: LIVE } } },
} satisfies Prisma.RoleInclude;

type RoleRow = Prisma.RoleGetPayload<{ include: typeof ROLE_VIEW }>;

function optionalEpoch(value: bigint | null): EpochMs | null {
	return value === null ? null : epochMs(Number(value));
}

/** Where a shareable record sits: its stores (none: the whole tenant), or `null` when the tenant has no such live record. */
type RecordStoresLookup = (tx: Prisma.TransactionClient, tenantId: string, resourceId: string) => Promise<{ readonly locationIds: readonly string[] } | null>;

/** A reward: limited to the stores of its location scope (ALL_LOCATIONS: none). */
async function rewardStores(tx: Prisma.TransactionClient, tenantId: string, resourceId: string): Promise<{ readonly locationIds: readonly string[] } | null> {
	const reward = await tx.reward.findFirst({
		where: { id: resourceId, tenantId, ...LIVE },
		select: { locationScopeType: true, locationScopes: { where: LIVE, select: { locationId: true } } },
	});
	if (reward === null) {
		return null;
	}
	return { locationIds: reward.locationScopeType === "ALL_LOCATIONS" ? [] : reward.locationScopes.map((scope) => scope.locationId) };
}

/**
 * The record types a tenant may share, each with its store lookup — a REGISTRY of strategies (Open/Closed:
 * sharing a new record type is one `ShareableResourceSchema` value and one entry here).
 */
const SHAREABLE_RECORDS: Readonly<Record<ShareableResource, RecordStoresLookup>> = {
	REWARD: rewardStores,
};

/** A membership with what the access screens name it by (the account is read under this unit's system operation). */
const MEMBER_VIEW = { tenantRole: true, user: { select: { fullName: true, email: true } } } satisfies Prisma.MembershipInclude;

function memberRowOf(row: Prisma.MembershipGetPayload<{ include: typeof MEMBER_VIEW }>): TenantMemberRow {
	return { id: row.id, userId: row.userId, fullName: row.user.fullName, email: row.user.email, roleId: row.roleId, templateKey: row.tenantRole.templateKey };
}

function roleOf(row: RoleRow): TenantRoleResponse {
	return {
		id: row.id,
		name: row.name,
		templateKey: row.templateKey,
		permissions: row.rolePermissions.map((link) => ({ action: link.permission.action, resource: link.permission.resource })),
		holderCount: row._count.memberships,
	};
}

@Injectable()
export class PrismaTenantAccessStore implements TenantAccessStore {
	public constructor(
		@Inject(TenantTransactionService) private readonly transactions: AccessTransactions,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	/** A route key is a slug or the tenant's id (`TenantRouteKeySchema`). */
	public async tenantIdBySlug(slug: string): Promise<string | null> {
		const tenant = await this.transactions.withSystemOperation(
			{ operation: TENANT_ACCESS_WRITE_OPERATION, reason: "Resolve the tenant an access route names", actorUserId: null },
			(tx) => tx.tenant.findFirst({ where: { ...(z.uuid().safeParse(slug).success ? { id: slug } : { slug }), ...LIVE }, select: { id: true } }),
		);
		return tenant?.id ?? null;
	}

	public run<TResult>(tenantId: string, actorUserId: string, work: (unit: TenantAccessUnit) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withSystemOperation({ operation: TENANT_ACCESS_WRITE_OPERATION, reason: "Administer a tenant's roles, grants and shares", actorUserId }, (tx) =>
			work(new PrismaTenantAccessUnit(tx, tenantId, actorUserId, BigInt(this.clock.now()))),
		);
	}
}

/** One transaction of one tenant (UNIT OF WORK). */
export class PrismaTenantAccessUnit implements TenantAccessUnit {
	private readonly copies: TenantRoleCopies;

	public constructor(
		private readonly tx: Prisma.TransactionClient,
		private readonly tenantId: string,
		private readonly actorUserId: string,
		private readonly now: bigint,
	) {
		this.copies = new TenantRoleCopies(tx);
	}

	// ── Roles ──────────────────────────────────────────────────────────────

	public async roles(): Promise<readonly TenantRoleResponse[]> {
		const rows = await this.tx.role.findMany({ where: { tenantId: this.tenantId, kind: "TENANT", ...LIVE }, include: ROLE_VIEW, orderBy: { createdAt: "asc" } });
		return rows.map(roleOf);
	}

	public async role(roleId: string): Promise<TenantRoleResponse | null> {
		const row = await this.tx.role.findFirst({ where: { id: roleId, tenantId: this.tenantId, kind: "TENANT", ...LIVE }, include: ROLE_VIEW });
		return row === null ? null : roleOf(row);
	}

	public async createRole(name: string, permissions: readonly PermissionPair[]): Promise<TenantRoleResponse> {
		const role = await this.tx.role.create({ data: { name, kind: "TENANT", tenantId: this.tenantId, isSystem: false, createdBy: this.actorUserId } });
		await this.copies.setPermissions(role.id, await this.permissionIds(permissions), this.actorUserId, this.now);
		return this.requireRole(role.id);
	}

	public async updateRole(
		roleId: string,
		change: { readonly name?: string | undefined; readonly permissions?: readonly PermissionPair[] | undefined },
	): Promise<TenantRoleResponse> {
		await this.tx.role.update({
			where: { id: roleId },
			data: { ...(change.name === undefined ? {} : { name: change.name }), updatedAt: this.now, updatedBy: this.actorUserId },
		});
		if (change.permissions !== undefined) {
			await this.copies.setPermissions(roleId, await this.permissionIds(change.permissions), this.actorUserId, this.now);
		}
		return this.requireRole(roleId);
	}

	public async deleteRole(roleId: string): Promise<void> {
		await this.copies.setPermissions(roleId, [], this.actorUserId, this.now);
		await this.tx.role.update({ where: { id: roleId }, data: { isDeleted: true, deletedAt: this.now, deletedBy: this.actorUserId, updatedAt: this.now } });
	}

	public async resetRole(roleId: string, template: MembershipRole): Promise<TenantRoleResponse> {
		await this.copies.resetToTemplate(roleId, template, this.actorUserId, this.now);
		return this.requireRole(roleId);
	}

	public async holders(roleId: string): Promise<readonly TenantMemberRow[]> {
		const rows = await this.tx.membership.findMany({ where: { tenantId: this.tenantId, roleId, ...LIVE }, include: MEMBER_VIEW, orderBy: { id: "asc" } });
		return rows.map(memberRowOf);
	}

	// ── Members ────────────────────────────────────────────────────────────

	public member(membershipId: string): Promise<TenantMemberRow | null> {
		return this.memberWhere({ id: membershipId });
	}

	/** The member's account (name, email) is read here, under this unit's system operation: users RLS is self-only. */
	public async memberAccess(membershipId: string): Promise<TenantMemberAccessResponse | null> {
		const row = await this.tx.membership.findFirst({
			where: { id: membershipId, tenantId: this.tenantId, ...LIVE },
			include: { tenantRole: true, user: { select: { fullName: true, email: true } }, locationScopes: { where: LIVE } },
		});
		if (row === null) {
			return null;
		}
		// The same reading of the scope rows as the team roster (fail closed: any SELECTED row limits the member).
		const { locationScopeType, locationIds } = mapMembershipLocationScope(row);
		return {
			membershipId: row.id,
			userId: row.userId,
			fullName: row.user.fullName,
			email: row.user.email,
			roleId: row.roleId,
			roleName: row.tenantRole.name,
			templateKey: row.tenantRole.templateKey,
			locationScopeType,
			locationIds,
		};
	}

	public memberByUser(userId: string): Promise<TenantMemberRow | null> {
		return this.memberWhere({ userId, status: "ACTIVE" });
	}

	public ownerCount(): Promise<number> {
		return this.tx.membership.count({ where: { tenantId: this.tenantId, status: "ACTIVE", ...LIVE, tenantRole: { templateKey: "OWNER", ...LIVE } } });
	}

	/** The role, and the legacy `role` enum mirrored from its template until ADR 067 Phase 4 (a custom role mirrors CASHIER, the least). */
	public async setMemberRole(membershipId: string, roleId: string, template: MembershipRole | null): Promise<void> {
		await this.tx.membership.update({ where: { id: membershipId }, data: { roleId, role: template ?? "CASHIER", updatedAt: this.now, updatedBy: this.actorUserId } });
	}

	/** Soft-deletes the membership; its shares go with it, its grants are retired. */
	public async removeMember(membershipId: string): Promise<void> {
		const member = await this.tx.membership.update({
			where: { id: membershipId },
			data: { isDeleted: true, deletedAt: this.now, deletedBy: this.actorUserId, updatedAt: this.now },
		});
		const retired = { isDeleted: true, deletedAt: this.now, deletedBy: this.actorUserId, updatedAt: this.now };
		await this.tx.resourceAcl.updateMany({ where: { membershipId, ...LIVE }, data: retired });
		await this.tx.userPermission.updateMany({ where: { userId: member.userId, tenantId: this.tenantId, ...LIVE }, data: retired });
	}

	// ── Grants ─────────────────────────────────────────────────────────────

	public async grants(membershipId: string): Promise<readonly TenantGrantResponse[]> {
		const member = await this.member(membershipId);
		if (member === null) {
			return [];
		}
		const rows = await this.tx.userPermission.findMany({
			where: { userId: member.userId, tenantId: this.tenantId, ...LIVE, OR: this.inForce() },
			include: { permission: true },
			orderBy: { assignedAt: "desc" },
		});
		return rows.map((row) => this.grantOf(row, membershipId));
	}

	public async grant(grantId: string): Promise<TenantGrantResponse | null> {
		const row = await this.tx.userPermission.findFirst({ where: { id: grantId, tenantId: this.tenantId, ...LIVE }, include: { permission: true } });
		if (row === null) {
			return null;
		}
		const member = await this.tx.membership.findFirst({ where: { tenantId: this.tenantId, userId: row.userId, ...LIVE }, select: { id: true } });
		return member === null ? null : this.grantOf(row, member.id);
	}

	public async createGrant(
		member: TenantMemberRow,
		grant: { readonly permission: PermissionPair; readonly locationId: string | null; readonly expiresAt: EpochMs | null; readonly grantedVia: string },
	): Promise<TenantGrantResponse> {
		const permission = await this.tx.permission.findFirst({
			where: { ...LIVE, scope: "GLOBAL", action: grant.permission.action, resource: grant.permission.resource },
			select: { id: true },
		});
		if (permission === null) {
			throw new NotFoundError({ message: "Permission not found" });
		}
		if (grant.locationId !== null && (await this.tx.location.count({ where: { id: grant.locationId, tenantId: this.tenantId, ...LIVE } })) === 0) {
			throw new NotFoundError({ message: "The store for this grant was not found" });
		}
		const row = await this.tx.userPermission.create({
			data: {
				userId: member.userId,
				permissionId: permission.id,
				tenantId: this.tenantId,
				locationId: grant.locationId,
				effect: "ALLOW",
				expiresAt: grant.expiresAt === null ? null : BigInt(grant.expiresAt),
				assignedBy: this.actorUserId,
				assignedAt: this.now,
				grantedVia: grant.grantedVia,
				createdBy: this.actorUserId,
			},
			include: { permission: true },
		});
		return this.grantOf(row, member.id);
	}

	public async revokeGrant(grantId: string): Promise<void> {
		await this.tx.userPermission.update({ where: { id: grantId }, data: { isDeleted: true, deletedAt: this.now, deletedBy: this.actorUserId, updatedAt: this.now } });
	}

	// ── Shares ─────────────────────────────────────────────────────────────

	public async shares(): Promise<readonly TenantShareResponse[]> {
		const rows = await this.tx.resourceAcl.findMany({
			where: { tenantId: this.tenantId, subjectType: SHARE_SUBJECT, ...LIVE, OR: this.inForce() },
			orderBy: { createdAt: "desc" },
		});
		return rows.flatMap((row) => this.shareOf(row));
	}

	public async share(shareId: string): Promise<TenantShareResponse | null> {
		const row = await this.tx.resourceAcl.findFirst({ where: { id: shareId, tenantId: this.tenantId, subjectType: SHARE_SUBJECT, ...LIVE } });
		return row === null ? null : (this.shareOf(row).at(0) ?? null);
	}

	public recordStores(resource: ShareableResource, resourceId: string): Promise<{ readonly locationIds: readonly string[] } | null> {
		return SHAREABLE_RECORDS[resource](this.tx, this.tenantId, resourceId);
	}

	public async createShare(share: {
		readonly resource: ShareableResource;
		readonly resourceId: string;
		readonly membershipId: string;
		readonly level: ShareLevel;
		readonly expiresAt: EpochMs | null;
	}): Promise<TenantShareResponse> {
		const row = await this.tx.resourceAcl.create({
			data: {
				subjectType: SHARE_SUBJECT,
				subjectId: share.membershipId,
				membershipId: share.membershipId,
				action: share.level,
				level: share.level,
				resourceType: share.resource,
				resourceId: share.resourceId,
				effect: "ALLOW",
				tenantId: this.tenantId,
				expiresAt: share.expiresAt === null ? null : BigInt(share.expiresAt),
				assignedBy: this.actorUserId,
				createdBy: this.actorUserId,
			},
		});
		return readBack(this.shareOf(row).at(0));
	}

	public async deleteShare(shareId: string): Promise<void> {
		await this.tx.resourceAcl.update({ where: { id: shareId }, data: { isDeleted: true, deletedAt: this.now, deletedBy: this.actorUserId, updatedAt: this.now } });
	}

	public async audit(entry: TenantAccessAuditEntry): Promise<void> {
		await this.tx.tenantAuditLog.create({
			data: {
				tenantId: this.tenantId,
				actorUserId: this.actorUserId,
				action: entry.action,
				resourceType: entry.resourceType,
				resourceId: entry.resourceId,
				decision: "ALLOW",
				...(entry.metadata === undefined ? {} : { metadata: { ...entry.metadata } }),
			},
		});
	}

	// ── Mapping ────────────────────────────────────────────────────────────

	/** Still in force: permanent, or ending after now (an ended grant or share is history, in the audit trail). */
	private inForce(): InForceFilters {
		return [{ expiresAt: null }, { expiresAt: { gt: this.now } }];
	}

	/** The GLOBAL catalogue row of each `noun.verb` (tenant roles and grants hold only those). */
	private async permissionIds(permissions: readonly PermissionPair[]): Promise<string[]> {
		if (permissions.length === 0) {
			return [];
		}
		const rows = await this.tx.permission.findMany({
			where: { ...LIVE, scope: "GLOBAL", OR: permissions.map((permission) => ({ action: permission.action, resource: permission.resource })) },
			select: { id: true },
		});
		return rows.map((row) => row.id);
	}

	private async memberWhere(where: Prisma.MembershipWhereInput): Promise<TenantMemberRow | null> {
		const row = await this.tx.membership.findFirst({ where: { ...where, tenantId: this.tenantId, ...LIVE }, include: MEMBER_VIEW });
		return row === null ? null : memberRowOf(row);
	}

	private async requireRole(roleId: string): Promise<TenantRoleResponse> {
		return readBack(await this.role(roleId));
	}

	private grantOf(row: Prisma.UserPermissionGetPayload<{ include: { permission: true } }>, membershipId: string): TenantGrantResponse {
		return {
			id: row.id,
			membershipId,
			permission: { action: row.permission.action, resource: row.permission.resource },
			locationId: row.locationId,
			expiresAt: optionalEpoch(row.expiresAt),
			grantedBy: row.assignedBy,
			grantedVia: row.grantedVia,
			grantedAt: epochMs(Number(row.assignedAt)),
		};
	}

	/** A share row, or nothing when it is not a share of a shareable record type. */
	private shareOf(row: ResourceAcl): TenantShareResponse[] {
		const resource = ShareableResourceSchema.safeParse(row.resourceType);
		return !resource.success || row.membershipId === null || row.level === null || row.resourceId === null
			? []
			: [
					{
						id: row.id,
						resource: resource.data,
						resourceId: row.resourceId,
						membershipId: row.membershipId,
						level: row.level,
						expiresAt: optionalEpoch(row.expiresAt),
						sharedBy: row.assignedBy,
						sharedAt: epochMs(Number(row.createdAt)),
					},
				];
	}
}

/** A row written in this very transaction, read back: missing is a bug, never a user error. */
export function readBack<TRow>(row: TRow | null | undefined): TRow {
	if (row === null || row === undefined) {
		throw new Error("A row written in this transaction could not be read back");
	}
	return row;
}
