import {
	OrganizationMembershipRoleSchema,
	OrganizationMembershipStatusSchema,
	type EpochMs,
	type OrganizationMembershipRole,
	type OrganizationMembershipStatus,
} from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { MemberCoversAllStoresError, MemberLastStoreError, OrganizationsCorruptStateError, OwnerProtectedError } from "../errors/organizations.errors";
import { MembershipChanged, type OrganizationsDomainEvent } from "../events/organizations.events";
import { LocationScope, type LocationScopeRow } from "../value-objects/location-scope.value-object";

export interface MembershipState {
	readonly id: string;
	readonly organizationId: string;
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
	| { readonly kind: "removed_from_store"; readonly locationId: string; readonly removedAt: EpochMs; readonly removedByUserId: string };

/** One person's membership of one organization: role, store scope and per-organization display name. */
export class Membership extends AggregateRoot<OrganizationsDomainEvent> {
	private readonly pendingChanges: MembershipChange[] = [];

	private constructor(
		public readonly id: string,
		public readonly organizationId: string,
		public readonly userId: string,
		public readonly role: OrganizationMembershipRole,
		public readonly status: OrganizationMembershipStatus,
		private name: string | null,
		private locationScope: LocationScope,
	) {
		super();
	}

	public static rehydrate(state: MembershipState): Membership {
		const role = OrganizationMembershipRoleSchema.safeParse(state.role);
		const status = OrganizationMembershipStatusSchema.safeParse(state.status);
		if (!role.success || !status.success) {
			throw new OrganizationsCorruptStateError(state.id);
		}
		return new Membership(state.id, state.organizationId, state.userId, role.data, status.data, state.displayName, LocationScope.fromRows(state.scopeRows));
	}

	/** A new ACTIVE membership with an explicit role and store scope (invitation, access-request approval). */
	public static grant(id: string, organizationId: string, userId: string, role: OrganizationMembershipRole, scope: LocationScope, now: EpochMs): Membership {
		const membership = new Membership(id, organizationId, userId, role, "ACTIVE", null, scope);
		membership.pendingChanges.push({ kind: "created" });
		membership.record(new MembershipChanged(now, organizationId, id));
		return membership;
	}

	/** The merchant who completed onboarding: OWNER of every store. */
	public static owner(id: string, organizationId: string, userId: string, now: EpochMs): Membership {
		return Membership.grant(id, organizationId, userId, "OWNER", LocationScope.allLocations(), now);
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
		this.record(new MembershipChanged(now, this.organizationId, this.id));
		return previous;
	}

	/**
	 * Take one store out of this member's SELECTED scope. The OWNER is
	 * protected, a member covering every store cannot be trimmed to one, and
	 * removing the last store needs `allowNoStores`. Returns `false` when the
	 * store is not in the member's scope (nothing changes).
	 */
	public removeFromStore(locationId: string, allowNoStores: boolean, removedByUserId: string, now: EpochMs): boolean {
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
		if (remaining.locationIds.length === 0 && !allowNoStores) {
			throw new MemberLastStoreError();
		}
		this.locationScope = remaining;
		this.pendingChanges.push({ kind: "removed_from_store", locationId, removedAt: now, removedByUserId });
		this.record(new MembershipChanged(now, this.organizationId, this.id));
		return true;
	}
}
