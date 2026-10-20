import { TenantAccessRequestStatusSchema, type EpochMs, type TenantAccessRequestStatus } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { AccessRequestAlreadyReviewedError, AccessRequestPendingError, AlreadyMemberError, TenantsCorruptStateError } from "../errors/tenants.errors";
import { AccessRequestReviewed, type TenantsDomainEvent } from "../events/tenants.events";

export interface AccessRequestState {
	readonly id: string;
	readonly tenantId: string;
	readonly userId: string;
	readonly status: string;
	readonly message: string | null;
	readonly createdAt: EpochMs;
}

/** What the requester already holds in the tenant, read before a new request is opened. */
export interface AccessRequestPreconditions {
	readonly isMember: boolean;
	readonly hasPendingRequest: boolean;
}

/** A signed-in user's request to join a tenant, reviewed once by a team manager. */
export class AccessRequest extends AggregateRoot<TenantsDomainEvent> {
	private review: { readonly reviewedByUserId: string; readonly reviewedAt: EpochMs } | null = null;

	private constructor(
		public readonly id: string,
		public readonly tenantId: string,
		public readonly requesterUserId: string,
		public readonly message: string | null,
		private readonly loadedStatus: TenantAccessRequestStatus | null,
		private status: TenantAccessRequestStatus,
	) {
		super();
	}

	public static rehydrate(state: AccessRequestState): AccessRequest {
		const status = TenantAccessRequestStatusSchema.safeParse(state.status);
		if (!status.success) {
			throw new TenantsCorruptStateError(state.id);
		}
		return new AccessRequest(state.id, state.tenantId, state.userId, state.message, status.data, status.data);
	}

	/** Open a PENDING request. A member cannot ask again, and one request may be pending at a time. */
	public static open(id: string, tenantId: string, requesterUserId: string, message: string | null, preconditions: AccessRequestPreconditions): AccessRequest {
		if (preconditions.isMember) {
			throw new AlreadyMemberError("Already a member");
		}
		if (preconditions.hasPendingRequest) {
			throw new AccessRequestPendingError();
		}
		return new AccessRequest(id, tenantId, requesterUserId, message, null, "PENDING");
	}

	/** The status this request was loaded with (`null` = new); persistence compares it (CAS). */
	public get concurrencyToken(): TenantAccessRequestStatus | null {
		return this.loadedStatus;
	}

	public get currentStatus(): TenantAccessRequestStatus {
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

	private decide(to: TenantAccessRequestStatus, reviewerUserId: string, now: EpochMs): void {
		if (this.status !== "PENDING") {
			throw new AccessRequestAlreadyReviewedError();
		}
		this.status = to;
		this.review = { reviewedByUserId: reviewerUserId, reviewedAt: now };
		this.record(new AccessRequestReviewed(now, this.id, to === "APPROVED"));
	}
}
