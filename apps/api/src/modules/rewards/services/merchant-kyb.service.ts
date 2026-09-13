import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Organization, OrganizationMerchantProfile, PrismaClient } from "@prisma/client";
import { JsonObjectSchema, buildMerchantSubmittedKybFields, type JsonObject, type MerchantKybProfileResponse, type MerchantKybSubmissionFieldsInput } from "@workspace/shared";

import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { MerchantContextService } from "./merchant-context.service";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { MerchantKybDocumentService } from "./merchant-kyb-document.service";
import { mapLifecycleToMerchantStatus } from "../utils/reward-mapper.util";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

@Injectable()
export class MerchantKybService {
	public constructor(
		private readonly merchantContext: MerchantContextService,
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
		private readonly tenantTx: TenantTransactionService,
		private readonly kybDocumentService: MerchantKybDocumentService,
		private readonly auditLogRepository: RewardAuditLogRepository,
	) {}

	public async getProfile(userId: string, orgSlug: string): Promise<MerchantKybProfileResponse> {
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);

		return this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId: resolved.organizationId,
				purpose: "merchant.kyb.read",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => this.loadProfileFromTransaction(tx, resolved.organizationId),
		);
	}

	public async submitKyb(userId: string, orgSlug: string, input: MerchantKybSubmissionFieldsInput): Promise<MerchantKybProfileResponse> {
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);
		await this.merchantContext.requireOwnerRole(userId, resolved.organizationId, orgSlug);

		return this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId: resolved.organizationId,
				purpose: "merchant.kyb.submit",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => {
				const org = await tx.organization.findUnique({
					where: { id: resolved.organizationId },
					include: { merchantProfile: true },
				});

				if (org?.merchantProfile == null) {
					throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
				}

				if (org.merchantProfile.kybStatus === "APPROVED") {
					throw new BadRequestException("Business verification is already approved");
				}

				const kybFields: JsonObject = JsonObjectSchema.parse(buildMerchantSubmittedKybFields(input));
				const now = BigInt(Date.now());

				await tx.organizationMerchantProfile.update({
					where: { organizationId: resolved.organizationId },
					data: {
						legalName: input.legalName.trim(),
						addressText: input.addressText.trim(),
						contactPhone: input.contactPhone.trim(),
						kybFields,
						kybStatus: "PENDING",
						updatedAt: now,
					},
				});

				await this.kybDocumentService.attachSubmittedFileIds(resolved.organizationId, input.documentFileIds);

				await this.auditLogRepository.create({
					organizationId: resolved.organizationId,
					action: "merchant.kyb_submitted",
					metadata: { userId, previousStatus: org.merchantProfile.kybStatus },
				});

				return this.loadProfileFromTransaction(tx, resolved.organizationId);
			},
		);
	}

	private async loadProfileFromTransaction(tx: TransactionClient, organizationId: string): Promise<MerchantKybProfileResponse> {
		const org = await tx.organization.findUnique({
			where: { id: organizationId },
			include: { merchantProfile: true },
		});

		if (org?.merchantProfile == null) {
			throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
		}

		return this.mapProfile(org, org.merchantProfile);
	}

	private async mapProfile(org: Organization, profile: OrganizationMerchantProfile): Promise<MerchantKybProfileResponse> {
		const parsedKybFieldsResult = profile.kybFields === null ? null : JsonObjectSchema.safeParse(profile.kybFields);
		const parsedKybFields = parsedKybFieldsResult === null ? null : parsedKybFieldsResult.success ? parsedKybFieldsResult.data : null;
		const documents = await this.kybDocumentService.mapDocumentRecordsFromOrg(org.id);

		return {
			organizationId: org.id,
			businessName: org.displayName,
			legalName: profile.legalName,
			addressText: profile.addressText,
			contactPhone: profile.contactPhone,
			contactEmail: profile.contactEmail,
			city: profile.city,
			kybStatus: profile.kybStatus,
			kybFields: parsedKybFields,
			documents,
			status: mapLifecycleToMerchantStatus(org.lifecycleState),
		};
	}
}
