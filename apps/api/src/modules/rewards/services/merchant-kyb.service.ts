import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { MerchantOrg } from "@prisma/client";
import { JsonObjectSchema, nowEpochMs, type JsonObject, type MerchantKybProfileResponse, type MerchantKybSubmissionInput } from "@workspace/shared";

import { MerchantContextService } from "./merchant-context.service";
import { MerchantOrgRepository } from "../repositories/merchant-org.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";

@Injectable()
export class MerchantKybService {
	public constructor(
		private readonly merchantContext: MerchantContextService,
		private readonly merchantOrgRepository: MerchantOrgRepository,
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

	public async submitKyb(userId: string, requestedOrgId: string | undefined, input: MerchantKybSubmissionInput): Promise<MerchantKybProfileResponse> {
		const merchantOrgId = await this.merchantContext.resolveOrgIdForUser(userId, requestedOrgId);
		await this.merchantContext.requireOwnerRole(userId, merchantOrgId);

		const org = await this.merchantOrgRepository.findById(merchantOrgId);

		if (org === null) {
			throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
		}

		if (org.kybStatus === "APPROVED") {
			throw new BadRequestException("Business verification is already approved");
		}

		const submittedAt = nowEpochMs();
		const kybFields: JsonObject = JsonObjectSchema.parse({
			registrationNo: input.registrationNo.trim(),
			taxId: input.taxId.trim(),
			documentType: input.documentType.trim(),
			submittedAt,
			documents: input.documents.map((document) => ({
				fileName: document.fileName.trim(),
				mimeType: document.mimeType,
				sizeBytes: document.sizeBytes,
				contentBase64: document.contentBase64,
				uploadedAt: submittedAt,
			})),
		});
		const updated = await this.merchantOrgRepository.updateMerchantKybSubmission(merchantOrgId, {
			legalName: input.legalName.trim(),
			addressText: input.addressText.trim(),
			contactPhone: input.contactPhone.trim(),
			kybFields,
			kybStatus: "PENDING",
		});

		await this.auditLogRepository.create({
			merchantOrgId,
			action: "merchant.kyb_submitted",
			metadata: { userId, previousStatus: org.kybStatus },
		});

		return this.mapProfile(updated);
	}

	private mapProfile(org: MerchantOrg): MerchantKybProfileResponse {
		const parsedKybFieldsResult = org.kybFields === null ? null : JsonObjectSchema.safeParse(org.kybFields);
		const parsedKybFields = parsedKybFieldsResult === null ? null : parsedKybFieldsResult.success ? parsedKybFieldsResult.data : null;

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
			status: org.status,
		};
	}
}
