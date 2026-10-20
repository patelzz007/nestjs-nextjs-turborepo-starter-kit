import { TenantLifecycleStateSchema, type EpochMs, type TenantLifecycleState, type PilotCity } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { TenantNotProvisioningError, TenantsCorruptStateError } from "../errors/tenants.errors";
import { TenantLifecycleChanged, type TenantsDomainEvent } from "../events/tenants.events";

export interface TenantState {
	readonly id: string;
	readonly slug: string;
	readonly displayName: string;
	readonly lifecycleState: string;
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

/** A tenant: its identity (slug, name) and lifecycle (PROVISIONING → ACTIVE). */
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
	) {
		super();
	}

	public static rehydrate(state: TenantState): Tenant {
		const lifecycle = TenantLifecycleStateSchema.safeParse(state.lifecycleState);
		if (!lifecycle.success) {
			throw new TenantsCorruptStateError(state.id);
		}
		return new Tenant(state.id, state.slug, state.displayName, lifecycle.data, lifecycle.data, null);
	}

	/** A new tenant in PROVISIONING with its merchant profile; the first lifecycle event names who and why. */
	public static provision(id: string, slug: string, displayName: string, profile: MerchantProfileSeed, actorUserId: string, reason: string, now: EpochMs): Tenant {
		const tenant = new Tenant(id, slug, displayName, null, "PROVISIONING", profile);
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
}
