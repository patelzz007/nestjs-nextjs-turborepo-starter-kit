import { OrganizationAccessRequestStatusSchema, type EpochMs, type OrganizationAccessRequestStatus } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { AccessRequestAlreadyReviewedError, AccessRequestPendingError, AlreadyMemberError, OrganizationsCorruptStateError } from "../errors/organizations.errors";
import { AccessRequestReviewed, type OrganizationsDomainEvent } from "../events/organizations.events";

export interface AccessRequestState {
	readonly id: string;
	readonly organizationId: string;
	readonly userId: string;
	readonly status: string;
	readonly message: string | null;
	readonly createdAt: EpochMs;
}

/** What the requester already holds in the organization, read before a new request is opened. */
export interface AccessRequestPreconditions {
	readonly isMember: boolean;
	readonly hasPendingRequest: boolean;
}

/** A signed-in user's request to join an organization, reviewed once by a team manager. */
export class AccessRequest extends AggregateRoot<OrganizationsDomainEvent> {
	private review: { readonly reviewedByUserId: string; readonly reviewedAt: EpochMs } | null = null;

	private constructor(
		public readonly id: string,
		public readonly organizationId: string,
		public readonly requesterUserId: string,
		public readonly message: string | null,
		private readonly loadedStatus: OrganizationAccessRequestStatus | null,
		private status: OrganizationAccessRequestStatus,
	) {
		super();
	}

	public static rehydrate(state: AccessRequestState): AccessRequest {
		const status = OrganizationAccessRequestStatusSchema.safeParse(state.status);
		if (!status.success) {
			throw new OrganizationsCorruptStateError(state.id);
		}
		return new AccessRequest(state.id, state.organizationId, state.userId, state.message, status.data, status.data);
	}

	/** Open a PENDING request. A member cannot ask again, and one request may be pending at a time. */
	public static open(id: string, organizationId: string, requesterUserId: string, message: string | null, preconditions: AccessRequestPreconditions): AccessRequest {
		if (preconditions.isMember) {
			throw new AlreadyMemberError("Already a member");
		}
		if (preconditions.hasPendingRequest) {
			throw new AccessRequestPendingError();
		}
		return new AccessRequest(id, organizationId, requesterUserId, message, null, "PENDING");
	}

	/** The status this request was loaded with (`null` = new); persistence compares it (CAS). */
	public get concurrencyToken(): OrganizationAccessRequestStatus | null {
		return this.loadedStatus;
	}

	public get currentStatus(): OrganizationAccessRequestStatus {
		return this.status;
	}

	public get reviewStamp(): { readonly reviewedByUserId: string; readonly reviewedAt: EpochMs } | null {
		return this.review;
	}

	/** PENDING → APPROVED. The caller grants the membership in the same unit of work. */
	public approve(reviewerUserId: string, now: EpochMs): void {
		this.decide("APPROVED", reviewerUserId, now);
	}

	/** PENDING → REJECTED. */
	public reject(reviewerUserId: string, now: EpochMs): void {
		this.decide("REJECTED", reviewerUserId, now);
	}

	private decide(to: OrganizationAccessRequestStatus, reviewerUserId: string, now: EpochMs): void {
		if (this.status !== "PENDING") {
			throw new AccessRequestAlreadyReviewedError();
		}
		this.status = to;
		this.review = { reviewedByUserId: reviewerUserId, reviewedAt: now };
		this.record(new AccessRequestReviewed(now, this.id, to === "APPROVED"));
	}
}
