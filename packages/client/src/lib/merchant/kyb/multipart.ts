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
	if (documents.length === 0) {
		return;
	}

	const preparedDocuments = await Promise.all(
		documents.map(async (document) => ({
			document,
			checksumSha256: await calculateFileSha256Hex(document.file),
		})),
	);

	const batchTickets = await api.organizations.onboarding.documentBatchUploadUrl.mutate({
		token,
		files: preparedDocuments.map(({ document, checksumSha256 }) => ({
			fileName: document.fileName,
			mimeType: toDocumentMimeType(document.file),
			sizeBytes: document.sizeBytes,
			checksumSha256,
		})),
	});

	await Promise.all(
		batchTickets.data.uploads.map((ticket, index) => {
			const prepared = preparedDocuments[index];
			if (prepared === undefined) {
				throw new Error("Upload ticket count does not match selected documents.");
			}
			return uploadFileWithTicket(ticket, prepared.document.file);
		}),
	);

	const completed = await api.organizations.onboarding.documentBatchUploadComplete.mutate({
		token,
		completions: batchTickets.data.uploads.map((ticket, index) => {
			const prepared = preparedDocuments[index];
			if (prepared === undefined) {
				throw new Error("Upload completion count does not match selected documents.");
			}
			return {
				fileId: ticket.fileId,
				checksumSha256: prepared.checksumSha256,
			};
		}),
	});

	await api.organizations.onboarding.documentsSubmit.mutate({ token, documentFileIds: completed.data.fileIds });
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
