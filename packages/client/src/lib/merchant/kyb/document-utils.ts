import type { DocumentMimeType, KybDocumentScanStatus, MerchantKybDocumentRecord, MerchantKybProfileResponse } from "@workspace/shared";
import { JsonObjectSchema, JsonPrimitiveSchema } from "@workspace/shared";
import type { StatusTone } from "@workspace/ui/components/status-badge";

export function readProfileKybDocuments(profile: MerchantKybProfileResponse): MerchantKybDocumentRecord[] {
	return profile.documents;
}

export function hasSubmittedMerchantKyb(profile: MerchantKybProfileResponse): boolean {
	if (profile.kybFields === null) {
		return false;
	}

	const kybFields = JsonObjectSchema.safeParse(profile.kybFields);
	if (!kybFields.success) {
		return false;
	}

	const submittedAt = JsonPrimitiveSchema.safeParse(kybFields.data.submittedAt);
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

/** How a member sees one malware-scan status of a KYB document. */
export interface KybScanStatusPresentation {
	readonly label: string;
	/** Whether the document may be viewed / downloaded. */
	readonly accessible: boolean;
	/** What the status means: `warning` marks an accessible document the member should know about (it was not malware-checked). */
	readonly tone: StatusTone;
}

/**
 * One entry per scan status — a `Record` over the shared enum, so a new status
 * fails to compile until it is presented here (the single place to change).
 * - NOT_SCANNED: storage has no scanner; the file is READY and usable, but the
 *   member is told it was not malware-checked.
 * - INFECTED / SCAN_FAILED: never served; the member re-uploads.
 */
export const KYB_SCAN_STATUS_PRESENTATION: Readonly<Record<KybDocumentScanStatus, KybScanStatusPresentation>> = {
	SCANNING: { label: "Scanning", accessible: false, tone: "info" },
	CLEAN: { label: "Ready", accessible: true, tone: "success" },
	NOT_SCANNED: { label: "Not malware-checked", accessible: true, tone: "warning" },
	INFECTED: { label: "Action required", accessible: false, tone: "danger" },
	SCAN_FAILED: { label: "Scan failed – re-upload", accessible: false, tone: "danger" },
};

export function formatKybScanStatus(status: KybDocumentScanStatus): string {
	return KYB_SCAN_STATUS_PRESENTATION[status].label;
}

/** Whether a document in this scan status may be viewed or downloaded. */
export function isKybDocumentAccessible(status: KybDocumentScanStatus): boolean {
	return KYB_SCAN_STATUS_PRESENTATION[status].accessible;
}
