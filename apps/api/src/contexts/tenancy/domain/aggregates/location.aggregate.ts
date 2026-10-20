import { LocationStatusSchema, type EpochMs, type LocationStatus, type PilotCity } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { LocationStatusConflictError, TenantsCorruptStateError, PrimaryLocationCloseRefusedError } from "../errors/tenants.errors";
import { LocationStatusChanged, type TenantsDomainEvent } from "../events/tenants.events";
import { assertCanRequestLocation } from "../policies/location-request-quota.policy";

/** The editable details of a store location. */
export interface LocationDetails {
	readonly name: string;
	readonly addressText: string;
	readonly contactPhone: string | null;
}

/** A store location as persistence loads it. */
export interface LocationState {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly addressText: string | null;
	readonly city: PilotCity | null;
	readonly contactPhone: string | null;
	readonly status: string;
	readonly rejectionReason: string | null;
	readonly isPrimary: boolean;
	readonly requestedByUserId: string | null;
	readonly reviewedByUserId: string | null;
	readonly reviewedAt: EpochMs | null;
}

/** Everything persistence writes for a location (new or changed). */
export interface LocationSnapshot {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly addressText: string | null;
	readonly city: PilotCity | null;
	readonly contactPhone: string | null;
	readonly status: LocationStatus;
	readonly rejectionReason: string | null;
	readonly isPrimary: boolean;
	readonly requestedByUserId: string | null;
	readonly reviewedByUserId: string | null;
	readonly reviewedAt: EpochMs | null;
	/** Set when the store was closed in this unit of work. */
	readonly closure: { readonly reason: string; readonly closedByUserId: string; readonly closedAt: EpochMs } | null;
}

interface LocationFields {
	name: string;
	addressText: string | null;
	city: PilotCity | null;
	contactPhone: string | null;
	status: LocationStatus;
	rejectionReason: string | null;
	requestedByUserId: string | null;
	reviewedByUserId: string | null;
	reviewedAt: EpochMs | null;
}

const RESUBMIT_REQUIRES_REJECTED_MESSAGE = "Only rejected store requests can be edited and resubmitted";
const REVIEW_REQUIRES_PENDING_MESSAGE = "Only pending store requests can be reviewed";

/**
 * One store location of a tenant. Owns the request → review → close
 * lifecycle and the primary-store invariant (the primary store anchors the
 * tenant and is never closed).
 */
export class Location extends AggregateRoot<TenantsDomainEvent> {
	private closure: LocationSnapshot["closure"] = null;

	private constructor(
		public readonly id: string,
		public readonly tenantId: string,
		public readonly isPrimary: boolean,
		private readonly loadedStatus: LocationStatus | null,
		private readonly fields: LocationFields,
	) {
		super();
	}

	public static rehydrate(state: LocationState): Location {
		const status = LocationStatusSchema.safeParse(state.status);
		if (!status.success) {
			throw new TenantsCorruptStateError(state.id);
		}
		return new Location(state.id, state.tenantId, state.isPrimary, status.data, {
			name: state.name,
			addressText: state.addressText,
			city: state.city,
			contactPhone: state.contactPhone,
			status: status.data,
			rejectionReason: state.rejectionReason,
			requestedByUserId: state.requestedByUserId,
			reviewedByUserId: state.reviewedByUserId,
			reviewedAt: state.reviewedAt,
		});
	}

	/** A member requests a new store; it waits for admin review. Refused when too many requests are already pending. */
	public static propose(
		id: string,
		tenantId: string,
		details: LocationDetails,
		city: PilotCity | null,
		requestedByUserId: string,
		pendingRequests: number,
		now: EpochMs,
	): Location {
		assertCanRequestLocation(pendingRequests);
		return Location.requested(id, tenantId, details, city, requestedByUserId, now);
	}

	/** A store requested during onboarding (after the primary one); it waits for admin review. */
	public static requested(id: string, tenantId: string, details: LocationDetails, city: PilotCity | null, requestedByUserId: string, now: EpochMs): Location {
		return Location.created(
			id,
			tenantId,
			false,
			{
				...trimmedDetails(details),
				city,
				status: "PENDING_APPROVAL",
				rejectionReason: null,
				requestedByUserId,
				reviewedByUserId: null,
				reviewedAt: null,
			},
			now,
		);
	}

	/** A platform admin adds a store, approved at once or left for review. */
	public static createByAdmin(
		id: string,
		tenantId: string,
		details: LocationDetails,
		city: PilotCity | null,
		approveImmediately: boolean,
		adminUserId: string,
		now: EpochMs,
	): Location {
		return Location.created(
			id,
			tenantId,
			false,
			{
				...trimmedDetails(details),
				city,
				status: approveImmediately ? "ACTIVE" : "PENDING_APPROVAL",
				rejectionReason: null,
				requestedByUserId: adminUserId,
				reviewedByUserId: approveImmediately ? adminUserId : null,
				reviewedAt: approveImmediately ? now : null,
			},
			now,
		);
	}

	/** The primary store, created from the address the merchant submitted at onboarding. */
	public static primaryFromOnboarding(id: string, tenantId: string, details: LocationDetails, city: PilotCity, userId: string, now: EpochMs): Location {
		return Location.created(
			id,
			tenantId,
			true,
			{
				...trimmedDetails(details),
				contactPhone: details.contactPhone === null ? null : details.contactPhone.trim(),
				city,
				status: "ACTIVE",
				rejectionReason: null,
				requestedByUserId: userId,
				reviewedByUserId: userId,
				reviewedAt: now,
			},
			now,
		);
	}

	private static created(id: string, tenantId: string, isPrimary: boolean, fields: LocationFields, now: EpochMs): Location {
		const location = new Location(id, tenantId, isPrimary, null, fields);
		location.record(new LocationStatusChanged(now, tenantId, id, null, fields.status));
		return location;
	}

	/** The status this location was loaded with (`null` = new); persistence compares it (CAS). */
	public get concurrencyToken(): LocationStatus | null {
		return this.loadedStatus;
	}

	public get status(): LocationStatus {
		return this.fields.status;
	}

	/** Complete an existing (address-less) primary store from the onboarding submission. */
	public completePrimaryFromOnboarding(details: LocationDetails, city: PilotCity, userId: string, now: EpochMs): void {
		Object.assign(this.fields, {
			...trimmedDetails(details),
			contactPhone: details.contactPhone === null ? null : details.contactPhone.trim(),
			city,
			reviewedByUserId: userId,
			reviewedAt: now,
		});
		this.transition("ACTIVE", now);
	}

	/** REJECTED → PENDING_APPROVAL with corrected details. */
	public resubmit(details: LocationDetails, userId: string, now: EpochMs): void {
		if (this.fields.status !== "REJECTED") {
			throw new LocationStatusConflictError(RESUBMIT_REQUIRES_REJECTED_MESSAGE);
		}
		Object.assign(this.fields, {
			...trimmedDetails(details),
			contactPhone: details.contactPhone,
			rejectionReason: null,
			requestedByUserId: userId,
			reviewedByUserId: null,
			reviewedAt: null,
		});
		this.transition("PENDING_APPROVAL", now);
	}

	/** PENDING_APPROVAL → ACTIVE, or → REJECTED with the reviewer's reason. */
	public review(approve: boolean, rejectionReason: string | null, reviewerUserId: string, now: EpochMs): void {
		if (this.fields.status !== "PENDING_APPROVAL") {
			throw new LocationStatusConflictError(REVIEW_REQUIRES_PENDING_MESSAGE);
		}
		Object.assign(this.fields, { rejectionReason: approve ? null : rejectionReason, reviewedByUserId: reviewerUserId, reviewedAt: now });
		this.transition(approve ? "ACTIVE" : "REJECTED", now);
	}

	/** Close the store for good: INACTIVE and soft-deleted. The primary store cannot be closed. */
	public close(reason: string, closedByUserId: string, now: EpochMs): void {
		if (this.isPrimary) {
			throw new PrimaryLocationCloseRefusedError();
		}
		this.closure = { reason, closedByUserId, closedAt: now };
		this.transition("INACTIVE", now);
	}

	public snapshot(): LocationSnapshot {
		return { id: this.id, tenantId: this.tenantId, isPrimary: this.isPrimary, closure: this.closure, ...this.fields };
	}

	private transition(to: LocationStatus, now: EpochMs): void {
		const from = this.fields.status;
		this.fields.status = to;
		if (from !== to || this.closure !== null) {
			this.record(new LocationStatusChanged(now, this.tenantId, this.id, from, to));
		}
	}
}

function trimmedDetails(details: LocationDetails): Pick<LocationFields, "name" | "addressText" | "contactPhone"> {
	return { name: details.name.trim(), addressText: details.addressText.trim(), contactPhone: details.contactPhone };
}
