import type { EpochMs, KybStatus, OrganizationInvitationStatus, OrganizationLifecycleState, OrganizationLocationStatus } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/** The KYB review status of a merchant organization changed (submission, scan verdict or admin decision). */
export class MerchantVerificationStatusChanged extends DomainEvent {
	public readonly eventName = "organizations.MerchantVerificationStatusChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly organizationId: string,
		public readonly from: KybStatus,
		public readonly to: KybStatus,
	) {
		super(occurredAt);
	}
}

/** A store location changed status (requested, reviewed, resubmitted or closed). */
export class LocationStatusChanged extends DomainEvent {
	public readonly eventName = "organizations.LocationStatusChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly organizationId: string,
		public readonly locationId: string,
		public readonly from: OrganizationLocationStatus | null,
		public readonly to: OrganizationLocationStatus,
	) {
		super(occurredAt);
	}
}

/** An invitation changed status (issued, accepted, revoked or expired). */
export class InvitationStatusChanged extends DomainEvent {
	public readonly eventName = "organizations.InvitationStatusChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly invitationId: string,
		public readonly from: OrganizationInvitationStatus | null,
		public readonly to: OrganizationInvitationStatus,
	) {
		super(occurredAt);
	}
}

/** An access request was approved or rejected. */
export class AccessRequestReviewed extends DomainEvent {
	public readonly eventName = "organizations.AccessRequestReviewed";

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
	public readonly eventName = "organizations.MembershipChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly organizationId: string,
		public readonly membershipId: string,
	) {
		super(occurredAt);
	}
}

/** An organization moved between lifecycle states (provisioned, activated). */
export class OrganizationLifecycleChanged extends DomainEvent {
	public readonly eventName = "organizations.OrganizationLifecycleChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly organizationId: string,
		public readonly from: OrganizationLifecycleState | null,
		public readonly to: OrganizationLifecycleState,
	) {
		super(occurredAt);
	}
}

export type OrganizationsDomainEvent =
	MerchantVerificationStatusChanged | LocationStatusChanged | InvitationStatusChanged | AccessRequestReviewed | MembershipChanged | OrganizationLifecycleChanged;
