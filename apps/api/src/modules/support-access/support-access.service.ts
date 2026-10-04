import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { SupportAccessGrantStatus } from "@prisma/client";
import { epochMs, nowEpochMs, type SupportAccessGrantRequestInput, type SupportAccessGrantResponse } from "@workspace/shared";

import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "../organization/services/organization-audit.service";

/** Milliseconds per minute — converts the requested grant duration to an epoch-ms expiry. */
const MS_PER_MINUTE = 60_000;

/** `organization_audit_logs.resource_type` of support-access audit rows. */
const SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE = "SupportAccessGrant";

/** `organization_audit_logs.action` values of the support-access lifecycle. */
const SupportAccessAuditAction = {
	REQUESTED: "support.grant_requested",
	APPROVED: "support.grant_approved",
	REVOKED: "support.grant_revoked",
} satisfies Record<string, string>;

/** Statuses a grant can still be revoked from; REVOKED / EXPIRED / DENIED are terminal. */
const REVOCABLE_STATUSES: SupportAccessGrantStatus[] = [
	SupportAccessGrantStatus.PENDING_APPROVAL,
	SupportAccessGrantStatus.PENDING_TENANT_APPROVAL,
	SupportAccessGrantStatus.ACTIVE,
];

/**
 * Just-in-time support access to an organization.
 *
 * - A SuperAdmin requests a grant (PENDING_TENANT_APPROVAL).
 * - An active OWNER of the grant's organization approves it. The organization
 *   always comes from the grant record — never from the request.
 * - A SuperAdmin revokes it.
 *
 * Every transition is a compare-and-set on `status` (a revoked or expired
 * grant can never be revived) and commits atomically with its organization
 * audit row, written with the real actor and the organization's active
 * policy version. `support_access_grants` is bypass-write under RLS, so each
 * write runs under its own allowlisted system operation.
 */
@Injectable()
export class SupportAccessService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: OrganizationAuditService,
		private readonly cedar: CedarPolicyEvaluatorService,
	) {}

	public async requestGrant(supportUserId: string, input: SupportAccessGrantRequestInput): Promise<SupportAccessGrantResponse> {
		const policyVersion: number = await this.cedar.getActivePolicyVersion(input.organizationId);
		const expiresAt: number = nowEpochMs() + input.durationMinutes * MS_PER_MINUTE;

		const grant = await this.tenantTx.withSystemOperation({ operation: "support_access.grant", reason: input.reason, actorUserId: supportUserId }, async (tx) => {
			const organization = await tx.organization.findFirst({ where: { id: input.organizationId, isDeleted: false }, select: { id: true } });
			if (organization === null) {
				throw new NotFoundException("Organization not found");
			}

			const created = await tx.supportAccessGrant.create({
				data: {
					organizationId: input.organizationId,
					supportUserId,
					mode: input.mode,
					status: SupportAccessGrantStatus.PENDING_TENANT_APPROVAL,
					reason: input.reason,
					ticketRef: input.ticketRef ?? null,
					expiresAt,
				},
			});
			await this.audit.recordInTx(tx, {
				organizationId: input.organizationId,
				actorUserId: supportUserId,
				policyVersion,
				action: SupportAccessAuditAction.REQUESTED,
				resourceType: SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE,
				resourceId: created.id,
				metadata: { mode: input.mode, ticketRef: input.ticketRef ?? null, expiresAt },
			});
			return created;
		});

		return {
			id: grant.id,
			organizationId: grant.organizationId,
			mode: grant.mode,
			status: grant.status,
			expiresAt: epochMs(Number(grant.expiresAt)),
			createdAt: epochMs(Number(grant.createdAt)),
		};
	}

	/**
	 * An active OWNER of the grant's organization approves a pending grant.
	 * The organization is read from the grant; the owner membership (ACTIVE,
	 * not soft-deleted, on a non-deleted account) and the pending, unexpired
	 * state are re-checked in the transaction that flips the status.
	 */
	public async tenantApprove(grantId: string, approverId: string): Promise<void> {
		const organizationId: string = await this.resolveGrantOrganization(grantId, approverId);
		const policyVersion: number = await this.cedar.getActivePolicyVersion(organizationId);

		await this.tenantTx.withSystemOperation(
			{ operation: "support_access.approve", reason: "Organization owner approves a support access grant", actorUserId: approverId },
			async (tx): Promise<void> => {
				const owner = await tx.organizationMembership.findFirst({
					where: {
						organizationId,
						userId: approverId,
						role: "OWNER",
						status: "ACTIVE",
						isDeleted: false,
						user: { isActive: true, isDeleted: false },
					},
					select: { id: true },
				});
				if (owner === null) {
					throw new ForbiddenException({
						message: "Only an active owner of the organization may approve support access",
						error: "SUPPORT_ACCESS_APPROVER_NOT_OWNER",
					});
				}

				const now: number = nowEpochMs();
				const approved = await tx.supportAccessGrant.updateMany({
					where: {
						id: grantId,
						organizationId,
						status: SupportAccessGrantStatus.PENDING_TENANT_APPROVAL,
						expiresAt: { gt: now },
						supportUserId: { not: approverId },
					},
					data: { status: SupportAccessGrantStatus.ACTIVE, tenantApprovedById: approverId },
				});
				if (approved.count !== 1) {
					throw new ConflictException({
						message: "Support access grant is not pending approval (already decided, revoked, expired, or requested by you)",
						error: "SUPPORT_ACCESS_GRANT_NOT_PENDING",
					});
				}

				await this.audit.recordInTx(tx, {
					organizationId,
					actorUserId: approverId,
					policyVersion,
					action: SupportAccessAuditAction.APPROVED,
					resourceType: SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE,
					resourceId: grantId,
					decision: "Allow",
				});
			},
		);
	}

	/** A SuperAdmin revokes a pending or active grant; a terminal grant is a 409, never revived or re-revoked. */
	public async revoke(grantId: string, actorId: string): Promise<void> {
		const organizationId: string = await this.resolveGrantOrganization(grantId, actorId);
		const policyVersion: number = await this.cedar.getActivePolicyVersion(organizationId);

		await this.tenantTx.withSystemOperation({ operation: "support_access.revoke", reason: "Revoke support access grant", actorUserId: actorId }, async (tx): Promise<void> => {
			const now: number = nowEpochMs();
			const revoked = await tx.supportAccessGrant.updateMany({
				where: { id: grantId, status: { in: REVOCABLE_STATUSES } },
				data: { status: SupportAccessGrantStatus.REVOKED, revokedAt: now },
			});
			if (revoked.count !== 1) {
				throw new ConflictException({
					message: "Support access grant is already revoked, expired, or denied",
					error: "SUPPORT_ACCESS_GRANT_NOT_REVOCABLE",
				});
			}

			await this.audit.recordInTx(tx, {
				organizationId,
				actorUserId: actorId,
				policyVersion,
				action: SupportAccessAuditAction.REVOKED,
				resourceType: SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE,
				resourceId: grantId,
			});
		});
	}

	public async assertActiveReadGrant(supportUserId: string, organizationId: string): Promise<void> {
		const grant = await this.tenantTx.withSystemOperation(
			{
				operation: "support_access.verify",
				reason: "Verify support access grant",
				actorUserId: supportUserId,
			},
			async (tx) =>
				tx.supportAccessGrant.findFirst({
					where: {
						supportUserId,
						organizationId,
						status: SupportAccessGrantStatus.ACTIVE,
						expiresAt: { gt: nowEpochMs() },
					},
				}),
		);
		if (grant === null) {
			throw new ForbiddenException("No active support access grant");
		}
		if (grant.mode !== "READ_ONLY") {
			throw new BadRequestException("Write elevation requires separate approval");
		}
	}

	/** The organization a grant belongs to — read from the grant record (404 when unknown). */
	private async resolveGrantOrganization(grantId: string, actorUserId: string): Promise<string> {
		const grant = await this.tenantTx.withSystemOperation(
			{ operation: "support_access.verify", reason: "Resolve the organization of a support access grant", actorUserId },
			async (tx) => tx.supportAccessGrant.findUnique({ where: { id: grantId }, select: { organizationId: true } }),
		);
		if (grant === null) {
			throw new NotFoundException("Support access grant not found");
		}
		return grant.organizationId;
	}
}
