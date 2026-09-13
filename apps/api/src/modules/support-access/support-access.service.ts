import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { epochMs, type SupportAccessGrantRequestInput, type SupportAccessGrantResponse } from "@workspace/shared";

import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { OrganizationAuditService } from "../organization/services/organization-audit.service";

@Injectable()
export class SupportAccessService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: OrganizationAuditService,
	) {}

	public async requestGrant(supportUserId: string, input: SupportAccessGrantRequestInput): Promise<SupportAccessGrantResponse> {
		const expiresAt = BigInt(Date.now() + input.durationMinutes * 60 * 1000);

		const grant = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: input.reason,
				correlationId: input.ticketRef ?? `support:${input.organizationId}`,
				actorUserId: supportUserId,
			},
			async (tx) => {
				return tx.supportAccessGrant.create({
					data: {
						organizationId: input.organizationId,
						supportUserId,
						mode: input.mode,
						status: "PENDING_TENANT_APPROVAL",
						reason: input.reason,
						ticketRef: input.ticketRef ?? null,
						expiresAt,
					},
				});
			},
		);

		await this.audit.record({
			organizationId: input.organizationId,
			actorUserId: supportUserId,
			action: "support.grant_requested",
			resourceType: "SupportAccessGrant",
			resourceId: grant.id,
			metadata: { mode: input.mode },
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

	public async tenantApprove(grantId: string, approverId: string, organizationId: string): Promise<void> {
		await this.tenantTx.withTenantTransaction(
			{
				userId: approverId,
				organizationId,
				purpose: "support.approve_grant",
				policyVersion: 0,
			},
			async (tx) => {
				const membership = await tx.organizationMembership.findFirst({
					where: { organizationId, userId: approverId, role: "OWNER", status: "ACTIVE" },
				});
				if (membership === null) {
					throw new ForbiddenException("Only organization owners may approve support access");
				}
				const grant = await tx.supportAccessGrant.findFirst({
					where: { id: grantId, organizationId, status: "PENDING_TENANT_APPROVAL" },
				});
				if (grant === null) {
					throw new NotFoundException();
				}
				await tx.supportAccessGrant.update({
					where: { id: grantId },
					data: { status: "ACTIVE", tenantApprovedById: approverId },
				});
			},
		);
	}

	public async revoke(grantId: string, actorId: string): Promise<void> {
		const grant = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "Revoke support access grant",
				correlationId: `revoke:${grantId}`,
				actorUserId: actorId,
			},
			async (tx) => tx.supportAccessGrant.findUnique({ where: { id: grantId } }),
		);
		if (grant === null) {
			throw new NotFoundException();
		}
		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "Revoke support access grant",
				correlationId: `revoke-apply:${grantId}`,
				actorUserId: actorId,
			},
			async (tx) => {
				await tx.supportAccessGrant.update({
					where: { id: grantId },
					data: { status: "REVOKED", revokedAt: BigInt(Date.now()) },
				});
			},
		);
	}

	public async assertActiveReadGrant(supportUserId: string, organizationId: string): Promise<void> {
		const grant = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "Verify support access grant",
				correlationId: `verify:${supportUserId}:${organizationId}`,
				actorUserId: supportUserId,
			},
			async (tx) =>
				tx.supportAccessGrant.findFirst({
					where: {
						supportUserId,
						organizationId,
						status: "ACTIVE",
						expiresAt: { gt: BigInt(Date.now()) },
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
}
