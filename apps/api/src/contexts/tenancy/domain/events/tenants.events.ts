import type { EpochMs, KybStatus, TenantInvitationStatus, TenantLifecycleState, LocationStatus } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/** The KYB review status of a merchant tenant changed (submission, scan verdict or admin decision). */
export class MerchantVerificationStatusChanged extends DomainEvent {
	public readonly eventName = "tenants.MerchantVerificationStatusChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly tenantId: string,
		public readonly from: KybStatus,
		public readonly to: KybStatus,
	) {
		super(occurredAt);
	}
}

/** A store location changed status (requested, reviewed, resubmitted or closed). */
export class LocationStatusChanged extends DomainEvent {
	public readonly eventName = "tenants.LocationStatusChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly tenantId: string,
		public readonly locationId: string,
		public readonly from: LocationStatus | null,
		public readonly to: LocationStatus,
	) {
		super(occurredAt);
	}
}

/** An invitation changed status (issued, accepted, revoked or expired). */
export class InvitationStatusChanged extends DomainEvent {
	public readonly eventName = "tenants.InvitationStatusChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly invitationId: string,
		public readonly from: TenantInvitationStatus | null,
		public readonly to: TenantInvitationStatus,
	) {
		super(occurredAt);
	}
}

/** An access request was approved or rejected. */
export class AccessRequestReviewed extends DomainEvent {
	public readonly eventName = "tenants.AccessRequestReviewed";

	public constructor(
		occurredAt: EpochMs,
		public readonly accessRequestId: string,
		public readonly approved: boolean,
	) {
		super(occurredAt);
	}
}

/** A membership was granted, narrowed or renamed. */
export class MembershipChanged extends DomainEvent {
	public readonly eventName = "tenants.MembershipChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly tenantId: string,
		public readonly membershipId: string,
	) {
		super(occurredAt);
	}
}

/** A tenant moved between lifecycle states (provisioned, activated). */
export class TenantLifecycleChanged extends DomainEvent {
	public readonly eventName = "tenants.TenantLifecycleChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly tenantId: string,
		public readonly from: TenantLifecycleState | null,
		public readonly to: TenantLifecycleState,
	) {
		super(occurredAt);
	}
}

export type TenantsDomainEvent =
	MerchantVerificationStatusChanged | LocationStatusChanged | InvitationStatusChanged | AccessRequestReviewed | MembershipChanged | TenantLifecycleChanged;
