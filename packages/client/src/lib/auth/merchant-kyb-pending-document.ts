import type { DocumentMimeType } from "@workspace/shared";
import { MERCHANT_KYB_UPLOAD_POLICY } from "@workspace/shared";

import { validatePendingFile, type PendingFileUpload } from "../storage/pending-file";

export type MerchantKybPendingDocument = PendingFileUpload & {
	readonly mimeType: DocumentMimeType;
};

export function validateMerchantKybFile(file: File): MerchantKybPendingDocument {
	return validatePendingFile(file, MERCHANT_KYB_UPLOAD_POLICY);
}
