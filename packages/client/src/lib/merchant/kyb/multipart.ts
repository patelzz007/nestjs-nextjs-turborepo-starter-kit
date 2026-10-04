import {
	MerchantKybProfileResponseSchema,
	type MerchantKybSubmissionFieldsInput,
	type MerchantKybSubmissionFormInput,
	type MerchantKybProfileResponse,
} from "@workspace/shared";

import type { ApiClient } from "../../api/use-api";
import type { ApiRouter } from "../../api/endpoints";
import {
	calculateFileSha256Hex,
	uploadFileDirect,
	uploadFileWithTicket,
	toDocumentMimeType,
	waitForFileReady,
	type DirectUploadResult,
	type FileStatusReader,
} from "../../storage/direct-upload";
import type { MerchantKybPendingDocument } from "./pending-document";

/**
 * Resolves once an uploaded document is READY — immediately when `files/complete`
 * already said so, otherwise through the shared bounded poll. Rejects with a
 * `FileProcessingError` for a QUARANTINED / FAILED document.
 */
export async function awaitUploadedDocumentReady(reader: FileStatusReader, upload: DirectUploadResult, signal: AbortSignal | undefined): Promise<void> {
	if (upload.response.file.status !== "READY") {
		await waitForFileReady(reader, upload.fileId, { signal });
	}
}

/**
 * Uploads each document and waits for its scan verdict (`files/complete`
 * usually answers SCANNING): a document only counts as uploaded once it is
 * READY; a QUARANTINED / FAILED one rejects with a `FileProcessingError`.
 * `signal` cancels the wait (the form unmounted).
 */
async function uploadKybDocuments(
	api: ApiClient<ApiRouter>,
	organizationId: string,
	documents: readonly MerchantKybPendingDocument[],
	signal: AbortSignal | undefined,
): Promise<string[]> {
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
		await awaitUploadedDocumentReady(api, result, signal);
		fileIds.push(result.fileId);
	}
	return fileIds;
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
	signal?: AbortSignal,
): Promise<MerchantKybProfileResponse> {
	const uploadedIds = await uploadKybDocuments(api, organizationId, documents, signal);
	const submission: MerchantKybSubmissionFieldsInput = { ...fields, documentFileIds: uploadedIds };
	const response = await api.organizations.kyb.submit.mutate({ orgSlug, ...submission });
	return MerchantKybProfileResponseSchema.parse(response.data);
}
