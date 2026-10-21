import { type CreateFileUploadUrlResponse, type FileUploadRequest, newRowId, parseFileUploadRequest } from "@workspace/shared";

import { StoredFileAggregate } from "../../../domain/aggregates/stored-file.aggregate";
import { assertAvatarIsUploadersOwn, assertUploadWithinCategoryPolicy, resolveUploadOwnerId } from "../../../domain/policies/file-upload.policy";
import type { FileObjectStoragePort } from "../../ports/file-object-storage.port";

/**
 * The upload request itself, shared by the command handler and the
 * published `StoredFileAccess` (which persists through its caller's
 * existing session instead of a unit of work).
 */
export async function requestFileUpload(
	storage: FileObjectStoragePort,
	uploaderId: string,
	input: FileUploadRequest,
	persist: (file: StoredFileAggregate) => Promise<void>,
): Promise<CreateFileUploadUrlResponse> {
	const parsed = parseFileUploadRequest(input);
	assertAvatarIsUploadersOwn(uploaderId, parsed);
	const policy = assertUploadWithinCategoryPolicy(parsed);
	const fileId = newRowId();
	const locator = storage.stagingLocator(parsed, fileId, resolveUploadOwnerId(parsed));
	await persist(
		StoredFileAggregate.request({
			id: fileId,
			category: parsed.category,
			visibility: policy.visibility,
			uploadedById: uploaderId,
			tenantId: parsed.tenantId ?? null,
			productId: parsed.category === "PRODUCT_IMAGE" ? (parsed.productId ?? null) : null,
			expectedChecksum: parsed.checksumSha256,
			original: { slot: "ORIGINAL", locator, publicPath: null },
			upload: { originalName: parsed.fileName, mimeType: parsed.mimeType, sizeBytes: parsed.sizeBytes, expectedChecksum: parsed.checksumSha256 },
		}),
	);
	return storage.issueUploadTicket({ fileId, uploadedById: uploaderId, locator, input: parsed, maxBytes: policy.maxBytes });
}
