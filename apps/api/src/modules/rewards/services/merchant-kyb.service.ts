import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { MerchantOrg } from "@prisma/client";
import { JsonObjectSchema, buildMerchantSubmittedKybFields, type JsonObject, type MerchantKybProfileResponse, type MerchantKybSubmissionFieldsInput } from "@workspace/shared";

import { MerchantContextService } from "./merchant-context.service";
import { MerchantOrgRepository } from "../repositories/merchant-org.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { MerchantKybDocumentService } from "./merchant-kyb-document.service";

@Injectable()
export class MerchantKybService {
	public constructor(
		private readonly merchantContext: MerchantContextService,
		private readonly merchantOrgRepository: MerchantOrgRepository,
		private readonly kybDocumentService: MerchantKybDocumentService,
		private readonly auditLogRepository: RewardAuditLogRepository,
	) {}

	public async getProfile(userId: string, requestedOrgId: string | undefined): Promise<MerchantKybProfileResponse> {
		const merchantOrgId = await this.merchantContext.resolveOrgIdForUser(userId, requestedOrgId);
		const org = await this.merchantOrgRepository.findById(merchantOrgId);

		if (org === null) {
			throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
		}

		return this.mapProfile(org);
	}

	public async submitKyb(userId: string, requestedOrgId: string | undefined, input: MerchantKybSubmissionFieldsInput): Promise<MerchantKybProfileResponse> {
		const merchantOrgId = await this.merchantContext.resolveOrgIdForUser(userId, requestedOrgId);
		await this.merchantContext.requireOwnerRole(userId, merchantOrgId);

		const org = await this.merchantOrgRepository.findById(merchantOrgId);

		if (org === null) {
			throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
		}

		if (org.kybStatus === "APPROVED") {
			throw new BadRequestException("Business verification is already approved");
		}

		const kybFields: JsonObject = JsonObjectSchema.parse(buildMerchantSubmittedKybFields(input));
		const updated = await this.merchantOrgRepository.updateMerchantKybSubmission(merchantOrgId, {
			businessName: input.businessName.trim(),
			legalName: input.legalName.trim(),
			addressText: input.addressText.trim(),
			contactPhone: input.contactPhone.trim(),
			kybFields,
			kybStatus: "PENDING",
		});

		await this.kybDocumentService.attachSubmittedFileIds(merchantOrgId, input.documentFileIds);

		await this.auditLogRepository.create({
			merchantOrgId,
			action: "merchant.kyb_submitted",
			metadata: { userId, previousStatus: org.kybStatus },
		});

		return this.mapProfile(updated);
	}

	private async mapProfile(org: MerchantOrg): Promise<MerchantKybProfileResponse> {
		const parsedKybFieldsResult = org.kybFields === null ? null : JsonObjectSchema.safeParse(org.kybFields);
		const parsedKybFields = parsedKybFieldsResult === null ? null : parsedKybFieldsResult.success ? parsedKybFieldsResult.data : null;
		const documents = await this.kybDocumentService.mapDocumentRecordsFromOrg(org.id);

		return {
			merchantOrgId: org.id,
			businessName: org.businessName,
			legalName: org.legalName,
			addressText: org.addressText,
			contactPhone: org.contactPhone,
			contactEmail: org.contactEmail,
			city: org.city,
			kybStatus: org.kybStatus,
			kybFields: parsedKybFields,
			documents,
			status: org.status,
		};
	}
}
