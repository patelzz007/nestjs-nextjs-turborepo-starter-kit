import { AclEffectSchema, type EpochMs } from "@workspace/shared";
import { z } from "zod";

import {
	AllowDenyConflictError,
	CorruptAuthorizationStateError,
	PermissionOverrideNotFoundError,
	RoleAssignmentNotFoundError,
	RoleLimitExceededError,
} from "../errors/authorization.errors";
import type { RbacTargetAccount } from "../policies/rbac-escalation.policy";
import { MAX_ROLES_PER_USER } from "../rbac-catalog";

export type PermissionOverrideEffect = z.output<typeof AclEffectSchema>;

const DirectOverrideSchema = z.object({
	/** `UserPermission.id`. */
	id: z.string().min(1),
	permissionId: z.string().min(1),
	effect: AclEffectSchema,
	/** Epoch ms; `null` = no expiry. Expired overrides stay rows an admin manages until the expiry job retires them. */
	expiresAt: z.number().int().nonnegative().nullable(),
});

const UserAuthorizationStateSchema = z.object({
	userId: z.string().min(1),
	isSuperAdmin: z.boolean(),
	/** Live (not soft-deleted) direct role assignments. The roles' own state is not filtered. */
	roleIds: z.array(z.string().min(1)),
	/** Live direct permission overrides, expired ones included. */
	overrides: z.array(DirectOverrideSchema),
});

export type UserAuthorizationState = z.output<typeof UserAuthorizationStateSchema>;
export type DirectPermissionOverride = z.output<typeof DirectOverrideSchema>;

/** An override as the aggregate tracks it: `id` is `null` until a new grant is persisted. */
export interface TrackedPermissionOverride {
	readonly id: string | null;
	readonly permissionId: string;
	readonly effect: PermissionOverrideEffect;
	readonly expiresAt: number | null;
}

/** A persisted override the expiry retired (only loaded overrides can be expired, so the id is known). */
export interface ExpiredPermissionOverride {
	readonly id: string;
	readonly permissionId: string;
	readonly effect: PermissionOverrideEffect;
	readonly expiresAt: number;
}

/** A direct grant (or DENY override) for one user. */
export interface DirectPermissionGrant {
	readonly permissionId: string;
	readonly effect: PermissionOverrideEffect;
	/** Epoch ms; `undefined` keeps an existing expiry on re-grant (none for a new grant). */
	readonly expiresAt: EpochMs | undefined;
}

/** One change the repository writes on save, in order, each exactly as the API always wrote it. */
export type UserAuthorizationChange =
	| { readonly kind: "role_assigned"; readonly roleId: string; readonly assignedBy: string }
	| { readonly kind: "role_unassigned"; readonly roleId: string }
	| { readonly kind: "roles_synced"; readonly roleIds: readonly string[]; readonly assignedBy: string }
	| { readonly kind: "permission_granted"; readonly grant: DirectPermissionGrant; readonly assignedBy: string }
	| { readonly kind: "permission_revoked"; readonly permissionId: string }
	| { readonly kind: "allow_grants_synced"; readonly permissionIds: readonly string[]; readonly assignedBy: string }
	| { readonly kind: "overrides_expired"; readonly overrideIds: readonly string[]; readonly expiredAt: EpochMs };

/** What a role sync added and removed (both are escalation-checked). */
export interface RoleSyncDiff {
	readonly added: readonly string[];
	readonly removed: readonly string[];
}

/**
 * One account's RBAC assignments: its direct roles and its direct permission overrides (ALLOW grants and
 * DENY overrides). Invariants: at most {@link MAX_ROLES_PER_USER} direct roles, and a direct ALLOW sync
 * never silently turns a DENY into an ALLOW.
 *
 * Escalation, separation-of-duty and last-holder rules read other aggregates and live in
 * `domain/policies`; the RBAC mutation scope applies them around these methods.
 */
export class UserAuthorizationAggregate {
	private readonly changes: UserAuthorizationChange[] = [];
	private roleIds: Set<string>;
	private readonly overrides: Map<string, TrackedPermissionOverride>;

	private constructor(private readonly loaded: UserAuthorizationState) {
		this.roleIds = new Set<string>(loaded.roleIds);
		this.overrides = new Map<string, TrackedPermissionOverride>(
			loaded.overrides.map((override: DirectPermissionOverride): [string, TrackedPermissionOverride] => [override.permissionId, override]),
		);
	}

	public static rehydrate(state: UserAuthorizationState): UserAuthorizationAggregate {
		const parsed = UserAuthorizationStateSchema.safeParse(state);
		if (!parsed.success) {
			throw new CorruptAuthorizationStateError("UserAuthorization", state.userId);
		}
		return new UserAuthorizationAggregate(parsed.data);
	}

	/** @throws RoleLimitExceededError when a user would hold more than {@link MAX_ROLES_PER_USER} direct roles. */
	public static assertWithinRoleLimit(roleCount: number): void {
		if (roleCount > MAX_ROLES_PER_USER) {
			throw new RoleLimitExceededError(MAX_ROLES_PER_USER);
		}
	}

	public get userId(): string {
		return this.loaded.userId;
	}

	/** The account as the escalation policy sees it. */
	public get account(): RbacTargetAccount {
		return { userId: this.loaded.userId, isSuperAdmin: this.loaded.isSuperAdmin };
	}

	public get assignedRoleIds(): readonly string[] {
		return [...this.roleIds];
	}

	public hasRole(roleId: string): boolean {
		return this.roleIds.has(roleId);
	}

	/** Live overrides of one effect. */
	public overridesWithEffect(effect: PermissionOverrideEffect): readonly TrackedPermissionOverride[] {
		return [...this.overrides.values()].filter((override: TrackedPermissionOverride): boolean => override.effect === effect);
	}

	/** Assign (or re-assign) a role. A re-assignment revives the row and re-stamps who assigned it. */
	public assignRole(roleId: string, assignedBy: string): void {
		UserAuthorizationAggregate.assertWithinRoleLimit(new Set<string>([...this.roleIds, roleId]).size);
		this.roleIds.add(roleId);
		this.changes.push({ kind: "role_assigned", roleId, assignedBy });
	}

	/**
	 * Attach a server-chosen platform role at provisioning (the default consumer role, the bootstrap
	 * SuperAdmin). The role is fixed by the server, not requested by a caller, so the per-user limit (a
	 * guard rail on administrators' role design) does not apply.
	 */
	public attachProvisioningRole(roleId: string, assignedBy: string): void {
		this.roleIds.add(roleId);
		this.changes.push({ kind: "role_assigned", roleId, assignedBy });
	}

	/** @throws RoleAssignmentNotFoundError when the role is not directly assigned. */
	public unassignRole(roleId: string): void {
		if (!this.roleIds.delete(roleId)) {
			throw new RoleAssignmentNotFoundError(roleId, this.loaded.userId);
		}
		this.changes.push({ kind: "role_unassigned", roleId });
	}

	/** Replace the direct role set. Returns what was added and removed. */
	public syncRoles(roleIds: readonly string[], assignedBy: string): RoleSyncDiff {
		const desired: string[] = [...new Set<string>(roleIds)];
		UserAuthorizationAggregate.assertWithinRoleLimit(desired.length);
		const current: string[] = [...this.roleIds];
		const diff: RoleSyncDiff = {
			added: desired.filter((roleId: string): boolean => !this.roleIds.has(roleId)),
			removed: current.filter((roleId: string): boolean => !desired.includes(roleId)),
		};
		this.roleIds = new Set<string>(desired);
		this.changes.push({ kind: "roles_synced", roleIds: desired, assignedBy });
		return diff;
	}

	/** Grant a direct ALLOW, or set a DENY override. A re-grant replaces the override row. */
	public grantPermission(grant: DirectPermissionGrant, assignedBy: string): void {
		const existing: TrackedPermissionOverride | undefined = this.overrides.get(grant.permissionId);
		this.overrides.set(grant.permissionId, {
			id: existing?.id ?? null,
			permissionId: grant.permissionId,
			effect: grant.effect,
			expiresAt: grant.expiresAt ?? existing?.expiresAt ?? null,
		});
		this.changes.push({ kind: "permission_granted", grant, assignedBy });
	}

	/** Remove a direct grant or DENY override. @throws PermissionOverrideNotFoundError when there is none. */
	public revokePermission(permissionId: string): void {
		if (!this.overrides.delete(permissionId)) {
			throw new PermissionOverrideNotFoundError(this.loaded.userId, permissionId);
		}
		this.changes.push({ kind: "permission_revoked", permissionId });
	}

	/**
	 * Replace the direct ALLOW grants (no expiry). DENY overrides are never touched, and listing a
	 * permission the user holds a DENY for is rejected: the DENY must be lifted with an explicit revoke.
	 *
	 * @returns the ALLOW grants the sync removes (they are escalation-checked like additions).
	 */
	public syncAllowGrants(permissionIds: readonly string[], assignedBy: string): readonly string[] {
		const desired: string[] = [...new Set<string>(permissionIds)];
		const denied: number = this.overridesWithEffect("DENY").filter((override: TrackedPermissionOverride): boolean => desired.includes(override.permissionId)).length;
		if (denied > 0) {
			throw new AllowDenyConflictError(denied);
		}
		const removed: string[] = this.overridesWithEffect("ALLOW")
			.filter((override: TrackedPermissionOverride): boolean => !desired.includes(override.permissionId))
			.map((override: TrackedPermissionOverride): string => override.permissionId);
		for (const permissionId of removed) {
			this.overrides.delete(permissionId);
		}
		for (const permissionId of desired) {
			const existing: TrackedPermissionOverride | undefined = this.overrides.get(permissionId);
			this.overrides.set(permissionId, { id: existing?.id ?? null, permissionId, effect: "ALLOW", expiresAt: null });
		}
		this.changes.push({ kind: "allow_grants_synced", permissionIds: desired, assignedBy });
		return removed;
	}

	/**
	 * Retire every override (ALLOW or DENY) whose expiry is before `now`. Evaluation already ignores them;
	 * this makes the change durable, audited and session-revoking.
	 */
	public expireOverrides(now: EpochMs): readonly ExpiredPermissionOverride[] {
		const expired: ExpiredPermissionOverride[] = [];
		for (const override of this.overrides.values()) {
			if (override.id !== null && override.expiresAt !== null && override.expiresAt < now) {
				expired.push({ id: override.id, permissionId: override.permissionId, effect: override.effect, expiresAt: override.expiresAt });
			}
		}
		if (expired.length === 0) {
			return [];
		}
		for (const override of expired) {
			this.overrides.delete(override.permissionId);
		}
		this.changes.push({ kind: "overrides_expired", overrideIds: expired.map((override: ExpiredPermissionOverride): string => override.id), expiredAt: now });
		return expired;
	}

	public pullChanges(): readonly UserAuthorizationChange[] {
		return this.changes.splice(0, this.changes.length);
	}
}
