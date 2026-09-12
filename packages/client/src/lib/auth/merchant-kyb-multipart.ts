import {
	MerchantKybProfileResponseSchema,
	MerchantOnboardingCompleteResponseSchema,
	type MerchantKybSubmissionFieldsInput,
	type MerchantKybSubmissionFormInput,
	type MerchantKybProfileResponse,
	type MerchantOnboardingCompleteFieldsInput,
	type MerchantOnboardingCompleteResponse,
} from "@workspace/shared";

import type { ApiClient } from "../api/use-api";
import type { ApiRouter } from "../api/endpoints";
import { uploadFileDirect, toDocumentMimeType } from "../storage/direct-upload";
import { buildVersionedApiUrl, multipartMutationHeaders, parseApiEnvelope } from "../storage/multipart";
import type { MerchantKybPendingDocument } from "./merchant-kyb-pending-document";

async function uploadKybDocuments(api: ApiClient<ApiRouter>, merchantOrgId: string, documents: readonly MerchantKybPendingDocument[]): Promise<string[]> {
	const fileIds: string[] = [];
	for (const document of documents) {
		const result = await uploadFileDirect(
			api,
			{
				category: "MERCHANT_KYB",
				fileName: document.fileName,
				mimeType: toDocumentMimeType(document.file),
				merchantOrgId,
			},
			document.file,
		);
		fileIds.push(result.fileId);
	}
	return fileIds;
}

export async function submitMerchantOnboardingComplete(baseUrl: string, fields: MerchantOnboardingCompleteFieldsInput): Promise<MerchantOnboardingCompleteResponse> {
	const response = await fetch(buildVersionedApiUrl(baseUrl, "/merchant/onboarding/complete"), {
		method: "POST",
		body: JSON.stringify(fields),
		credentials: "include",
		headers: multipartMutationHeaders({ "Content-Type": "application/json" }),
	});
	return parseApiEnvelope(response, MerchantOnboardingCompleteResponseSchema);
}

export async function submitMerchantKyb(
	api: ApiClient<ApiRouter>,
	fields: MerchantKybSubmissionFormInput,
	documents: readonly MerchantKybPendingDocument[],
	merchantOrgId: string,
): Promise<MerchantKybProfileResponse> {
	const uploadedIds = await uploadKybDocuments(api, merchantOrgId, documents);
	const submission: MerchantKybSubmissionFieldsInput = { ...fields, documentFileIds: uploadedIds };
	const response = await api.merchant.kyb.submit.mutate(submission);
	return MerchantKybProfileResponseSchema.parse(response.data);
}
