// ============================================
// application/services/tenant-access.service.ts — a tenant administers its own access (ADR 067)
// ============================================
// Design patterns and SOLID:
//   - FACADE over the decision service, the guardrail policies and the store:
//     one class, one method per operation, so the whole rule set reads top to bottom.
//   - TEMPLATE METHOD: `administer` is the fixed skeleton every operation runs —
//     resolve the caller's tenant → decide the permission (deny by default) →
//     run ONE transaction — and each operation supplies only its own step.
//   - Dependency Inversion: the decision service, the facts reader and the store
//     are injected ports; the guardrails are pure domain functions.
// Deliberately one service rather than one CQRS command per operation: the
// operations share one skeleton and one set of guardrails, and splitting them
// would repeat both ten times.

import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type {
	PermissionPair,
	TenantGrantCreateInput,
	TenantGrantResponse,
	TenantMemberAccessResponse,
	TenantRoleCreateInput,
	TenantRoleHolders,
	TenantRoleReassignInput,
	TenantRoleResponse,
	TenantRoleUpdateInput,
	TenantShareCreateInput,
	TenantShareResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { NotFoundError } from "../../../../platform/application/errors/app-error";
import { SHARE_LEVEL_ACTIONS } from "../../domain/access/access-request";
import { StoreScope } from "../../domain/access/store-scope";
import {
	assertDelegable,
	assertOwnerChange,
	assertRoleEditable,
	assertTenantPermissions,
	DelegationRefusedError,
	OwnerRequiredError,
	RoleInUseError,
	StaleHoldersError,
} from "../../domain/access/tenant-access.policy";
import { AccessDeniedError } from "../../domain/errors/authorization.errors";
import { ACCESS_FACTS_READER, type AccessFactsReader } from "../ports/access-facts.port";
import { TENANT_ACCESS_STORE, type TenantAccessStore, type TenantAccessUnit, type TenantMemberRow } from "../ports/tenant-access-store.port";
import { AccessControlService } from "./access-control.service";

/** The tenant a route names, and who called it. */
export interface TenantRoute {
	readonly actor: ActorContext;
	readonly tenantSlug: string;
}

/** Who is acting, in which tenant. */
interface Caller {
	readonly userId: string;
	readonly tenantId: string;
}

/** A stable fingerprint of a role's holders: reassign must quote the list it was made for. */
export function holdersVersionOf(membershipIds: readonly string[]): string {
	return createHash("sha256")
		.update([...membershipIds].sort().join(","))
		.digest("hex");
}

function pair(resource: PermissionPair["resource"], action: PermissionPair["action"]): PermissionPair {
	return { action, resource };
}

@Injectable()
export class TenantAccessService {
	public constructor(
		private readonly accessControl: AccessControlService,
		@Inject(ACCESS_FACTS_READER) private readonly facts: AccessFactsReader,
		@Inject(TENANT_ACCESS_STORE) private readonly store: TenantAccessStore,
	) {}

	// ── Roles ──────────────────────────────────────────────────────────────

	public listRoles(route: TenantRoute): Promise<readonly TenantRoleResponse[]> {
		return this.administer(route, pair("ROLE", "READ"), (unit) => unit.roles());
	}

	public createRole(route: TenantRoute, input: TenantRoleCreateInput): Promise<TenantRoleResponse> {
		return this.administer(route, pair("ROLE", "CREATE"), async (unit, caller) => {
			await this.assertRoleMayHold(caller, input.permissions);
			const role = await unit.createRole(input.name, input.permissions);
			await unit.audit({ action: "role.created", resourceType: "Role", resourceId: role.id, metadata: { name: role.name } });
			return role;
		});
	}

	public updateRole(route: TenantRoute, roleId: string, input: TenantRoleUpdateInput): Promise<TenantRoleResponse> {
		return this.administer(route, pair("ROLE", "UPDATE"), async (unit, caller) => {
			assertRoleEditable(await this.requireRole(unit, roleId));
			if (input.permissions !== undefined) {
				await this.assertRoleMayHold(caller, input.permissions);
			}
			const role = await unit.updateRole(roleId, input);
			await unit.audit({ action: "role.updated", resourceType: "Role", resourceId: roleId, metadata: { permissions: role.permissions.length } });
			return role;
		});
	}

	/** Refused while members hold the role: the caller reassigns them first (no default role, ever). */
	public deleteRole(route: TenantRoute, roleId: string): Promise<void> {
		return this.administer(route, pair("ROLE", "DELETE"), async (unit) => {
			assertRoleEditable(await this.requireRole(unit, roleId));
			const holders = await unit.holders(roleId);
			if (holders.length > 0) {
				throw new RoleInUseError(holders.length, holdersVersionOf(holders.map((holder) => holder.id)));
			}
			await unit.deleteRole(roleId);
			await unit.audit({ action: "role.deleted", resourceType: "Role", resourceId: roleId });
		});
	}

	public roleHolders(route: TenantRoute, roleId: string): Promise<TenantRoleHolders> {
		return this.administer(route, pair("ROLE", "READ"), async (unit) => {
			await this.requireRole(unit, roleId);
			const holders = await unit.holders(roleId);
			return {
				holders: holders.map((holder) => ({ membershipId: holder.id, userId: holder.userId, fullName: holder.fullName, email: holder.email })),
				holdersVersion: holdersVersionOf(holders.map((holder) => holder.id)),
			};
		});
	}

	/** Every holder of `roleId` moved at once, only if the holder list is still the one the caller saw. */
	public reassignHolders(route: TenantRoute, roleId: string, input: TenantRoleReassignInput): Promise<void> {
		return this.administer(route, pair("ROLE", "UPDATE"), async (unit, caller) => {
			const from = await this.requireRole(unit, roleId);
			const holders = await unit.holders(roleId);
			const mapped = new Set(input.assignments.map((assignment) => assignment.membershipId));
			if (
				holdersVersionOf(holders.map((holder) => holder.id)) !== input.holdersVersion ||
				holders.some((holder) => !mapped.has(holder.id)) ||
				mapped.size !== holders.length
			) {
				throw new StaleHoldersError();
			}
			const actorIsOwner = await this.isOwner(unit, caller);
			let ownersLeft = await unit.ownerCount();
			for (const assignment of input.assignments) {
				const to = await this.requireRole(unit, assignment.roleId);
				if (to.id === roleId) {
					throw new StaleHoldersError();
				}
				assertOwnerChange({ actorIsOwner, from, to, ownersLeft });
				if (from.templateKey === "OWNER" && to.templateKey !== "OWNER") {
					ownersLeft -= 1;
				}
				await unit.setMemberRole(assignment.membershipId, to.id, to.templateKey);
				await unit.audit({
					action: "member.role_changed",
					resourceType: "Membership",
					resourceId: assignment.membershipId,
					metadata: { fromRoleId: roleId, toRoleId: to.id },
				});
			}
		});
	}

	/** Makes a role equal its template again. */
	public resetRole(route: TenantRoute, roleId: string): Promise<TenantRoleResponse> {
		return this.administer(route, pair("ROLE", "UPDATE"), async (unit) => {
			const role = await this.requireRole(unit, roleId);
			assertRoleEditable(role);
			if (role.templateKey === null) {
				throw new NotFoundError({ message: "This role was not copied from a template" });
			}
			const reset = await unit.resetRole(roleId, role.templateKey);
			await unit.audit({ action: "role.reset_to_template", resourceType: "Role", resourceId: roleId, metadata: { template: role.templateKey } });
			return reset;
		});
	}

	// ── Members ────────────────────────────────────────────────────────────

	public memberAccess(route: TenantRoute, membershipId: string): Promise<TenantMemberAccessResponse> {
		return this.administer(route, pair("MEMBER", "READ"), async (unit) => {
			const member = await unit.memberAccess(membershipId);
			if (member === null) {
				throw new NotFoundError({ message: "Member not found" });
			}
			return member;
		});
	}

	public changeMemberRole(route: TenantRoute, membershipId: string, roleId: string): Promise<void> {
		return this.administer(route, pair("MEMBER", "UPDATE"), async (unit, caller) => {
			const member = await this.requireMember(unit, membershipId);
			const to = await this.requireRole(unit, roleId);
			assertOwnerChange({ actorIsOwner: await this.isOwner(unit, caller), from: member, to, ownersLeft: await unit.ownerCount() });
			await unit.setMemberRole(membershipId, to.id, to.templateKey);
			await unit.audit({ action: "member.role_changed", resourceType: "Membership", resourceId: membershipId, metadata: { fromRoleId: member.roleId, toRoleId: to.id } });
		});
	}

	/** The member's roles, grants and shares stop at once: every check goes through an active membership. */
	public removeMember(route: TenantRoute, membershipId: string): Promise<void> {
		return this.administer(route, pair("MEMBER", "DELETE"), async (unit) => {
			const member = await this.requireMember(unit, membershipId);
			if (member.templateKey === "OWNER" && (await unit.ownerCount()) <= 1) {
				throw new OwnerRequiredError("A tenant always keeps at least one Owner");
			}
			await unit.removeMember(membershipId);
			await unit.audit({ action: "member.removed", resourceType: "Membership", resourceId: membershipId });
		});
	}

	// ── Grants ─────────────────────────────────────────────────────────────

	public listGrants(route: TenantRoute, membershipId: string): Promise<readonly TenantGrantResponse[]> {
		return this.administer(route, pair("MEMBER", "READ"), async (unit) => {
			await this.requireMember(unit, membershipId);
			return unit.grants(membershipId);
		});
	}

	/** Non-delegable: only what the caller's ROLE gives them, within their own stores. */
	public grant(route: TenantRoute, membershipId: string, input: TenantGrantCreateInput): Promise<TenantGrantResponse> {
		return this.administer(route, pair("MEMBER", "UPDATE"), async (unit, caller) => {
			const member = await this.requireMember(unit, membershipId);
			assertTenantPermissions([input.permission]);
			const granter = await this.requireFacts(caller);
			assertDelegable(granter, input.permission, input.locationId === undefined ? StoreScope.all() : StoreScope.of([input.locationId]));
			const grantedVia = (await this.requireRole(unit, (await this.requireCallerMember(unit, caller)).roleId)).name;
			const grant = await unit.createGrant(member, { permission: input.permission, locationId: input.locationId ?? null, expiresAt: input.expiresAt ?? null, grantedVia });
			await unit.audit({
				action: "grant.created",
				resourceType: "UserPermission",
				resourceId: grant.id,
				metadata: { membershipId, expiresAt: grant.expiresAt, locationId: grant.locationId },
			});
			return grant;
		});
	}

	/** Undo your own: the granter may always revoke their grant; anyone else needs `member.update`. */
	public revokeGrant(route: TenantRoute, grantId: string): Promise<void> {
		return this.administerOwnOr(
			route,
			pair("MEMBER", "UPDATE"),
			async (unit) => (await unit.grant(grantId))?.grantedBy ?? null,
			async (unit) => {
				await unit.revokeGrant(grantId);
				await unit.audit({ action: "grant.revoked", resourceType: "UserPermission", resourceId: grantId });
			},
		);
	}

	// ── Shares ─────────────────────────────────────────────────────────────

	public listShares(route: TenantRoute): Promise<readonly TenantShareResponse[]> {
		return this.administer(route, pair("MEMBER", "READ"), (unit) => unit.shares());
	}

	/**
	 * One record shared with one member of the same tenant: only at a level the caller's ROLE gives them
	 * on that record, and only if the record is inside their stores.
	 */
	public share(route: TenantRoute, input: TenantShareCreateInput): Promise<TenantShareResponse> {
		return this.administerMember(route, async (unit, caller) => {
			await this.requireMember(unit, input.membershipId);
			const record = await unit.recordStores(input.resource, input.resourceId);
			if (record === null) {
				throw new NotFoundError({ message: "The record to share was not found" });
			}
			const granter = await this.requireFacts(caller);
			const recordScope = StoreScope.of(record.locationIds);
			for (const action of SHARE_LEVEL_ACTIONS[input.level]) {
				assertDelegable(granter, pair(input.resource, action), recordScope);
			}
			const share = await unit.createShare({ ...input, expiresAt: input.expiresAt ?? null });
			await unit.audit({
				action: "share.created",
				resourceType: "ResourceAcl",
				resourceId: share.id,
				metadata: { resource: input.resource, resourceId: input.resourceId, level: input.level },
			});
			return share;
		});
	}

	/** Undo your own: the sharer may always take a share back; anyone else needs `share.delete`. */
	public unshare(route: TenantRoute, shareId: string): Promise<void> {
		return this.administerOwnOr(
			route,
			pair("SHARE", "DELETE"),
			async (unit) => (await unit.share(shareId))?.sharedBy ?? null,
			async (unit) => {
				await unit.deleteShare(shareId);
				await unit.audit({ action: "share.deleted", resourceType: "ResourceAcl", resourceId: shareId });
			},
		);
	}

	// ── The skeleton (TEMPLATE METHOD) ─────────────────────────────────────

	/** Resolve the caller's tenant → decide `permission` (403 unless allowed) → one transaction. */
	private async administer<TResult>(route: TenantRoute, permission: PermissionPair, work: (unit: TenantAccessUnit, caller: Caller) => Promise<TResult>): Promise<TResult> {
		const caller = await this.callerOf(route);
		await this.accessControl.require({ userId: caller.userId, tenantId: caller.tenantId, permission });
		return this.store.run(caller.tenantId, caller.userId, (unit) => work(unit, caller));
	}

	/** Like {@link administer}, gated by an active membership only (the operation's own rules decide). */
	private async administerMember<TResult>(route: TenantRoute, work: (unit: TenantAccessUnit, caller: Caller) => Promise<TResult>): Promise<TResult> {
		const caller = await this.callerOf(route);
		return this.store.run(caller.tenantId, caller.userId, async (unit) => {
			await this.requireCallerMember(unit, caller);
			return work(unit, caller);
		});
	}

	/** Undo your own: the row's author may always act; anyone else needs `permission`. */
	private async administerOwnOr(
		route: TenantRoute,
		permission: PermissionPair,
		authorOf: (unit: TenantAccessUnit) => Promise<string | null>,
		work: (unit: TenantAccessUnit) => Promise<void>,
	): Promise<void> {
		const caller = await this.callerOf(route);
		const isAuthor = await this.store.run(caller.tenantId, caller.userId, async (unit) => (await authorOf(unit)) === caller.userId);
		if (!isAuthor) {
			await this.accessControl.require({ userId: caller.userId, tenantId: caller.tenantId, permission });
		}
		await this.store.run(caller.tenantId, caller.userId, async (unit) => {
			if ((await authorOf(unit)) === null) {
				throw new NotFoundError();
			}
			await work(unit);
		});
	}

	/** A signed-in user and the live tenant the route names; anything else is the uniform 404. */
	private async callerOf(route: TenantRoute): Promise<Caller> {
		const tenantId = route.actor.kind === "user" ? await this.store.tenantIdBySlug(route.tenantSlug) : null;
		if (route.actor.kind !== "user" || tenantId === null) {
			throw new NotFoundError({ message: "Tenant not found" });
		}
		return { userId: route.actor.userId, tenantId };
	}

	/** A role holds only tenant permissions, and only ones the caller's own role gives them. */
	private async assertRoleMayHold(caller: Caller, permissions: readonly PermissionPair[]): Promise<void> {
		assertTenantPermissions(permissions);
		const granter = await this.requireFacts(caller);
		for (const permission of permissions) {
			assertDelegable(granter, permission, StoreScope.of([]));
		}
	}

	private async requireFacts(caller: Caller): Promise<{ readonly rolePermissions: readonly PermissionPair[]; readonly stores: StoreScope }> {
		const facts = await this.facts.read(caller.userId, caller.tenantId);
		if (facts === null) {
			throw new AccessDeniedError();
		}
		return facts;
	}

	private async requireRole(unit: TenantAccessUnit, roleId: string): Promise<TenantRoleResponse> {
		const role = await unit.role(roleId);
		if (role === null) {
			throw new NotFoundError({ message: "Role not found" });
		}
		return role;
	}

	private async requireMember(unit: TenantAccessUnit, membershipId: string): Promise<TenantMemberRow> {
		const member = await unit.member(membershipId);
		if (member === null) {
			throw new NotFoundError({ message: "Member not found" });
		}
		return member;
	}

	private async requireCallerMember(unit: TenantAccessUnit, caller: Caller): Promise<TenantMemberRow> {
		const member = await unit.memberByUser(caller.userId);
		if (member === null) {
			throw new DelegationRefusedError("Only a member of this tenant can give access in it");
		}
		return member;
	}

	private async isOwner(unit: TenantAccessUnit, caller: Caller): Promise<boolean> {
		return (await unit.memberByUser(caller.userId))?.templateKey === "OWNER";
	}
}
