import { MembershipRoleSchema, MembershipStatusSchema, type EpochMs, type MembershipRole, type MembershipStatus } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { MemberCoversAllStoresError, MemberLastStoreError, TenantOwnerCannotLeaveError, OwnerProtectedError } from "../errors/tenants.errors";
import { MembershipChanged, type TenantsDomainEvent } from "../events/tenants.events";
import { LocationScope, type LocationScopeRow } from "../value-objects/location-scope.value-object";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

export interface MembershipState {
	readonly id: string;
	readonly tenantId: string;
	readonly userId: string;
	readonly role: string;
	readonly status: string;
	readonly displayName: string | null;
	readonly scopeRows: readonly LocationScopeRow[];
}

/** What changed in this unit of work, for persistence. */
export type MembershipChange =
	| { readonly kind: "created" }
	| { readonly kind: "renamed"; readonly displayName: string | null }
	| { readonly kind: "removed_from_location"; readonly locationId: string; readonly removedAt: EpochMs; readonly removedByUserId: string }
	/** The member left: the membership and its location scope rows are soft-deleted by the member. */
	| { readonly kind: "left"; readonly leftAt: EpochMs };

/** One person's membership of one tenant: role, store scope and per-tenant display name. */
export class Membership extends AggregateRoot<TenantsDomainEvent> {
	private readonly pendingChanges: MembershipChange[] = [];

	private constructor(
		public readonly id: string,
		public readonly tenantId: string,
		public readonly userId: string,
		public readonly role: MembershipRole,
		public readonly status: MembershipStatus,
		private name: string | null,
		private locationScope: LocationScope,
	) {
		super();
	}

	public static rehydrate(state: MembershipState): Membership {
		const role = MembershipRoleSchema.safeParse(state.role);
		const status = MembershipStatusSchema.safeParse(state.status);
		if (!role.success || !status.success) {
			throw new CorruptAggregateStateError("tenant", state.id);
		}
		return new Membership(state.id, state.tenantId, state.userId, role.data, status.data, state.displayName, LocationScope.fromRows(state.scopeRows));
	}

	/** A new ACTIVE membership with an explicit role and store scope (invitation, access-request approval). */
	public static grant(id: string, tenantId: string, userId: string, role: MembershipRole, scope: LocationScope, now: EpochMs): Membership {
		const membership = new Membership(id, tenantId, userId, role, "ACTIVE", null, scope);
		membership.pendingChanges.push({ kind: "created" });
		membership.record(new MembershipChanged(now, tenantId, id));
		return membership;
	}

	/** The merchant who completed onboarding: OWNER of every store. */
	public static owner(id: string, tenantId: string, userId: string, now: EpochMs): Membership {
		return Membership.grant(id, tenantId, userId, "OWNER", LocationScope.allLocations(), now);
	}

	public get displayName(): string | null {
		return this.name;
	}

	public get scope(): LocationScope {
		return this.locationScope;
	}

	public get changes(): readonly MembershipChange[] {
		return this.pendingChanges;
	}

	/** Set (or with `null` clear) the display name; returns the value it replaced. */
	public rename(displayName: string | null, now: EpochMs): string | null {
		const previous = this.name;
		this.name = displayName;
		this.pendingChanges.push({ kind: "renamed", displayName });
		this.record(new MembershipChanged(now, this.tenantId, this.id));
		return previous;
	}

	/**
	 * Take one store out of this member's SELECTED scope. The OWNER is
	 * protected, a member covering every store cannot be trimmed to one, and
	 * removing the last store needs `allowNoLocations`. Returns `false` when the
	 * store is not in the member's scope (nothing changes).
	 */
	public removeFromLocation(locationId: string, allowNoLocations: boolean, removedByUserId: string, now: EpochMs): boolean {
		if (this.role === "OWNER") {
			throw new OwnerProtectedError();
		}
		if (this.locationScope.coversAllLocations) {
			throw new MemberCoversAllStoresError();
		}
		if (!this.locationScope.covers(locationId)) {
			return false;
		}
		const remaining = this.locationScope.without(locationId);
		if (remaining.locationIds.length === 0 && !allowNoLocations) {
			throw new MemberLastStoreError();
		}
		this.locationScope = remaining;
		this.pendingChanges.push({ kind: "removed_from_location", locationId, removedAt: now, removedByUserId });
		this.record(new MembershipChanged(now, this.tenantId, this.id));
		return true;
	}

	/**
	 * The member leaves the tenant, whatever their membership status (a suspended or pending member
	 * may leave too). The owner cannot leave: ownership is never left without an owner.
	 */
	public leave(now: EpochMs): void {
		if (this.role === "OWNER") {
			throw new TenantOwnerCannotLeaveError();
		}
		this.pendingChanges.push({ kind: "left", leftAt: now });
		this.record(new MembershipChanged(now, this.tenantId, this.id));
	}
}
