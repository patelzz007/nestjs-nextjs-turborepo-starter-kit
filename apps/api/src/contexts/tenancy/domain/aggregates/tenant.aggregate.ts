import { TenantLifecycleStateSchema, type EpochMs, type TenantLifecycleState, type PilotCity } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { TenantDeletionGraceOverError, TenantLifecycleTransitionError, TenantNotProvisioningError } from "../errors/tenants.errors";
import { TenantLifecycleChanged, type TenantsDomainEvent } from "../events/tenants.events";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

export interface TenantState {
	readonly id: string;
	readonly slug: string;
	readonly displayName: string;
	readonly lifecycleState: string;
	/** Until when a tenant pending deletion may be reactivated; null otherwise. */
	readonly deletionGraceEndsAt: EpochMs | null;
}

/** The merchant profile a tenant is provisioned with (KYB starts PENDING). */
export interface MerchantProfileSeed {
	readonly category: string | null;
	readonly city: PilotCity;
	readonly contactEmail: string;
}

/** One lifecycle transition, appended to `TenantLifecycleEvent` with the state change. */
export interface LifecycleTransition {
	readonly from: TenantLifecycleState | null;
	readonly to: TenantLifecycleState;
	readonly actorUserId: string | null;
	readonly reason: string;
}

/** Lifecycle states a platform admin may suspend a tenant from. */
const SUSPENDABLE_STATES: readonly TenantLifecycleState[] = ["ACTIVE", "RESTRICTED"];

/** Lifecycle states a super admin may ban a tenant from: a live tenant, suspended or not. */
const BANNABLE_STATES: readonly TenantLifecycleState[] = ["ACTIVE", "RESTRICTED", "SUSPENDED"];

/**
 * A tenant: its identity (slug, name) and lifecycle — PROVISIONING → ACTIVE at onboarding,
 * ACTIVE/RESTRICTED ⇄ SUSPENDED by a platform admin, ACTIVE/RESTRICTED/SUSPENDED → BANNED → ACTIVE
 * by a super admin, PENDING_DELETION → ACTIVE by its owner while the deletion grace period runs.
 */
export class Tenant extends AggregateRoot<TenantsDomainEvent> {
	private readonly transitions: LifecycleTransition[] = [];
	private renamed = false;

	private constructor(
		public readonly id: string,
		public readonly slug: string,
		private name: string,
		private readonly loadedState: TenantLifecycleState | null,
		private state: TenantLifecycleState,
		public readonly provisionedProfile: MerchantProfileSeed | null,
		private graceEndsAt: EpochMs | null,
	) {
		super();
	}

	public static rehydrate(state: TenantState): Tenant {
		const lifecycle = TenantLifecycleStateSchema.safeParse(state.lifecycleState);
		if (!lifecycle.success) {
			throw new CorruptAggregateStateError("tenant", state.id);
		}
		return new Tenant(state.id, state.slug, state.displayName, lifecycle.data, lifecycle.data, null, state.deletionGraceEndsAt);
	}

	/** A new tenant in PROVISIONING with its merchant profile; the first lifecycle event names who and why. */
	public static provision(id: string, slug: string, displayName: string, profile: MerchantProfileSeed, actorUserId: string, reason: string, now: EpochMs): Tenant {
		const tenant = new Tenant(id, slug, displayName, null, "PROVISIONING", profile, null);
		tenant.transitions.push({ from: null, to: "PROVISIONING", actorUserId, reason });
		tenant.record(new TenantLifecycleChanged(now, id, null, "PROVISIONING"));
		return tenant;
	}

	/** The lifecycle state this tenant was loaded with (`null` = new); persistence compares it (CAS). */
	public get concurrencyToken(): TenantLifecycleState | null {
		return this.loadedState;
	}

	public get lifecycleState(): TenantLifecycleState {
		return this.state;
	}

	public get deletionGraceEndsAt(): EpochMs | null {
		return this.graceEndsAt;
	}

	public get displayName(): string {
		return this.name;
	}

	/** Whether this unit of work changed the display name. */
	public get displayNameChanged(): boolean {
		return this.renamed;
	}

	public get pendingTransitions(): readonly LifecycleTransition[] {
		return this.transitions;
	}

	/** The business name the merchant confirmed at onboarding. */
	public renameAtOnboarding(displayName: string): void {
		this.name = displayName.trim();
		this.renamed = true;
	}

	/** PROVISIONING → ACTIVE once onboarding is complete. */
	public activate(actorUserId: string, now: EpochMs): void {
		if (this.state !== "PROVISIONING") {
			throw new TenantNotProvisioningError();
		}
		this.state = "ACTIVE";
		this.transitions.push({ from: "PROVISIONING", to: "ACTIVE", actorUserId, reason: "Onboarding complete" });
		this.record(new TenantLifecycleChanged(now, this.id, "PROVISIONING", "ACTIVE"));
	}

	/** A platform admin suspends an ACTIVE or RESTRICTED tenant: only its lifecycle routes keep working. */
	public suspend(adminUserId: string, reason: string, now: EpochMs): void {
		const from = this.state;
		if (!SUSPENDABLE_STATES.includes(from)) {
			throw new TenantLifecycleTransitionError("Only an active or restricted tenant can be suspended");
		}
		this.transition(from, "SUSPENDED", adminUserId, reason, now);
	}

	/** A platform admin reinstates a SUSPENDED tenant (after an appeal or on their own review). */
	public reinstate(adminUserId: string, reason: string, now: EpochMs): void {
		if (this.state !== "SUSPENDED") {
			throw new TenantLifecycleTransitionError("Only a suspended tenant can be reinstated");
		}
		this.transition("SUSPENDED", "ACTIVE", adminUserId, reason, now);
	}

	/**
	 * A super admin bans the tenant: harder than a suspension — it cannot appeal and cannot be
	 * reactivated by its owner; only its lifecycle routes keep working (to read the status, or leave).
	 */
	public ban(adminUserId: string, reason: string, now: EpochMs): void {
		const from = this.state;
		if (!BANNABLE_STATES.includes(from)) {
			throw new TenantLifecycleTransitionError("Only an active, restricted or suspended tenant can be banned");
		}
		this.transition(from, "BANNED", adminUserId, reason, now);
	}

	/** A super admin lifts the ban: the tenant is ACTIVE again. */
	public unban(adminUserId: string, reason: string, now: EpochMs): void {
		if (this.state !== "BANNED") {
			throw new TenantLifecycleTransitionError("Only a banned tenant can be unbanned");
		}
		this.transition("BANNED", "ACTIVE", adminUserId, reason, now);
	}

	/** Whether a suspended tenant may appeal (the appeal itself is its own aggregate). */
	public assertAppealable(): void {
		if (this.state !== "SUSPENDED") {
			throw new TenantLifecycleTransitionError("Only a suspended tenant can appeal");
		}
	}

	/** The owner cancels a pending deletion while its grace period runs: the tenant is ACTIVE again. */
	public reactivate(ownerUserId: string, now: EpochMs): void {
		if (this.state !== "PENDING_DELETION") {
			throw new TenantLifecycleTransitionError("Only a tenant pending deletion can be reactivated");
		}
		if (this.graceEndsAt !== null && this.graceEndsAt <= now) {
			throw new TenantDeletionGraceOverError();
		}
		this.graceEndsAt = null;
		this.transition("PENDING_DELETION", "ACTIVE", ownerUserId, "The owner cancelled the deletion", now);
	}

	private transition(from: TenantLifecycleState, to: TenantLifecycleState, actorUserId: string, reason: string, now: EpochMs): void {
		this.state = to;
		this.transitions.push({ from, to, actorUserId, reason: reason.trim() });
		this.record(new TenantLifecycleChanged(now, this.id, from, to));
	}
}
