import { type CreateFileUploadUrlResponse, type FileUploadRequest, newRowId, parseFileUploadRequest, type StorageObjectLocator } from "@workspace/shared";

import { StoredFileAggregate } from "../../../domain/aggregates/stored-file.aggregate";
import { assertAvatarIsUploadersOwn, assertUploadWithinCategoryPolicy, resolveUploadOwnerId } from "../../../domain/policies/file-upload.policy";
import type { FileObjectStoragePort } from "../../ports/file-object-storage.port";

/** A checked upload request: the new PENDING file, where its bytes go, and the category's size limit. */
export interface PreparedFileUpload {
	readonly file: StoredFileAggregate;
	readonly input: FileUploadRequest;
	readonly locator: StorageObjectLocator;
	readonly maxBytes: number;
}

/**
 * Every check an upload request gets (the request's shape, avatar ownership, the category's MIME
 * types and size limit) and the new PENDING file with its staging location. Shared by browser
 * uploads ({@link requestFileUpload}) and the server-side ingest (`ServerFileIngest`), so neither
 * has its own copy of the rules.
 */
export function prepareFileUpload(storage: FileObjectStoragePort, uploaderId: string, input: FileUploadRequest): PreparedFileUpload {
	const parsed = parseFileUploadRequest(input);
	assertAvatarIsUploadersOwn(uploaderId, parsed);
	const policy = assertUploadWithinCategoryPolicy(parsed);
	const fileId = newRowId();
	const locator = storage.stagingLocator(parsed, fileId, resolveUploadOwnerId(parsed));
	const file = StoredFileAggregate.request({
		id: fileId,
		category: parsed.category,
		visibility: policy.visibility,
		uploadedById: uploaderId,
		tenantId: parsed.tenantId ?? null,
		productId: parsed.category === "PRODUCT_IMAGE" ? (parsed.productId ?? null) : null,
		expectedChecksum: parsed.checksumSha256,
		original: { slot: "ORIGINAL", locator, publicPath: null },
		upload: { originalName: parsed.fileName, mimeType: parsed.mimeType, sizeBytes: parsed.sizeBytes, expectedChecksum: parsed.checksumSha256 },
	});
	return { file, input: parsed, locator, maxBytes: policy.maxBytes };
}

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
	const prepared = prepareFileUpload(storage, uploaderId, input);
	await persist(prepared.file);
	return storage.issueUploadTicket({ fileId: prepared.file.id, uploadedById: uploaderId, locator: prepared.locator, input: prepared.input, maxBytes: prepared.maxBytes });
}
