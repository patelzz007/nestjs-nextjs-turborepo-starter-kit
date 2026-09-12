import type { DocumentMimeType, KybDocumentScanStatus, MerchantKybDocumentRecord, MerchantKybProfileResponse } from "@workspace/shared";
import { JsonPrimitiveSchema } from "@workspace/shared";

export function readProfileKybDocuments(profile: MerchantKybProfileResponse): MerchantKybDocumentRecord[] {
	return profile.documents;
}

export function hasSubmittedMerchantKyb(profile: MerchantKybProfileResponse): boolean {
	if (profile.kybFields === null) {
		return false;
	}

	const submittedAt = JsonPrimitiveSchema.safeParse(profile.kybFields.submittedAt);
	return submittedAt.success && submittedAt.data !== null;
}

export function formatKybDocumentSize(sizeBytes: number): string {
	if (sizeBytes < 1024) {
		return `${String(sizeBytes)} B`;
	}
	if (sizeBytes < 1024 * 1024) {
		return `${String(Math.round(sizeBytes / 1024))} KB`;
	}
	return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PREVIEWABLE_KYB_DOCUMENT_MIME_TYPES: readonly DocumentMimeType[] = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/avif"];

export function isKybDocumentPreviewable(mimeType: DocumentMimeType): boolean {
	return PREVIEWABLE_KYB_DOCUMENT_MIME_TYPES.includes(mimeType);
}

/** Navigate to a signed object URL in a new tab (view source). */
export function openExternalDocument(url: string): void {
	window.open(url, "_blank", "noopener,noreferrer");
}

/** Trigger a local download using a presigned URL with Content-Disposition: attachment. */
export function triggerBrowserDownload(url: string, fileName: string): void {
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	anchor.rel = "noopener noreferrer";
	anchor.click();
}

export function formatKybScanStatus(status: KybDocumentScanStatus): string {
	if (status === "SCANNING") {
		return "Scanning";
	}
	if (status === "INFECTED") {
		return "Action required";
	}
	return "Ready";
}
