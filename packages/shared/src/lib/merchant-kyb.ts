import { nowEpochMs } from "../schemas/api/common";
import type { MerchantKybSubmissionFieldsInput } from "../schemas/domain/rewards";
import { JsonObjectSchema, type JsonObject } from "../schemas/runtime/json";

/** Builds the merchant-submitted KYB payload stored in `merchant_orgs.kyb_fields` (no document bytes). */
export function buildMerchantSubmittedKybFields(input: MerchantKybSubmissionFieldsInput): JsonObject {
	const submittedAt = nowEpochMs();

	return JsonObjectSchema.parse({
		registrationNo: input.registrationNo.trim(),
		taxId: input.taxId.trim(),
		documentType: input.documentType.trim(),
		submittedAt,
	});
}
