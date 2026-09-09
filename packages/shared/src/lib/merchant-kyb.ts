import { nowEpochMs } from "../schemas/api/common";
import type { MerchantKybSubmissionInput } from "../schemas/domain/rewards";
import { JsonObjectSchema, type JsonObject } from "../schemas/runtime/json";

/** Builds the merchant-submitted KYB payload stored in `merchant_orgs.kyb_fields`. */
export function buildMerchantSubmittedKybFields(input: MerchantKybSubmissionInput): JsonObject {
	const submittedAt = nowEpochMs();

	return JsonObjectSchema.parse({
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
}
