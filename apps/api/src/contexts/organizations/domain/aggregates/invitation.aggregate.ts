import {
	epochMs,
	OrganizationInvitationKindSchema,
	OrganizationInvitationStatusSchema,
	OrganizationMembershipRoleSchema,
	type EpochMs,
	type OrganizationInvitationKind,
	type OrganizationInvitationStatus,
	type OrganizationMembershipRole,
} from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import {
	AlreadyMemberError,
	InviteEmailMismatchError,
	InviteNoLongerPendingError,
	InvitePendingError,
	MerchantInviteUnavailableError,
	OrganizationsCorruptStateError,
} from "../errors/organizations.errors";
import { InvitationStatusChanged, type OrganizationsDomainEvent } from "../events/organizations.events";
import {
	assertDocumentsWindowOpen,
	assertOnboardingInviteNotExpired,
	assertTeamInviteNotExpired,
	documentsWindowOpen,
	documentsWindowStart,
	ONBOARDING_INVITE_TTL_MS,
	TEAM_INVITE_TTL_MS,
	type DocumentsWindowFacts,
} from "../policies/invitation-validity.policy";
import { LocationScope, type LocationScopeRow } from "../value-objects/location-scope.value-object";

export interface InvitationState {
	readonly id: string;
	readonly organizationId: string | null;
	readonly email: string;
	readonly kind: string;
	readonly status: string;
	readonly intendedRole: string;
	readonly locationScopeType: string;
	readonly locationIds: readonly string[];
	readonly expiresAt: EpochMs;
	readonly acceptedByUserId: string | null;
	readonly acceptedAt: EpochMs | null;
	readonly documentsSubmittedAt: EpochMs | null;
}

/** What the organization already holds for a new team invite, read in the inviting unit of work. */
export interface TeamInvitePreconditions {
	readonly inviteeIsMember: boolean;
	/** How many of the invite's SELECTED stores are live ACTIVE stores of the organization. */
	readonly activeLocationCount: number;
}

/** The transition this unit of work made, for the repository's compare-and-set. */
export type InvitationChange =
	| { readonly kind: "issued"; readonly tokenHash: string; readonly createdByUserId: string }
	| { readonly kind: "accepted"; readonly userId: string; readonly at: EpochMs }
	| { readonly kind: "revoked"; readonly at: EpochMs }
	| { readonly kind: "expired"; readonly at: EpochMs }
	| { readonly kind: "documents_submitted"; readonly at: EpochMs; readonly acceptedSince: EpochMs };

/**
 * An invitation into an organization: a team-member invite (role + store
 * scope) or the merchant onboarding invite. Single use; every transition is
 * guarded by the status it was loaded with.
 */
export class Invitation extends AggregateRoot<OrganizationsDomainEvent> {
	private change: InvitationChange | null = null;

	private constructor(
		public readonly id: string,
		public readonly organizationId: string | null,
		public readonly email: string,
		public readonly kind: OrganizationInvitationKind,
		private readonly loadedStatus: OrganizationInvitationStatus | null,
		private status: OrganizationInvitationStatus,
		public readonly intendedRole: OrganizationMembershipRole,
		public readonly scope: LocationScope,
		public readonly expiresAt: EpochMs,
		private acceptedBy: string | null,
		private readonly acceptedAt: EpochMs | null,
		private readonly documentsSubmittedAt: EpochMs | null,
	) {
		super();
	}

	public static rehydrate(state: InvitationState): Invitation {
		const kind = OrganizationInvitationKindSchema.safeParse(state.kind);
		const status = OrganizationInvitationStatusSchema.safeParse(state.status);
		const role = OrganizationMembershipRoleSchema.safeParse(state.intendedRole);
		if (!kind.success || !status.success || !role.success) {
			throw new OrganizationsCorruptStateError(state.id);
		}
		const scopeRows: readonly LocationScopeRow[] =
			state.locationScopeType === "ALL_LOCATIONS"
				? [{ scopeType: "ALL_LOCATIONS", locationId: null }]
				: state.locationIds.map((locationId): LocationScopeRow => ({ scopeType: "SELECTED", locationId }));
		return new Invitation(
			state.id,
			state.organizationId,
			state.email,
			kind.data,
			status.data,
			status.data,
			role.data,
			LocationScope.fromRows(scopeRows),
			state.expiresAt,
			state.acceptedByUserId,
			state.acceptedAt,
			state.documentsSubmittedAt,
		);
	}

	/**
	 * A team invite for `email`, valid for `TEAM_INVITE_TTL_DAYS` days. Refused
	 * when the invitee is already a member, or when a SELECTED store is not a
	 * live, approved store of the organization.
	 */
	public static issueTeamInvite(
		id: string,
		organizationId: string,
		email: string,
		role: OrganizationMembershipRole,
		scope: LocationScope,
		preconditions: TeamInvitePreconditions,
		tokenHash: string,
		invitedByUserId: string,
		now: EpochMs,
	): Invitation {
		if (preconditions.inviteeIsMember) {
			throw new AlreadyMemberError("User is already a member of this organization");
		}
		scope.assertAllActive(preconditions.activeLocationCount);
		return Invitation.issued(id, organizationId, email, "TEAM_MEMBER", role, scope, addMs(now, TEAM_INVITE_TTL_MS), tokenHash, invitedByUserId, now);
	}

	/** The onboarding invite of a freshly provisioned organization, valid for `ONBOARDING_INVITE_TTL_DAYS` days. */
	public static issueOnboardingInvite(
		id: string,
		organizationId: string,
		email: string,
		role: OrganizationMembershipRole,
		tokenHash: string,
		createdByUserId: string,
		now: EpochMs,
	): Invitation {
		return Invitation.issued(
			id,
			organizationId,
			email,
			"PLATFORM_ONBOARDING",
			role,
			LocationScope.allLocations(),
			addMs(now, ONBOARDING_INVITE_TTL_MS),
			tokenHash,
			createdByUserId,
			now,
		);
	}

	private static issued(
		id: string,
		organizationId: string,
		email: string,
		kind: OrganizationInvitationKind,
		role: OrganizationMembershipRole,
		scope: LocationScope,
		expiresAt: EpochMs,
		tokenHash: string,
		createdByUserId: string,
		now: EpochMs,
	): Invitation {
		const invitation = new Invitation(id, organizationId, email, kind, null, "PENDING", role, scope, expiresAt, null, null, null);
		invitation.change = { kind: "issued", tokenHash, createdByUserId };
		invitation.record(new InvitationStatusChanged(now, id, null, "PENDING"));
		return invitation;
	}

	/** The status this invitation was loaded with (`null` = new); persistence compares it (CAS). */
	public get concurrencyToken(): OrganizationInvitationStatus | null {
		return this.loadedStatus;
	}

	public get currentStatus(): OrganizationInvitationStatus {
		return this.status;
	}

	public get pendingChange(): InvitationChange | null {
		return this.change;
	}

	/** The user who accepted it, once accepted. */
	public get acceptedByUserId(): string | null {
		return this.acceptedBy;
	}

	/** A pending invite whose expiry has passed (it no longer blocks a fresh one). */
	public isLapsed(now: EpochMs): boolean {
		return this.status === "PENDING" && this.expiresAt <= now;
	}

	/** Team invite links stop working once `expiresAt` is in the past. */
	public assertTeamInviteUsable(now: EpochMs): void {
		assertTeamInviteNotExpired(this.expiresAt, now);
	}

	/** Onboarding links stop working at `expiresAt`. */
	public assertOnboardingInviteUsable(now: EpochMs): void {
		assertOnboardingInviteNotExpired(this.expiresAt, now);
	}

	/** Only the invited address may accept a team invite (case-insensitive). */
	public assertAcceptableBy(email: string): void {
		if (this.email.toLowerCase() !== email.toLowerCase()) {
			throw new InviteEmailMismatchError();
		}
	}

	/** PENDING and unexpired → ACCEPTED by `userId`. */
	public accept(userId: string, now: EpochMs): void {
		if (this.status !== "PENDING" || this.expiresAt <= now) {
			throw this.kind === "TEAM_MEMBER" ? new InviteNoLongerPendingError() : new MerchantInviteUnavailableError();
		}
		this.acceptedBy = userId;
		this.change = { kind: "accepted", userId, at: now };
		this.transition("ACCEPTED", now);
	}

	/** PENDING → REVOKED. */
	public revoke(now: EpochMs): void {
		if (this.status !== "PENDING") {
			throw new InviteNoLongerPendingError();
		}
		this.change = { kind: "revoked", at: now };
		this.transition("REVOKED", now);
	}

	/**
	 * Make way for a fresh invite to the same email: a lapsed PENDING invite →
	 * EXPIRED. A pending invite that is still valid blocks the new one.
	 */
	public expire(now: EpochMs): void {
		if (!this.isLapsed(now)) {
			throw new InvitePendingError();
		}
		this.change = { kind: "expired", at: now };
		this.transition("EXPIRED", now);
	}

	/** Throws `OnboardingDocumentsClosedError` unless the onboarding token's single-use document window is open. */
	public assertDocumentsWindowOpen(now: EpochMs): void {
		assertDocumentsWindowOpen(this.windowFacts(), now);
	}

	/** Whether the onboarding token's single-use document window is still open. */
	public documentsWindowOpen(now: EpochMs): boolean {
		return documentsWindowOpen(this.windowFacts(), now);
	}

	/** Use the document window (exactly once). */
	public consumeDocumentsWindow(now: EpochMs): void {
		this.assertDocumentsWindowOpen(now);
		this.change = { kind: "documents_submitted", at: now, acceptedSince: documentsWindowStart(now) };
	}

	private windowFacts(): DocumentsWindowFacts {
		return { kind: this.kind, status: this.status, acceptedByUserId: this.acceptedBy, acceptedAt: this.acceptedAt, documentsSubmittedAt: this.documentsSubmittedAt };
	}

	private transition(to: OrganizationInvitationStatus, now: EpochMs): void {
		const from = this.status;
		this.status = to;
		this.record(new InvitationStatusChanged(now, this.id, from, to));
	}
}

function addMs(at: EpochMs, ms: number): EpochMs {
	return epochMs(at + ms);
}
