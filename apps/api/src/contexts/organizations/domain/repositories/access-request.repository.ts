import type { AccessRequest, AccessRequestState } from "../aggregates/access-request.aggregate";

/** Persistence port of the {@link AccessRequest} aggregate (bound to one unit of work). */
export interface AccessRequestRepository {
	nextId(): string;
	hasPending(organizationId: string, userId: string): Promise<boolean>;
	findInOrganization(organizationId: string, accessRequestId: string): Promise<AccessRequest | null>;
	/** Inserts a PENDING request. A concurrent duplicate throws `AccessRequestPendingError` (partial unique index). */
	add(request: AccessRequest): Promise<AccessRequestState>;
	/** Compare-and-set PENDING → reviewed; a lost race throws `AccessRequestAlreadyReviewedError`. */
	save(request: AccessRequest): Promise<void>;
}
