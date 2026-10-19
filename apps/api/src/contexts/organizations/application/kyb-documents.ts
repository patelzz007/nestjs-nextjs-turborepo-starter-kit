import { DocumentMimeTypeSchema, type MerchantKybDocumentRecord } from "@workspace/shared";

import { kybDocumentScanStatusOf } from "../domain/policies/kyb-evidence.policy";
import type { KybFileDescriptor } from "./ports/kyb-files.port";

/** A KYB evidence file as merchants and admins see it. */
export function toKybDocumentRecord(file: KybFileDescriptor): MerchantKybDocumentRecord {
	return {
		id: file.id,
		fileName: file.originalName,
		mimeType: DocumentMimeTypeSchema.parse(file.mimeType),
		sizeBytes: file.sizeBytes,
		scanStatus: kybDocumentScanStatusOf(file),
		uploadedAt: file.createdAt,
	};
}

/** Whether `file` is a KYB upload of `organizationId` made by `uploadedById` (the onboarding token's own uploads). */
export function isOwnKybUpload(file: KybFileDescriptor, organizationId: string, uploadedById: string): boolean {
	return file.category === "MERCHANT_KYB" && file.organizationId === organizationId && file.uploadedById === uploadedById;
}
