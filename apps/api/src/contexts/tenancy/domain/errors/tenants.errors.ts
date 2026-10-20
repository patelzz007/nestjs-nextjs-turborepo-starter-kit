import { DomainErrorCodeSchema, type DomainErrorCode } from "../../../../platform/domain/errors/error-codes";
import { DomainError } from "../../../../platform/domain/errors/domain-error";

/**
 * Error codes clients branch on for team membership, invitations and access
 * requests. The values are the stable wire codes.
 */
export const TENANT_MEMBERSHIP_ERROR_CODES = {
	alreadyMember: "TENANT_ALREADY_MEMBER",
	accessRequestPending: "TENANT_ACCESS_REQUEST_PENDING",
	accessRequestAlreadyReviewed: "TENANT_ACCESS_REQUEST_ALREADY_REVIEWED",
	invitePending: "TENANT_INVITE_PENDING",
	inviteNoLongerPending: "TENANT_INVITE_NO_LONGER_PENDING",
	inviteEmailMismatch: "TENANT_INVITE_EMAIL_MISMATCH",
	accountExists: "TENANT_INVITE_ACCOUNT_EXISTS",
	scopeEscalation: "TENANT_SCOPE_ESCALATION",
	invalidLocations: "TENANT_LOCATIONS_INVALID",
} satisfies Readonly<Record<string, DomainErrorCode>>;

/** The domain error codes the tenants context throws (a subset of the platform catalog, for the HTTP status map). */
export const TenantsDomainErrorCodeSchema = DomainErrorCodeSchema.extract([
	"BAD_REQUEST",
	"CORRUPT_AGGREGATE_STATE",
	"TENANT_ACCESS_REQUEST_ALREADY_REVIEWED",
	"TENANT_ACCESS_REQUEST_PENDING",
	"TENANT_ALREADY_MEMBER",
	"TENANT_INVITE_PENDING",
	"TENANT_INVITE_NO_LONGER_PENDING",
	"TENANT_INVITE_EMAIL_MISMATCH",
	"TENANT_INVITE_ACCOUNT_EXISTS",
	"TENANT_SCOPE_ESCALATION",
	"TENANT_LOCATIONS_INVALID",
	"TENANT_OWNER_PROTECTED",
	"TENANT_MEMBER_COVERS_ALL_STORES",
	"TENANT_MEMBER_LAST_STORE",
	"TENANT_STORE_OUT_OF_SCOPE",
	"TENANT_LOCATION_STATUS_CONFLICT",
	"TENANT_LOCATION_PRIMARY_CANNOT_CLOSE",
	"TENANT_MEMBERSHIP_UPDATE_DURING_IMPERSONATION",
	"TENANT_NOT_PROVISIONING",
	"TENANT_NOT_ACTIVE",
	"TENANT_SUSPENDED",
	"MEMBERSHIP_INACTIVE",
	"TENANT_SLUG_TAKEN",
	"TENANT_PROVISIONING_DISABLED",
	"KYB_REVIEW_CLOSED",
	"KYB_DOCUMENT_INVALID",
	"KYB_DOCUMENT_INCOMPLETE",
	"KYB_DOCUMENT_REJECTED",
	"KYB_TRANSITION_NOT_ALLOWED",
	"KYB_DECISION_REASON_REQUIRED",
	"MERCHANT_INVITE_EXPIRED",
	"MERCHANT_INVITE_UNAVAILABLE",
	"MERCHANT_ONBOARDING_DOCUMENTS_CLOSED",
]);

export type TenantsDomainErrorCode = (typeof TenantsDomainErrorCodeSchema)["options"][number];

// ── Access requests and memberships ──────────────────────────────────────────

export class AccessRequestAlreadyReviewedError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_ACCESS_REQUEST_ALREADY_REVIEWED";

	public constructor() {
		super("This access request has already been reviewed");
	}
}

export class AccessRequestPendingError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_ACCESS_REQUEST_PENDING";

	public constructor() {
		super("Access request already pending");
	}
}

/** The person is already a member. The message names who (the caller, the requester, the invitee). */
export class AlreadyMemberError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_ALREADY_MEMBER";

	public constructor(message: string) {
		super(message);
	}
}

export class ScopeEscalationError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_SCOPE_ESCALATION";

	public constructor() {
		super("You can only grant access to stores within your own location scope");
	}
}

export class InvalidLocationsError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_LOCATIONS_INVALID";

	public constructor() {
		super("One or more selected stores are invalid or not yet approved");
	}
}

export class OwnerProtectedError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_OWNER_PROTECTED";

	public constructor() {
		super("The tenant owner cannot be removed from a store");
	}
}

export class MemberCoversAllStoresError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_MEMBER_COVERS_ALL_STORES";

	public constructor() {
		super("This member has access to every store; narrow their access to selected stores first");
	}
}

export class MemberLastStoreError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_MEMBER_LAST_STORE";

	public constructor() {
		super("This is the member's last store; set allowNoStores to remove them from it anyway");
	}
}

export class StoreOutOfScopeError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_STORE_OUT_OF_SCOPE";

	public constructor() {
		super("This store is outside your location scope");
	}
}

export class MembershipUpdateDuringImpersonationError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_MEMBERSHIP_UPDATE_DURING_IMPERSONATION";

	public constructor() {
		super("A membership's display name cannot be changed during impersonation.");
	}
}

// ── Invitations ──────────────────────────────────────────────────────────────

export class InvitePendingError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_INVITE_PENDING";

	public constructor() {
		super("A pending invitation already exists for this email");
	}
}

export class InviteNoLongerPendingError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_INVITE_NO_LONGER_PENDING";

	public constructor() {
		super("This invitation is no longer valid — it was already used, revoked, or has expired");
	}
}

export class InviteEmailMismatchError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_INVITE_EMAIL_MISMATCH";

	public constructor() {
		super("Sign in with the invited email address to accept this invitation");
	}
}

export class InviteAccountExistsError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_INVITE_ACCOUNT_EXISTS";

	public constructor() {
		super("An account already exists for this email. Sign in to accept the invitation.");
	}
}

/** A team invitation past its expiry (the wire code stays the generic `BAD_REQUEST` clients already see). */
export class TeamInviteExpiredError extends DomainError {
	public readonly code: DomainErrorCode = "BAD_REQUEST";

	public constructor() {
		super("Invitation has expired");
	}
}

export class MerchantInviteExpiredError extends DomainError {
	public readonly code: DomainErrorCode = "MERCHANT_INVITE_EXPIRED";

	public constructor() {
		super("This merchant invite has expired");
	}
}

export class MerchantInviteUnavailableError extends DomainError {
	public readonly code: DomainErrorCode = "MERCHANT_INVITE_UNAVAILABLE";

	public constructor() {
		super("This merchant invite has already been used or has expired");
	}
}

/**
 * Another request registered the onboarding address while this onboarding ran: the onboarding was
 * rolled back. Retrying finds that account and verifies its password (409, safe to retry).
 */
export class OnboardingAccountRaceError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor() {
		super("This email address was registered while onboarding ran. Try again.");
	}
}

export class OnboardingDocumentsClosedError extends DomainError {
	public readonly code: DomainErrorCode = "MERCHANT_ONBOARDING_DOCUMENTS_CLOSED";

	public constructor() {
		super("This onboarding link can no longer be used for documents — sign in and submit verification documents from the merchant dashboard");
	}
}

// ── Tenants ────────────────────────────────────────────────────────────

export class TenantNotProvisioningError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_NOT_PROVISIONING";

	public constructor() {
		super("Only a tenant in provisioning can be activated");
	}
}

export class TenantSlugTakenError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_SLUG_TAKEN";

	public constructor() {
		super("A tenant with this slug already exists");
	}
}

/** This deployment serves one tenant (single-tenant mode), so no invite may create another. */
export class TenantProvisioningDisabledError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_PROVISIONING_DISABLED";

	public constructor() {
		super("This deployment serves a single tenant: new merchants cannot be invited");
	}
}

// ── Locations ────────────────────────────────────────────────────────────────

/** A location status change lost to a concurrent change, or was never valid from the current status. */
export class LocationStatusConflictError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_LOCATION_STATUS_CONFLICT";

	public constructor(message: string) {
		super(message);
	}
}

export class PrimaryLocationCloseRefusedError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_LOCATION_PRIMARY_CANNOT_CLOSE";

	public constructor() {
		super("The primary store cannot be closed");
	}
}

/** Too many store requests waiting for review (the wire code stays the generic `BAD_REQUEST`). */
export class LocationRequestQuotaExceededError extends DomainError {
	public readonly code: DomainErrorCode = "BAD_REQUEST";

	public constructor() {
		super("Too many store requests are already pending review");
	}
}

// ── Merchant verification (KYB) ──────────────────────────────────────────────

/** The merchant resubmitted an approved review (the wire code stays the generic `BAD_REQUEST`). */
export class KybAlreadyApprovedError extends DomainError {
	public readonly code: DomainErrorCode = "BAD_REQUEST";

	public constructor() {
		super("Business verification is already approved");
	}
}

/** The review is final for this submission path; the evidence may no longer be replaced. */
export class KybReviewClosedError extends DomainError {
	public readonly code: DomainErrorCode = "KYB_REVIEW_CLOSED";

	public constructor(status: string) {
		super(`Business verification is already ${status.toLowerCase()}`);
	}
}

export class KybDocumentInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "KYB_DOCUMENT_INVALID";

	public constructor() {
		super("Invalid KYB document");
	}
}

export class KybDocumentIncompleteError extends DomainError {
	public readonly code: DomainErrorCode = "KYB_DOCUMENT_INCOMPLETE";

	public constructor() {
		super("KYB document upload is incomplete");
	}
}

export class KybDocumentRejectedError extends DomainError {
	public readonly code: DomainErrorCode = "KYB_DOCUMENT_REJECTED";

	public constructor(fileStatus: string) {
		super(`KYB document is ${fileStatus.toLowerCase()} and cannot be submitted`);
	}
}

export class KybTransitionNotAllowedError extends DomainError {
	public readonly code: DomainErrorCode = "KYB_TRANSITION_NOT_ALLOWED";

	public constructor(tenantId: string, from: string, to: string) {
		super("That business verification decision is not allowed from the current review status.", { tenantId, from, to });
	}
}

export class KybDecisionReasonRequiredError extends DomainError {
	public readonly code: DomainErrorCode = "KYB_DECISION_REASON_REQUIRED";

	public constructor(to: string) {
		super("A reason is required when rejecting or requesting action", { to });
	}
}

/** An ordinary route was called while the tenant is provisioning or pending deletion. */
export class TenantRouteNotActiveError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_NOT_ACTIVE";

	public constructor() {
		super("This tenant is not active");
	}
}

/** An ordinary route was called while the tenant is suspended. */
export class TenantSuspendedError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_SUSPENDED";

	public constructor() {
		super("This tenant is suspended");
	}
}

/** A membership is suspended or still pending, and this route is not leave-tenant. */
export class MembershipInactiveError extends DomainError {
	public readonly code: DomainErrorCode = "MEMBERSHIP_INACTIVE";

	public constructor() {
		super("Your membership in this tenant is not active");
	}
}

// ── Persistence integrity ────────────────────────────────────────────────────

/** Stored tenant data violates an aggregate invariant; never loaded silently. */
export class TenantsCorruptStateError extends DomainError {
	public readonly code: DomainErrorCode = "CORRUPT_AGGREGATE_STATE";

	public constructor(aggregateId: string) {
		super("Stored tenant state cannot be loaded.", { aggregateId });
	}
}
