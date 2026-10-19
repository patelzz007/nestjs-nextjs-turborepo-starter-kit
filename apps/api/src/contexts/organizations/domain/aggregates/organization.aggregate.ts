import { OrganizationLifecycleStateSchema, type EpochMs, type OrganizationLifecycleState, type PilotCity } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { OrganizationNotProvisioningError, OrganizationsCorruptStateError } from "../errors/organizations.errors";
import { OrganizationLifecycleChanged, type OrganizationsDomainEvent } from "../events/organizations.events";

export interface OrganizationState {
	readonly id: string;
	readonly slug: string;
	readonly displayName: string;
	readonly lifecycleState: string;
}

/** The merchant profile an organization is provisioned with (KYB starts PENDING). */
export interface MerchantProfileSeed {
	readonly category: string | null;
	readonly city: PilotCity;
	readonly contactEmail: string;
}

/** One lifecycle transition, appended to `OrganizationLifecycleEvent` with the state change. */
export interface LifecycleTransition {
	readonly from: OrganizationLifecycleState | null;
	readonly to: OrganizationLifecycleState;
	readonly actorUserId: string | null;
	readonly reason: string;
}

/** A tenant: its identity (slug, name) and lifecycle (PROVISIONING → ACTIVE). */
export class Organization extends AggregateRoot<OrganizationsDomainEvent> {
	private readonly transitions: LifecycleTransition[] = [];
	private renamed = false;

	private constructor(
		public readonly id: string,
		public readonly slug: string,
		private name: string,
		private readonly loadedState: OrganizationLifecycleState | null,
		private state: OrganizationLifecycleState,
		public readonly provisionedProfile: MerchantProfileSeed | null,
	) {
		super();
	}

	public static rehydrate(state: OrganizationState): Organization {
		const lifecycle = OrganizationLifecycleStateSchema.safeParse(state.lifecycleState);
		if (!lifecycle.success) {
			throw new OrganizationsCorruptStateError(state.id);
		}
		return new Organization(state.id, state.slug, state.displayName, lifecycle.data, lifecycle.data, null);
	}

	/** A new organization in PROVISIONING with its merchant profile; the first lifecycle event names who and why. */
	public static provision(id: string, slug: string, displayName: string, profile: MerchantProfileSeed, actorUserId: string, reason: string, now: EpochMs): Organization {
		const organization = new Organization(id, slug, displayName, null, "PROVISIONING", profile);
		organization.transitions.push({ from: null, to: "PROVISIONING", actorUserId, reason });
		organization.record(new OrganizationLifecycleChanged(now, id, null, "PROVISIONING"));
		return organization;
	}

	/** The lifecycle state this organization was loaded with (`null` = new); persistence compares it (CAS). */
	public get concurrencyToken(): OrganizationLifecycleState | null {
		return this.loadedState;
	}

	public get lifecycleState(): OrganizationLifecycleState {
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
			throw new OrganizationNotProvisioningError();
		}
		this.state = "ACTIVE";
		this.transitions.push({ from: "PROVISIONING", to: "ACTIVE", actorUserId, reason: "Onboarding complete" });
		this.record(new OrganizationLifecycleChanged(now, this.id, "PROVISIONING", "ACTIVE"));
	}
}
