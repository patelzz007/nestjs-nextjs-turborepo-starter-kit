import { Inject, Injectable } from "@nestjs/common";
import type { Permission, Prisma } from "@prisma/client";
import type { PermissionAction, PermissionPair, PermissionResource, PermissionScope } from "@workspace/shared";
import { IMPLICIT_SELF_GRANTS, permissionSatisfies } from "@workspace/shared";

import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";

/** Where a grant or denial came from — surfaced in explain() output. */
export type GrantSource = "role" | "store" | "override" | "implicit";

/** The store a store-membership grant is bound to — it applies nowhere else. */
export interface GrantStoreBinding {
	readonly storeId: string;
	readonly tenantId: string;
}

/** One `(action, resource, scope)` capability held (or explicitly denied) by a subject. */
export interface SubjectGrant {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
	readonly scope: PermissionScope;
	readonly source: GrantSource;
	/** Role id, store membership id, override id, or `"self"` for implicit grants. */
	readonly sourceId: string;
	/** Set for grants that come from a store membership role (always STORE scope). */
	readonly store?: GrantStoreBinding;
	/** Stored policy-DSL conditions on the permission (`null` = unconditional). */
	readonly conditions: Permission["conditions"];
}

/** Normalized authorization state for one subject (spec §89 — no nested includes). */
export interface SubjectGrants {
	/** Directly assigned + inherited (ancestor) active role ids. */
	readonly roleIds: readonly string[];
	/** Names of directly assigned active roles. */
	readonly roleNames: readonly string[];
	readonly grants: readonly SubjectGrant[];
	/** Explicit per-user DENY overrides — they beat every grant. */
	readonly denials: readonly SubjectGrant[];
}

interface RoleNode {
	readonly id: string;
	readonly parentId: string | null;
}

/** Grants that satisfy `(action, resource)` — `MANAGE` implies every action. */
export function grantsFor(grants: readonly SubjectGrant[], required: PermissionPair): SubjectGrant[] {
	return grants.filter((grant) => permissionSatisfies({ action: grant.action, resource: grant.resource }, required));
}

/**
 * Walk parent links breadth-first from `start`, collecting every active role
 * id (the start roles included); each level is one query, cycles are ignored.
 */
export async function collectRoleHierarchy(db: Prisma.TransactionClient, start: readonly RoleNode[]): Promise<string[]> {
	const collected = new Set<string>();
	let frontier: readonly RoleNode[] = start;

	while (frontier.length > 0) {
		const parentIds: string[] = [];
		for (const role of frontier) {
			if (collected.has(role.id)) {
				continue;
			}
			collected.add(role.id);
			if (role.parentId !== null && !collected.has(role.parentId)) {
				parentIds.push(role.parentId);
			}
		}
		if (parentIds.length === 0) {
			break;
		}
		frontier = await db.role.findMany({
			where: { id: { in: parentIds }, isActive: true, isDeleted: false },
			select: { id: true, parentId: true },
		});
	}

	return Array.from(collected);
}

/** Principal grant reads the authorization decision makes before the handler's RLS scope exists. */
interface PrincipalGrantLookup {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * Loads a subject's roles (with hierarchy), role permissions, and user
 * overrides in a fixed number of batched queries — never one query per
 * permission (spec §58).
 */
@Injectable()
export class SubjectGrantsLoader {
	public constructor(@Inject(TenantTransactionService) private readonly transactions: PrincipalGrantLookup) {}

	public async load(userId: string): Promise<SubjectGrants> {
		return this.transactions.withSystemOperation(
			{ operation: PRINCIPAL_LOOKUP_OPERATION, reason: "Load the caller's roles, grants, and store-membership roles", actorUserId: userId },
			(tx) => this.loadOn(tx, userId),
		);
	}

	private async loadOn(db: Prisma.TransactionClient, userId: string): Promise<SubjectGrants> {
		const now = Date.now();

		const [userRoles, overrides] = await Promise.all([
			db.userRole.findMany({
				where: { userId, isDeleted: false, role: { isActive: true, isDeleted: false } },
				select: { role: { select: { id: true, name: true, parentId: true } } },
			}),
			db.userPermission.findMany({
				where: {
					userId,
					isDeleted: false,
					permission: { isDeleted: false },
					OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
				},
				select: { id: true, effect: true, permission: { select: { action: true, resource: true, scope: true, conditions: true } } },
			}),
		]);

		const roleIds = await collectRoleHierarchy(
			db,
			userRoles.map((userRole) => userRole.role),
		);
		const storeGrants = await this.loadStoreGrants(db, userId);

		const rolePermissions =
			roleIds.length === 0
				? []
				: await db.rolePermission.findMany({
						where: { roleId: { in: roleIds }, isDeleted: false, permission: { isDeleted: false } },
						select: { roleId: true, permission: { select: { action: true, resource: true, scope: true, conditions: true } } },
					});

		const grants: SubjectGrant[] = rolePermissions.map((rolePermission) => ({
			action: rolePermission.permission.action,
			resource: rolePermission.permission.resource,
			scope: rolePermission.permission.scope,
			source: "role",
			sourceId: rolePermission.roleId,
			conditions: rolePermission.permission.conditions,
		}));

		const denials: SubjectGrant[] = [];
		for (const override of overrides) {
			const entry: SubjectGrant = {
				action: override.permission.action,
				resource: override.permission.resource,
				scope: override.permission.scope,
				source: "override",
				sourceId: override.id,
				conditions: override.permission.conditions,
			};
			if (override.effect === "DENY") {
				denials.push(entry);
			} else {
				grants.push(entry);
			}
		}

		grants.push(...storeGrants);

		for (const implicit of IMPLICIT_SELF_GRANTS) {
			grants.push({ action: implicit.action, resource: implicit.resource, scope: "OWN", source: "implicit", sourceId: "self", conditions: null });
		}

		return {
			roleIds,
			roleNames: userRoles.map((userRole) => userRole.role.name),
			grants,
			denials,
		};
	}

	/**
	 * Store membership roles (spec §36): each role's permissions (with its
	 * hierarchy) apply only inside that store, whatever scope the permission
	 * row carries — a store role can never grant platform-wide access.
	 */
	private async loadStoreGrants(db: Prisma.TransactionClient, userId: string): Promise<SubjectGrant[]> {
		const memberships = await db.storeMembership.findMany({
			where: { userId, status: "ACTIVE", isDeleted: false, store: { isDeleted: false, status: "ACTIVE" }, role: { isActive: true, isDeleted: false } },
			select: { id: true, storeId: true, tenantId: true, role: { select: { id: true, parentId: true } } },
		});
		if (memberships.length === 0) {
			return [];
		}

		const grants: SubjectGrant[] = [];
		for (const membership of memberships) {
			const roleIds = await collectRoleHierarchy(db, [membership.role]);
			const rolePermissions = await db.rolePermission.findMany({
				where: { roleId: { in: roleIds }, isDeleted: false, permission: { isDeleted: false } },
				select: { permission: { select: { action: true, resource: true, conditions: true } } },
			});
			for (const rolePermission of rolePermissions) {
				grants.push({
					action: rolePermission.permission.action,
					resource: rolePermission.permission.resource,
					scope: "STORE",
					source: "store",
					sourceId: membership.id,
					store: { storeId: membership.storeId, tenantId: membership.tenantId },
					conditions: rolePermission.permission.conditions,
				});
			}
		}
		return grants;
	}
}
