import { createHash, randomBytes } from "node:crypto";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { OrganizationLocationScopeType, OrganizationMembershipRole } from "@prisma/client";
import {
	epochMs,
	type OrganizationAccessRequestCreateInput,
	type OrganizationAccessRequestResponse,
	type OrganizationMemberInviteCreatedResponse,
	type OrganizationMemberInviteInput,
	type OrganizationMemberInviteResponse,
	type OrganizationMemberRosterResponse,
	type OrganizationTeamInviteAcceptResponse,
	type OrganizationTeamInvitePreview,
	type OrganizationTeamInviteRegisterAcceptInput,
	type ReviewOrganizationAccessRequestInput,
	APP_LINKS,
	MERCHANT_CAPABILITY,
} from "@workspace/shared";

import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "../../../common/errors/app-error";
import { TypedConfigService } from "../../../config/typed-config.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CryptoService } from "../../auth/services/crypto.service";
import { EmailVerificationService } from "../../auth/services/email-verification.service";
import { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { LogService } from "../../logs/logs.service";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { TeamMemberInviteEmailTemplate } from "../../notifications/email/templates/team-member-invite-email.template";
import { OrganizationInviteRepository, type TeamInviteRow } from "../repositories/organization-invite.repository";
import { buildMembershipLocationScopeRows } from "../utils/organization-membership-location-scope.util";
import { mapMembershipToRosterResponse } from "../utils/organization-membership-mapper.util";
import { withUniqueViolationAs } from "../utils/unique-violation.util";
import { OrganizationAuditService } from "./organization-audit.service";
import type { ResolvedOrganizationContext } from "./organization-context.service";
import { OrganizationRewardAuthService } from "./organization-reward-auth.service";

const INVITE_TTL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const INVITE_TTL_MS = INVITE_TTL_DAYS * MS_PER_DAY;
/** Random bytes in a team invite token (hex-encoded in the link; only its SHA-256 is stored). */
const INVITE_TOKEN_BYTES = 32;

const ROLE_LABELS: Readonly<Record<OrganizationMembershipRole, string>> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MEMBER: "Member",
	POLICY_ADMIN: "Policy admin",
	CASHIER: "Cashier",
};

/** Error codes this service adds on top of the standard ones (clients branch on them). */
export const ORGANIZATION_MEMBERSHIP_ERROR_CODES = {
	alreadyMember: "ORGANIZATION_ALREADY_MEMBER",
	accessRequestPending: "ORGANIZATION_ACCESS_REQUEST_PENDING",
	accessRequestAlreadyReviewed: "ORGANIZATION_ACCESS_REQUEST_ALREADY_REVIEWED",
	invitePending: "ORGANIZATION_INVITE_PENDING",
	inviteNoLongerPending: "ORGANIZATION_INVITE_NO_LONGER_PENDING",
	inviteEmailMismatch: "ORGANIZATION_INVITE_EMAIL_MISMATCH",
	accountExists: "ORGANIZATION_INVITE_ACCOUNT_EXISTS",
	scopeEscalation: "ORGANIZATION_SCOPE_ESCALATION",
	invalidLocations: "ORGANIZATION_LOCATIONS_INVALID",
} satisfies Readonly<Record<string, string>>;

/** The transaction client a system operation hands its handler. */
type SystemOperationTransaction = Parameters<Parameters<TenantTransactionService["withSystemOperation"]>[1]>[0];

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

/** Allowlisted system operation that reads co-members' profiles into the team roster. */
export const TEAM_ROSTER_PROFILES_OPERATION = "organization.membership.roster";

/**
 * The authenticated member acting on their organization's team — resolved
 * server-side (`OrganizationContextService.resolveBySlug`), never from the
 * request body. Carries the member's own location scope (a manager cannot
 * grant more stores than they hold) and the tenant policy version their
 * authorization ran under (stamped on every audit row).
 */
export interface OrganizationTeamActor {
	readonly userId: string;
	readonly organizationId: string;
	readonly role: OrganizationMembershipRole;
	readonly locationScopeType: OrganizationLocationScopeType;
	readonly locationIds: readonly string[];
	readonly policyVersion: number;
}

/** The team actor for a member resolved by `OrganizationContextService.resolveBySlug`. */
export function teamActorFromContext(resolved: ResolvedOrganizationContext): OrganizationTeamActor {
	return {
		userId: resolved.userId,
		organizationId: resolved.organizationId,
		role: resolved.membership.role,
		locationScopeType: resolved.membership.locationScopeType,
		locationIds: resolved.membership.locationIds,
		policyVersion: resolved.policyVersion,
	};
}

/** Account created by {@link OrganizationMembershipService.registerAndAcceptTeamInvite}; the caller issues its session. */
export interface RegisteredTeamInviteAcceptance extends OrganizationTeamInviteAcceptResponse {
	readonly userId: string;
	readonly email: string;
}

/** Location scope a team manager grants (invite or access-request approval). */
interface GrantedLocationScope {
	readonly locationScopeType: OrganizationLocationScopeType;
	readonly locationIds: readonly string[];
}

@Injectable()
export class OrganizationMembershipService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: OrganizationAuditService,
		private readonly inviteRepository: OrganizationInviteRepository,
		private readonly emailSender: EmailSenderService,
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
		private readonly cryptoService: CryptoService,
		private readonly userProvisioning: UserProvisioningService,
		private readonly emailVerificationService: EmailVerificationService,
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
		private readonly cedar: CedarPolicyEvaluatorService,
	) {}

	public async createAccessRequest(userId: string, organizationId: string, input: OrganizationAccessRequestCreateInput): Promise<OrganizationAccessRequestResponse> {
		const policyVersion = await this.cedar.getActivePolicyVersion(organizationId);
		return withUniqueViolationAs(
			async () =>
				this.tenantTx.withSystemOperation(
					{
						operation: "organization.access_request.create",
						reason: "User access request",
						actorUserId: userId,
					},
					async (tx) => {
						const existing = await tx.organizationMembership.findFirst({
							where: { organizationId, userId, isDeleted: false },
						});
						if (existing !== null) {
							throw new ConflictError({ code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.alreadyMember, message: "Already a member" });
						}
						const pending = await tx.organizationAccessRequest.findFirst({
							where: { organizationId, userId, status: "PENDING" },
						});
						if (pending !== null) {
							throw this.accessRequestPendingError();
						}
						// The partial unique index (one PENDING request per org + user)
						// turns a concurrent duplicate into a unique violation → 409.
						const request = await tx.organizationAccessRequest.create({
							data: {
								organizationId,
								userId,
								message: input.message ?? null,
							},
						});
						await this.audit.recordInTx(tx, {
							organizationId,
							actorUserId: userId,
							policyVersion,
							action: "membership.access_request_created",
							resourceType: "OrganizationAccessRequest",
							resourceId: request.id,
						});
						return {
							id: request.id,
							organizationId: request.organizationId,
							userId: request.userId,
							status: request.status,
							message: request.message,
							createdAt: epochMs(Number(request.createdAt)),
						};
					},
				),
			(cause) => this.accessRequestPendingError(cause),
		);
	}

	/**
	 * Approve or reject a pending access request. Requires `merchant:manage_team`;
	 * the granted role (never OWNER) and location scope are explicit in the
	 * contract and cannot exceed the reviewer's own scope. The PENDING → reviewed
	 * transition is a compare-and-set, so two concurrent reviews cannot both win,
	 * and the membership + audit row commit atomically with it.
	 */
	public async reviewAccessRequest(actor: OrganizationTeamActor, requestId: string, input: ReviewOrganizationAccessRequestInput): Promise<void> {
		await this.requireManageTeam(actor);
		if (input.approve) {
			this.assertScopeWithinActor(actor, input);
		}

		await withUniqueViolationAs(
			async () =>
				this.tenantTx.withSystemOperation(
					{
						operation: "organization.access_request.review",
						reason: "Review organization access request",
						actorUserId: actor.userId,
					},
					async (tx) => {
						const request = await tx.organizationAccessRequest.findFirst({
							where: { id: requestId, organizationId: actor.organizationId },
							select: { id: true, userId: true },
						});
						if (request === null) {
							throw new NotFoundError();
						}

						const reviewedAt = BigInt(Date.now());
						const claimed = await tx.organizationAccessRequest.updateMany({
							where: { id: requestId, organizationId: actor.organizationId, status: "PENDING" },
							data: { status: input.approve ? "APPROVED" : "REJECTED", reviewedById: actor.userId, reviewedAt, updatedAt: reviewedAt },
						});
						if (claimed.count !== 1) {
							throw new ConflictError({
								code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.accessRequestAlreadyReviewed,
								message: "This access request has already been reviewed",
							});
						}

						if (!input.approve) {
							await this.audit.recordInTx(tx, {
								organizationId: actor.organizationId,
								actorUserId: actor.userId,
								policyVersion: actor.policyVersion,
								action: "membership.access_request_rejected",
								resourceType: "OrganizationAccessRequest",
								resourceId: requestId,
								metadata: { requesterUserId: request.userId },
							});
							return;
						}

						if (input.locationScopeType === "SELECTED") {
							await this.requireActiveLocationIdsInTx(tx, actor.organizationId, input.locationIds);
						}
						const membership = await tx.organizationMembership.create({
							data: {
								organizationId: actor.organizationId,
								userId: request.userId,
								role: input.role,
								locationScopes: {
									create: [...buildMembershipLocationScopeRows(actor.organizationId, input.locationScopeType, input.locationIds)],
								},
							},
						});
						await this.audit.recordInTx(tx, {
							organizationId: actor.organizationId,
							actorUserId: actor.userId,
							policyVersion: actor.policyVersion,
							action: "membership.access_request_approved",
							resourceType: "OrganizationAccessRequest",
							resourceId: requestId,
							metadata: {
								requesterUserId: request.userId,
								membershipId: membership.id,
								role: input.role,
								locationScopeType: input.locationScopeType,
								locationIds: input.locationIds.join(","),
							},
						});
					},
				),
			(cause) => this.alreadyMemberError("The requester is already a member of this organization", cause),
		);
	}

	public async inviteMember(
		actor: OrganizationTeamActor,
		organizationDisplayName: string,
		input: OrganizationMemberInviteInput,
	): Promise<OrganizationMemberInviteCreatedResponse> {
		await this.requireManageTeam(actor);
		this.assertScopeWithinActor(actor, input);
		const { organizationId } = actor;

		const existingMembership = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.invitation.check_existing_membership",
				reason: "Check invitee membership before team invite",
				actorUserId: actor.userId,
			},
			async (tx) => {
				const user = await tx.user.findUnique({ where: { email: input.email } });
				if (user === null) {
					return null;
				}
				return tx.organizationMembership.findFirst({
					where: { organizationId, userId: user.id, isDeleted: false },
				});
			},
		);

		if (existingMembership !== null) {
			throw this.alreadyMemberError("User is already a member of this organization");
		}

		if (input.locationScopeType === "SELECTED") {
			await this.assertActiveLocationIds(organizationId, input.locationIds, actor.userId);
		}

		const rawToken = randomBytes(INVITE_TOKEN_BYTES).toString("hex");
		const tokenHash = sha256Hex(rawToken);
		const now = Date.now();
		const expiresAt = now + INVITE_TTL_MS;

		const invite = await withUniqueViolationAs(
			async () =>
				this.tenantTx.withSystemOperation(
					{
						operation: "organization.invitation.create",
						reason: "Create team member invitation",
						actorUserId: actor.userId,
					},
					async (tx) => {
						const pendingInvite = await this.inviteRepository.findPendingTeamInviteByEmailInTx(tx, organizationId, input.email);
						if (pendingInvite !== null) {
							if (Number(pendingInvite.expiresAt) > now) {
								throw this.invitePendingError();
							}
							// A lapsed invitation no longer blocks a fresh one: close it first
							// (compare-and-set), so the one-PENDING-per-email index admits the new row.
							if (await this.inviteRepository.expirePendingTeamInviteInTx(tx, pendingInvite.id, now)) {
								await this.audit.recordInTx(tx, {
									organizationId,
									actorUserId: actor.userId,
									policyVersion: actor.policyVersion,
									action: "membership.invite_expired",
									resourceType: "OrganizationInvitation",
									resourceId: pendingInvite.id,
								});
							}
						}

						const created = await this.inviteRepository.createTeamInviteInTx(tx, {
							email: input.email,
							tokenHash,
							organizationId,
							invitedByUserId: actor.userId,
							intendedRole: input.role,
							locationScopeType: input.locationScopeType,
							locationIds: input.locationScopeType === "SELECTED" ? input.locationIds : [],
							expiresAt,
						});
						await this.audit.recordInTx(tx, {
							organizationId,
							actorUserId: actor.userId,
							policyVersion: actor.policyVersion,
							action: "membership.invite_sent",
							resourceType: "OrganizationInvitation",
							resourceId: created.id,
							metadata: { role: input.role, email: input.email, locationScopeType: input.locationScopeType },
						});
						return created;
					},
				),
			(cause) => this.invitePendingError(cause),
		);

		// The raw token leaves the API only inside the invite email — never logs/stdout.
		const locationSummary = await this.resolveLocationSummary(organizationId, input.locationScopeType, input.locationIds, actor.userId);
		const sendResult = await this.emailSender.send(
			new TeamMemberInviteEmailTemplate({
				to: input.email,
				organizationName: organizationDisplayName,
				roleLabel: ROLE_LABELS[input.role],
				locationSummary,
				inviteUrl: this.buildTeamInviteUrl(rawToken),
				expiresInDays: INVITE_TTL_DAYS,
			}),
		);

		if (!sendResult.ok) {
			this.logService.warn("Team member invite email failed", {
				context: "OrganizationMembershipService",
				metadata: {
					inviteId: invite.id,
					reason: sendResult.reason,
					...(sendResult.detail !== undefined ? { detail: sendResult.detail } : {}),
				},
			});
		}

		return {
			inviteId: invite.id,
			message: "Invitation sent",
		};
	}

	public async listMembers(actor: OrganizationTeamActor): Promise<OrganizationMemberRosterResponse[]> {
		await this.requireManageTeam(actor);
		const { organizationId } = actor;

		const rows = await this.tenantTx.withTenantTransaction(
			{
				userId: actor.userId,
				organizationId,
				purpose: "membership.list",
				policyVersion: actor.policyVersion,
			},
			async (tx) =>
				tx.organizationMembership.findMany({
					where: { organizationId, isDeleted: false },
					include: { locationScopes: true },
					orderBy: [{ role: "asc" }, { createdAt: "asc" }],
				}),
		);

		// `users` RLS lets a session read only its own row, so the tenant
		// transaction above cannot join co-members' profiles (they came back
		// null -> 500). Read exactly this org's members' name + email under an
		// allowlisted system operation, AFTER the manage-team check passed;
		// never widen the `users` policy (it would expose whole user rows).
		const userIds: string[] = rows.map((row) => row.userId);
		const profiles = await this.tenantTx.withSystemOperation(
			{
				operation: TEAM_ROSTER_PROFILES_OPERATION,
				reason: "Team roster: member names and emails for an authorized team manager",
				actorUserId: actor.userId,
			},
			async (tx) => tx.user.findMany({ where: { id: { in: userIds }, isDeleted: false }, select: { id: true, email: true, fullName: true } }),
		);
		const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

		return rows.flatMap((row): OrganizationMemberRosterResponse[] => {
			const profile = profileById.get(row.userId);
			// A membership whose user row is gone is not a rosterable member.
			return profile === undefined ? [] : [mapMembershipToRosterResponse({ ...row, user: profile })];
		});
	}

	public async listPendingInvites(actor: OrganizationTeamActor): Promise<OrganizationMemberInviteResponse[]> {
		await this.requireManageTeam(actor);

		const rows = await this.tenantTx.withTenantTransaction(
			{
				userId: actor.userId,
				organizationId: actor.organizationId,
				purpose: "membership.list_invites",
				policyVersion: actor.policyVersion,
			},
			async (tx) => this.inviteRepository.listPendingTeamInvitesInTx(tx, actor.organizationId),
		);
		return rows.map((row) => this.mapTeamInviteResponse(row));
	}

	/** Revoke a pending team invite — a compare-and-set, so it cannot race an accept; audited in the same transaction. */
	public async revokeInvite(actor: OrganizationTeamActor, inviteId: string): Promise<void> {
		await this.requireManageTeam(actor);

		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.invitation.revoke",
				reason: "Revoke team member invitation",
				actorUserId: actor.userId,
			},
			async (tx) => {
				const invite = await this.inviteRepository.findPendingTeamInviteInTx(tx, actor.organizationId, inviteId);
				if (invite === null) {
					throw new NotFoundError();
				}
				if (!(await this.inviteRepository.revokePendingTeamInviteInTx(tx, actor.organizationId, inviteId, Date.now()))) {
					throw this.inviteNoLongerPendingError();
				}
				await this.audit.recordInTx(tx, {
					organizationId: actor.organizationId,
					actorUserId: actor.userId,
					policyVersion: actor.policyVersion,
					action: "membership.invite_revoked",
					resourceType: "OrganizationInvitation",
					resourceId: inviteId,
					metadata: { email: invite.email },
				});
			},
		);
	}

	public async validateTeamInvite(token: string): Promise<OrganizationTeamInvitePreview> {
		const invite = await this.findValidTeamInvite(token);
		const existingUser = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.invitation.preview_account",
				reason: "Check account for team invite preview",
				actorUserId: null,
			},
			async (tx) => tx.user.findUnique({ where: { email: invite.email }, select: { id: true } }),
		);

		if (invite.organization === null) {
			throw new NotFoundException();
		}

		return {
			email: invite.email,
			organizationDisplayName: invite.organization.displayName,
			organizationSlug: invite.organization.slug,
			intendedRole: invite.intendedRole,
			locationScopeType: invite.locationScopeType,
			locationIds: invite.locationScopes.map((scope) => scope.locationId),
			locationLabels: invite.locationScopes.map((scope) => ({
				id: scope.location.id,
				name: scope.location.name,
			})),
			expiresAt: epochMs(Number(invite.expiresAt)),
			hasExistingAccount: existingUser !== null,
		};
	}

	/**
	 * Create the invitee's account AND accept the invitation in ONE transaction:
	 * the account, its default role, the invite compare-and-set, the membership
	 * and the audit row all commit together or not at all (a failed accept never
	 * leaves an orphan account behind). The caller issues the session from the
	 * returned identity — the plaintext password is never replayed into login.
	 */
	public async registerAndAcceptTeamInvite(input: OrganizationTeamInviteRegisterAcceptInput): Promise<RegisteredTeamInviteAcceptance> {
		const invite = await this.findValidTeamInvite(input.token);
		const { organizationId, organizationSlug } = this.requireInviteOrganization(invite);

		const existingUser = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.invitation.check_registration_account",
				reason: "Check invitee account before team invite registration",
				actorUserId: null,
			},
			async (tx) => tx.user.findUnique({ where: { email: invite.email }, select: { id: true } }),
		);
		if (existingUser !== null) {
			throw this.accountExistsError();
		}

		const passwordHash = await this.cryptoService.hash(input.password);
		const policyVersion = await this.cedar.getActivePolicyVersion(organizationId);

		const userId = await withUniqueViolationAs(
			async () =>
				this.tenantTx.withSystemOperation(
					{
						operation: "organization.invitation.register_and_accept",
						reason: "Create the invitee account and accept the team invitation",
						actorUserId: null,
					},
					async (tx) => {
						const user = await this.userProvisioning.createConsumerAccountInTx(tx, {
							email: invite.email,
							passwordHash,
							fullName: input.fullName,
						});
						await this.acceptInviteInTx(tx, user.id, invite, organizationId, policyVersion);
						return user.id;
					},
				),
			// The only unique key a brand-new account can hit is its email: a
			// concurrent registration for the same address won.
			(cause) => this.accountExistsError(cause),
		);

		await this.emailVerificationService.sendVerificationEmailIfUnverified(invite.email, "merchant");

		return { organizationSlug, message: "Invitation accepted", userId, email: invite.email };
	}

	public async acceptTeamInvite(userId: string, userEmail: string, token: string): Promise<OrganizationTeamInviteAcceptResponse> {
		const invite = await this.findValidTeamInvite(token);

		if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
			throw new AuthorizationError({
				code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.inviteEmailMismatch,
				message: "Sign in with the invited email address to accept this invitation",
			});
		}

		const { organizationId, organizationSlug } = this.requireInviteOrganization(invite);
		const policyVersion = await this.cedar.getActivePolicyVersion(organizationId);

		await withUniqueViolationAs(
			async () =>
				this.tenantTx.withSystemOperation(
					{
						operation: "organization.membership.accept",
						reason: "Accept team member invitation",
						actorUserId: userId,
					},
					async (tx) => this.acceptInviteInTx(tx, userId, invite, organizationId, policyVersion),
				),
			(cause) => this.alreadyMemberError("You are already a member of this organization", cause),
		);

		return {
			organizationSlug,
			message: "Invitation accepted",
		};
	}

	/**
	 * Claim the invite (compare-and-set PENDING → ACCEPTED: unexpired, not
	 * revoked, not already accepted), then create the membership with the
	 * invite's scope and audit — all on the caller's transaction.
	 */
	private async acceptInviteInTx(tx: SystemOperationTransaction, userId: string, invite: TeamInviteRow, organizationId: string, policyVersion: number): Promise<void> {
		if (!(await this.inviteRepository.acceptPendingTeamInviteInTx(tx, invite.id, userId, Date.now()))) {
			throw this.inviteNoLongerPendingError();
		}

		const existingMembership = await tx.organizationMembership.findFirst({
			where: { organizationId, userId, isDeleted: false },
			select: { id: true },
		});
		if (existingMembership !== null) {
			throw this.alreadyMemberError("You are already a member of this organization");
		}

		const locationIds = invite.locationScopes.map((scope) => scope.locationId);
		const membership = await tx.organizationMembership.create({
			data: {
				organizationId,
				userId,
				role: invite.intendedRole,
				locationScopes: {
					create: [...buildMembershipLocationScopeRows(organizationId, invite.locationScopeType, locationIds)],
				},
			},
		});

		await this.audit.recordInTx(tx, {
			organizationId,
			actorUserId: userId,
			policyVersion,
			action: "membership.invite_accepted",
			resourceType: "OrganizationInvitation",
			resourceId: invite.id,
			metadata: { membershipId: membership.id, role: invite.intendedRole, locationScopeType: invite.locationScopeType },
		});
	}

	private requireInviteOrganization(invite: TeamInviteRow): { readonly organizationId: string; readonly organizationSlug: string } {
		if (invite.organizationId === null || invite.organization === null) {
			throw new NotFoundError();
		}
		return { organizationId: invite.organizationId, organizationSlug: invite.organization.slug };
	}

	private async findValidTeamInvite(token: string): Promise<TeamInviteRow> {
		const tokenHash = sha256Hex(token);
		const invite = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.invitation.resolve_token",
				reason: "Resolve team invite by token",
				actorUserId: null,
			},
			async (tx) => this.inviteRepository.findTeamInviteByTokenHashInTx(tx, tokenHash),
		);
		if (invite === null) {
			throw new NotFoundException("This invitation link is invalid, expired, or has already been used");
		}

		if (Number(invite.expiresAt) < Date.now()) {
			throw new BadRequestException("Invitation has expired");
		}

		return invite;
	}

	private mapTeamInviteResponse(row: TeamInviteRow): OrganizationMemberInviteResponse {
		if (row.organizationId === null) {
			throw new Error("Team invite missing organizationId");
		}

		return {
			id: row.id,
			organizationId: row.organizationId,
			email: row.email,
			intendedRole: row.intendedRole,
			locationScopeType: row.locationScopeType,
			locationIds: row.locationScopes.map((scope) => scope.locationId),
			status: row.status,
			invitedByUserId: row.createdByAdmin.id,
			invitedByName: row.createdByAdmin.fullName,
			expiresAt: epochMs(Number(row.expiresAt)),
			createdAt: epochMs(Number(row.createdAt)),
		};
	}

	/**
	 * A manager scoped to SELECTED stores may only grant SELECTED access to
	 * stores they hold themselves — never ALL_LOCATIONS, never a store outside
	 * their own scope.
	 */
	private assertScopeWithinActor(actor: OrganizationTeamActor, granted: GrantedLocationScope): void {
		if (actor.locationScopeType === "ALL_LOCATIONS") {
			return;
		}
		const outsideActorScope = granted.locationScopeType === "ALL_LOCATIONS" || granted.locationIds.some((locationId) => !actor.locationIds.includes(locationId));
		if (outsideActorScope) {
			throw new AuthorizationError({
				code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.scopeEscalation,
				message: "You can only grant access to stores within your own location scope",
			});
		}
	}

	/** Every id must be a live, ACTIVE store of the organization (read in the writing transaction). */
	private async requireActiveLocationIdsInTx(
		tx: Pick<SystemOperationTransaction, "organizationLocation">,
		organizationId: string,
		locationIds: readonly string[],
	): Promise<void> {
		const activeCount = await tx.organizationLocation.count({
			where: { organizationId, isDeleted: false, status: "ACTIVE", id: { in: [...locationIds] } },
		});
		if (activeCount !== locationIds.length) {
			throw this.invalidLocationsError();
		}
	}

	private async assertActiveLocationIds(organizationId: string, locationIds: readonly string[], actorUserId: string): Promise<void> {
		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.invitation.validate_location_scope",
				reason: "Validate team invite location scope",
				actorUserId,
			},
			async (tx) => this.requireActiveLocationIdsInTx(tx, organizationId, locationIds),
		);
	}

	private async resolveLocationSummary(
		organizationId: string,
		locationScopeType: OrganizationMemberInviteInput["locationScopeType"],
		locationIds: readonly string[],
		actorUserId: string,
	): Promise<string> {
		if (locationScopeType === "ALL_LOCATIONS") {
			return "All locations";
		}

		const rows = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.invitation.resolve_location_labels",
				reason: "Resolve team invite location labels",
				actorUserId,
			},
			async (tx) =>
				tx.organizationLocation.findMany({
					where: {
						organizationId,
						isDeleted: false,
						status: "ACTIVE",
						id: { in: [...locationIds] },
					},
					select: { name: true },
					orderBy: { name: "asc" },
				}),
		);

		if (rows.length === 0) {
			return "Selected locations";
		}

		return rows.map((row) => row.name).join(", ");
	}

	private buildTeamInviteUrl(token: string): string {
		const base = this.config.merchantAppUrl.replace(/\/+$/, "");
		const params = new URLSearchParams({ token });
		return `${base}${APP_LINKS.merchant.teamInvite}?${params.toString()}`;
	}

	/** Team roster, invites, revocations and access-request reviews need `merchant:manage_team` (role table → tenant Cedar policy). */
	private async requireManageTeam(actor: OrganizationTeamActor): Promise<void> {
		await this.organizationRewardAuth.requireMembershipCapability(
			{ userId: actor.userId, organizationId: actor.organizationId, role: actor.role },
			MERCHANT_CAPABILITY.manageTeam,
		);
	}

	private alreadyMemberError(message: string, cause?: Error): ConflictError {
		return new ConflictError({ code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.alreadyMember, message, ...(cause === undefined ? {} : { cause }) });
	}

	private accessRequestPendingError(cause?: Error): ConflictError {
		return new ConflictError({
			code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.accessRequestPending,
			message: "Access request already pending",
			...(cause === undefined ? {} : { cause }),
		});
	}

	private invitePendingError(cause?: Error): ConflictError {
		return new ConflictError({
			code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.invitePending,
			message: "A pending invitation already exists for this email",
			...(cause === undefined ? {} : { cause }),
		});
	}

	private inviteNoLongerPendingError(): ConflictError {
		return new ConflictError({
			code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.inviteNoLongerPending,
			message: "This invitation is no longer valid — it was already used, revoked, or has expired",
		});
	}

	private accountExistsError(cause?: Error): ConflictError {
		return new ConflictError({
			code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.accountExists,
			message: "An account already exists for this email. Sign in to accept the invitation.",
			...(cause === undefined ? {} : { cause }),
		});
	}

	private invalidLocationsError(): ValidationError {
		return new ValidationError({
			code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.invalidLocations,
			message: "One or more selected stores are invalid or not yet approved",
		});
	}
}
