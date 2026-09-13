import {
	MerchantKybProfileResponseSchema,
	MerchantOnboardingCompleteResponseSchema,
	type MerchantKybSubmissionFieldsInput,
	type MerchantKybSubmissionFormInput,
	type MerchantKybProfileResponse,
	type MerchantOnboardingCompleteFieldsInput,
	type MerchantOnboardingCompleteResponse,
} from "@workspace/shared";

import type { ApiClient } from "../../api/use-api";
import type { ApiRouter } from "../../api/endpoints";
import { calculateFileSha256Hex, uploadFileDirect, uploadFileWithTicket, toDocumentMimeType } from "../../storage/direct-upload";
import { buildVersionedApiUrl, multipartMutationHeaders, parseApiEnvelope } from "../../storage/multipart";
import type { MerchantKybPendingDocument } from "./pending-document";

async function uploadKybDocuments(api: ApiClient<ApiRouter>, organizationId: string, documents: readonly MerchantKybPendingDocument[]): Promise<string[]> {
	const fileIds: string[] = [];
	for (const document of documents) {
		const result = await uploadFileDirect(
			api,
			{
				category: "MERCHANT_KYB",
				fileName: document.fileName,
				mimeType: toDocumentMimeType(document.file),
				organizationId,
			},
			document.file,
		);
		fileIds.push(result.fileId);
	}
	return fileIds;
}

export async function submitMerchantOnboardingComplete(baseUrl: string, fields: MerchantOnboardingCompleteFieldsInput): Promise<MerchantOnboardingCompleteResponse> {
	const response = await fetch(buildVersionedApiUrl(baseUrl, "/orgs/onboarding/complete"), {
		method: "POST",
		body: JSON.stringify(fields),
		credentials: "include",
		headers: multipartMutationHeaders({ "Content-Type": "application/json" }),
	});
	return parseApiEnvelope(response, MerchantOnboardingCompleteResponseSchema);
}

export async function submitMerchantOnboardingDocuments(api: ApiClient<ApiRouter>, token: string, documents: readonly MerchantKybPendingDocument[]): Promise<void> {
	const fileIds: string[] = [];
	for (const document of documents) {
		const checksumSha256 = await calculateFileSha256Hex(document.file);
		const ticketEnvelope = await api.organizations.onboarding.documentUploadUrl.mutate({
			token,
			fileName: document.fileName,
			mimeType: toDocumentMimeType(document.file),
			sizeBytes: document.sizeBytes,
			checksumSha256,
		});
		await uploadFileWithTicket(ticketEnvelope.data, document.file);
		await api.organizations.onboarding.documentUploadComplete.mutate({
			token,
			fileId: ticketEnvelope.data.fileId,
			checksumSha256,
		});
		fileIds.push(ticketEnvelope.data.fileId);
	}
	await api.organizations.onboarding.documentsSubmit.mutate({ token, documentFileIds: fileIds });
}

export async function submitMerchantKyb(
	api: ApiClient<ApiRouter>,
	orgSlug: string,
	fields: MerchantKybSubmissionFormInput,
	documents: readonly MerchantKybPendingDocument[],
	organizationId: string,
): Promise<MerchantKybProfileResponse> {
	const uploadedIds = await uploadKybDocuments(api, organizationId, documents);
	const submission: MerchantKybSubmissionFieldsInput = { ...fields, documentFileIds: uploadedIds };
	const response = await api.organizations.kyb.submit.mutate({ orgSlug, ...submission });
	return MerchantKybProfileResponseSchema.parse(response.data);
}
