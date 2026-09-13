import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
	epochMs,
	type OrganizationAccessRequestCreateInput,
	type OrganizationAccessRequestResponse,
	type OrganizationMemberInviteInput,
	type ReviewOrganizationAccessRequestInput,
} from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { OrganizationAuditService } from "./organization-audit.service";

@Injectable()
export class OrganizationMembershipService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: OrganizationAuditService,
	) {}

	public async createAccessRequest(
		userId: string,
		organizationId: string,
		input: OrganizationAccessRequestCreateInput,
	): Promise<OrganizationAccessRequestResponse> {
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

	public async reviewAccessRequest(
		reviewerId: string,
		organizationId: string,
		requestId: string,
		input: ReviewOrganizationAccessRequestInput,
	): Promise<void> {
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
					await tx.organizationMembership.create({
						data: {
							organizationId,
							userId: request.userId,
							role,
							locationScopes: {
								create: {
									organizationId,
									scopeType,
									locationId: scopeType === "SELECTED" ? (input.locationScopeType ? null : null) : null,
								},
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
		organizationId: string,
		input: OrganizationMemberInviteInput,
	): Promise<void> {
		await this.tenantTx.withTenantTransaction(
			{
				userId: inviterId,
				organizationId,
				purpose: "membership.invite",
				policyVersion: 0,
			},
			async (tx) => {
				const user = await tx.user.findUnique({ where: { email: input.email } });
				if (user === null) {
					throw new BadRequestException("User must sign up before invite can be accepted");
				}
				await tx.organizationMembership.create({
					data: {
						organizationId,
						userId: user.id,
						role: input.role,
						locationScopes: {
							create: {
								organizationId,
								scopeType: input.locationScopeType,
								locationId: null,
							},
						},
					},
				});
				await this.audit.record({
					organizationId,
					actorUserId: inviterId,
					action: "membership.invited",
					resourceType: "User",
					resourceId: user.id,
					metadata: { role: input.role },
				});
			},
		);
	}
}
