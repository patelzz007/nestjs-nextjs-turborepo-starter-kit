import { createHash, randomBytes } from "node:crypto";

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { OrganizationMembershipRole } from "@prisma/client";
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
} from "@workspace/shared";

import { CryptoService } from "../../auth/services/crypto.service";
import { EmailVerificationService } from "../../auth/services/email-verification.service";
import { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../logs/logs.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { TeamMemberInviteEmailTemplate } from "../../notifications/email/templates/team-member-invite-email.template";
import { OrganizationInviteRepository, type TeamInviteRow } from "../repositories/organization-invite.repository";
import { buildMembershipLocationScopeRows } from "../utils/organization-membership-location-scope.util";
import { mapMembershipToRosterResponse } from "../utils/organization-membership-mapper.util";
import { OrganizationAuditService } from "./organization-audit.service";

const INVITE_TTL_DAYS = 7;
const TEAM_MANAGER_ROLES: readonly OrganizationMembershipRole[] = ["OWNER", "ADMIN"];

const ROLE_LABELS: Readonly<Record<OrganizationMembershipRole, string>> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MEMBER: "Member",
	POLICY_ADMIN: "Policy admin",
	CASHIER: "Cashier",
};

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
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
	) {}

	public async createAccessRequest(userId: string, organizationId: string, input: OrganizationAccessRequestCreateInput): Promise<OrganizationAccessRequestResponse> {
		return this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "User access request",
				correlationId: `access-request:${organizationId}:${userId}`,
				actorUserId: userId,
			},
			async (tx) => {
				const existing = await tx.organizationMembership.findFirst({
					where: { organizationId, userId, isDeleted: false },
				});
				if (existing !== null) {
					throw new BadRequestException("Already a member");
				}
				const pending = await tx.organizationAccessRequest.findFirst({
					where: { organizationId, userId, status: "PENDING" },
				});
				if (pending !== null) {
					throw new BadRequestException("Access request already pending");
				}
				const request = await tx.organizationAccessRequest.create({
					data: {
						organizationId,
						userId,
						message: input.message ?? null,
					},
				});
				await this.audit.record({
					organizationId,
					actorUserId: userId,
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
		);
	}

	public async reviewAccessRequest(reviewerId: string, organizationId: string, requestId: string, input: ReviewOrganizationAccessRequestInput): Promise<void> {
		await this.tenantTx.withTenantTransaction(
			{
				userId: reviewerId,
				organizationId,
				purpose: "membership.review_access_request",
				policyVersion: 0,
			},
			async (tx) => {
				const request = await tx.organizationAccessRequest.findFirst({
					where: { id: requestId, organizationId, status: "PENDING" },
				});
				if (request === null) {
					throw new NotFoundException();
				}
				if (input.approve) {
					const role = input.role ?? "MEMBER";
					const scopeType = input.locationScopeType ?? "ALL_LOCATIONS";
					const locationScopeRows = buildMembershipLocationScopeRows(organizationId, scopeType, input.locationIds);

					await tx.organizationMembership.create({
						data: {
							organizationId,
							userId: request.userId,
							role,
							locationScopes: {
								create: [...locationScopeRows],
							},
						},
					});
					await tx.organizationAccessRequest.update({
						where: { id: requestId },
						data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: BigInt(Date.now()) },
					});
				} else {
					await tx.organizationAccessRequest.update({
						where: { id: requestId },
						data: { status: "REJECTED", reviewedById: reviewerId, reviewedAt: BigInt(Date.now()) },
					});
				}
			},
		);
	}

	public async inviteMember(
		inviterId: string,
		inviterRole: OrganizationMembershipRole,
		organizationId: string,
		organizationDisplayName: string,
		input: OrganizationMemberInviteInput,
	): Promise<OrganizationMemberInviteCreatedResponse> {
		this.assertCanManageTeam(inviterRole);

		const existingMembership = await this.tenantTx.withSystemOperation(
			{
				operation: "auth.pre_login",
				reason: "Check invitee membership before team invite",
				correlationId: `team-invite-check:${organizationId}:${input.email}`,
				actorUserId: inviterId,
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
			throw new BadRequestException("User is already a member of this organization");
		}

		if (input.locationScopeType === "SELECTED") {
			await this.assertActiveLocationIds(organizationId, input.locationIds, inviterId);
		}

		const rawToken = randomBytes(32).toString("hex");
		const tokenHash = sha256Hex(rawToken);
		const expiresAt = Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

		const invite = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.membership.invite",
				reason: "Create team member invitation",
				correlationId: `team-invite:${organizationId}:${input.email}`,
				actorUserId: inviterId,
			},
			async (tx) => {
				const pendingInvite = await this.inviteRepository.findPendingTeamInviteByEmailInTx(tx, organizationId, input.email);
				if (pendingInvite !== null) {
					throw new BadRequestException("A pending invitation already exists for this email");
				}

				return this.inviteRepository.createTeamInviteInTx(tx, {
					email: input.email,
					tokenHash,
					organizationId,
					invitedByUserId: inviterId,
					intendedRole: input.role,
					locationScopeType: input.locationScopeType,
					locationIds: input.locationScopeType === "SELECTED" ? input.locationIds : [],
					expiresAt,
				});
			},
		);

		const inviteUrl = this.buildTeamInviteUrl(rawToken);
		const locationSummary = await this.resolveLocationSummary(organizationId, input.locationScopeType, input.locationIds, inviterId);

		const sendResult = await this.emailSender.send(
			new TeamMemberInviteEmailTemplate({
				to: input.email,
				organizationName: organizationDisplayName,
				roleLabel: ROLE_LABELS[input.role],
				locationSummary,
				inviteUrl,
				expiresInDays: INVITE_TTL_DAYS,
			}),
		);

		if (!sendResult.ok) {
			this.logService.warn("Team member invite email failed", {
				context: "OrganizationMembershipService",
				metadata: {
					inviteId: invite.id,
					email: input.email,
					reason: sendResult.reason,
					...(sendResult.detail !== undefined ? { detail: sendResult.detail } : {}),
				},
			});
		}

		if (process.env.NODE_ENV !== "production") {
			// eslint-disable-next-line no-console -- dev visibility when EMAIL_MODE=log-only
			console.info(`[team-member-invite] email=${input.email} url=${inviteUrl}`);
		}

		await this.audit.record({
			organizationId,
			actorUserId: inviterId,
			action: "membership.invite_sent",
			resourceType: "OrganizationInvitation",
			resourceId: invite.id,
			metadata: { role: input.role, email: input.email },
		});

		return {
			inviteId: invite.id,
			message: "Invitation sent",
		};
	}

	public async listMembers(actorId: string, actorRole: OrganizationMembershipRole, organizationId: string): Promise<OrganizationMemberRosterResponse[]> {
		this.assertCanManageTeam(actorRole);

		const rows = await this.tenantTx.withTenantTransaction(
			{
				userId: actorId,
				organizationId,
				purpose: "membership.list",
				policyVersion: 0,
			},
			async (tx) =>
				tx.organizationMembership.findMany({
					where: { organizationId, isDeleted: false },
					include: {
						user: { select: { email: true, fullName: true } },
						locationScopes: true,
					},
					orderBy: [{ role: "asc" }, { createdAt: "asc" }],
				}),
		);

		return rows.map((row) => mapMembershipToRosterResponse(row));
	}

	public async listPendingInvites(actorId: string, actorRole: OrganizationMembershipRole, organizationId: string): Promise<OrganizationMemberInviteResponse[]> {
		this.assertCanManageTeam(actorRole);

		const rows = await this.tenantTx.withTenantTransaction(
			{
				userId: actorId,
				organizationId,
				purpose: "membership.list_invites",
				policyVersion: 0,
			},
			async (tx) => this.inviteRepository.listPendingTeamInvitesInTx(tx, organizationId),
		);
		return rows.map((row) => this.mapTeamInviteResponse(row));
	}

	public async revokeInvite(actorId: string, actorRole: OrganizationMembershipRole, organizationId: string, inviteId: string): Promise<void> {
		this.assertCanManageTeam(actorRole);

		const invite = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.membership.invite",
				reason: "Revoke team member invitation",
				correlationId: `team-invite-revoke:${organizationId}:${inviteId}`,
				actorUserId: actorId,
			},
			async (tx) => {
				const pendingInvite = await this.inviteRepository.findPendingTeamInviteInTx(tx, organizationId, inviteId);
				if (pendingInvite === null) {
					throw new NotFoundException();
				}

				await this.inviteRepository.markRevokedInTx(tx, inviteId, Date.now());
				return pendingInvite;
			},
		);

		await this.audit.record({
			organizationId,
			actorUserId: actorId,
			action: "membership.invite_revoked",
			resourceType: "OrganizationInvitation",
			resourceId: inviteId,
			metadata: { email: invite.email },
		});
	}

	public async validateTeamInvite(token: string): Promise<OrganizationTeamInvitePreview> {
		const invite = await this.findValidTeamInvite(token);
		const existingUser = await this.tenantTx.withSystemOperation(
			{
				operation: "auth.pre_login",
				reason: "Check account for team invite preview",
				correlationId: `team-invite-preview:${invite.email}`,
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

	public async registerAndAcceptTeamInvite(input: OrganizationTeamInviteRegisterAcceptInput): Promise<OrganizationTeamInviteAcceptResponse & { readonly email: string }> {
		const invite = await this.findValidTeamInvite(input.token);

		const existingUser = await this.tenantTx.withSystemOperation(
			{
				operation: "auth.pre_login",
				reason: "Check invitee account before team invite registration",
				correlationId: `team-invite-register-check:${invite.email}`,
				actorUserId: null,
			},
			async (tx) => tx.user.findUnique({ where: { email: invite.email }, select: { id: true } }),
		);

		if (existingUser !== null) {
			throw new BadRequestException("An account already exists for this email. Sign in to accept the invitation.");
		}

		const passwordHash = await this.cryptoService.hash(input.password);
		const user = await this.userProvisioning.createConsumerAccount({
			email: invite.email,
			passwordHash,
			fullName: input.fullName,
		});

		await this.emailVerificationService.sendVerificationEmailIfUnverified(invite.email, "merchant");

		const accepted = await this.acceptTeamInviteForUser(user.id, invite.email, invite);
		return { ...accepted, email: invite.email };
	}

	public async acceptTeamInvite(userId: string, userEmail: string, token: string): Promise<OrganizationTeamInviteAcceptResponse> {
		const invite = await this.findValidTeamInvite(token);

		if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
			throw new ForbiddenException({
				message: "Sign in with the invited email address to accept this invitation",
				error: "ORGANIZATION_INVITE_EMAIL_MISMATCH",
			});
		}

		return this.acceptTeamInviteForUser(userId, userEmail, invite);
	}

	private async acceptTeamInviteForUser(userId: string, userEmail: string, invite: TeamInviteRow): Promise<OrganizationTeamInviteAcceptResponse> {
		if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
			throw new ForbiddenException({
				message: "Sign in with the invited email address to accept this invitation",
				error: "ORGANIZATION_INVITE_EMAIL_MISMATCH",
			});
		}

		if (invite.organizationId === null || invite.organization === null) {
			throw new NotFoundException();
		}

		const organizationId = invite.organizationId;
		const locationIds = invite.locationScopes.map((scope) => scope.locationId);

		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.membership.accept",
				reason: "Accept team member invitation",
				correlationId: `team-invite-accept:${invite.id}`,
				actorUserId: userId,
			},
			async (tx) => {
				const existingMembership = await tx.organizationMembership.findFirst({
					where: { organizationId, userId, isDeleted: false },
				});
				if (existingMembership !== null) {
					throw new BadRequestException("You are already a member of this organization");
				}

				const locationScopeRows = buildMembershipLocationScopeRows(organizationId, invite.locationScopeType, locationIds);

				await tx.organizationMembership.create({
					data: {
						organizationId,
						userId,
						role: invite.intendedRole,
						locationScopes: {
							create: [...locationScopeRows],
						},
					},
				});

				await this.inviteRepository.markAcceptedInTx(tx, invite.id, userId, Date.now());
			},
		);

		await this.audit.record({
			organizationId,
			actorUserId: userId,
			action: "membership.invite_accepted",
			resourceType: "OrganizationInvitation",
			resourceId: invite.id,
		});

		return {
			organizationSlug: invite.organization.slug,
			message: "Invitation accepted",
		};
	}

	private async findValidTeamInvite(token: string): Promise<TeamInviteRow> {
		const tokenHash = sha256Hex(token);
		const invite = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.membership.invite",
				reason: "Resolve team invite by token",
				correlationId: `team-invite-token:${tokenHash.slice(0, 16)}`,
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

	private async assertActiveLocationIds(organizationId: string, locationIds: readonly string[], actorUserId: string): Promise<void> {
		const activeLocationIds = await this.tenantTx.withSystemOperation(
			{
				operation: "auth.pre_login",
				reason: "Validate team invite location scope",
				correlationId: `team-invite-locations:${organizationId}`,
				actorUserId,
			},
			async (tx) => {
				const rows = await tx.organizationLocation.findMany({
					where: {
						organizationId,
						isDeleted: false,
						status: "ACTIVE",
						id: { in: [...locationIds] },
					},
					select: { id: true },
				});
				return rows.map((row) => row.id);
			},
		);

		if (activeLocationIds.length !== locationIds.length) {
			throw new BadRequestException("One or more selected stores are invalid or not yet approved");
		}
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
				operation: "auth.pre_login",
				reason: "Resolve team invite location labels",
				correlationId: `team-invite-location-labels:${organizationId}`,
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
		return `${base}/team-invite?${params.toString()}`;
	}

	private assertCanManageTeam(role: OrganizationMembershipRole): void {
		if (!TEAM_MANAGER_ROLES.includes(role)) {
			throw new ForbiddenException({
				message: "Only organization owners and admins can manage team members",
				error: "ORGANIZATION_TEAM_FORBIDDEN",
			});
		}
	}
}
