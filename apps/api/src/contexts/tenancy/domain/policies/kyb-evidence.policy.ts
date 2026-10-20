import type { FileCategory, FileStatus, KybDocumentScanStatus } from "@workspace/shared";

/** The facts about a stored file that KYB review needs (owned by the files context, read through a port). */
export interface KybEvidenceFile {
	readonly id: string;
	readonly category: FileCategory;
	readonly tenantId: string | null;
	readonly uploadedById: string;
	readonly status: FileStatus;
	/** The scanner's verdict column; `null` until a scan ran. */
	readonly scanStatus: "SCANNING" | "CLEAN" | "INFECTED" | "NOT_SCANNED" | null;
}

/** File states a document may be submitted in: verified bytes, verdict pending or clean. Never PENDING, QUARANTINED, FAILED or DELETED. */
const SUBMITTABLE_FILE_STATUSES: readonly FileStatus[] = ["SCANNING", "PROCESSING", "READY"];

/** The scan state a KYB document shows to merchants and admins (honest: a failed scan is not an infection). */
export function kybDocumentScanStatusOf(file: Pick<KybEvidenceFile, "status" | "scanStatus">): KybDocumentScanStatus {
	if (file.status === "QUARANTINED" || file.scanStatus === "INFECTED") {
		return "INFECTED";
	}
	if (file.status === "FAILED") {
		return "SCAN_FAILED";
	}
	if (file.status === "READY" && file.scanStatus === "CLEAN") {
		return "CLEAN";
	}
	return "SCANNING";
}

/** Why a file cannot be KYB evidence of a tenant, or `null` when it can. */
export type KybEvidenceRejection = "INVALID" | "INCOMPLETE" | "NOT_SUBMITTABLE";

export function kybEvidenceRejectionOf(file: KybEvidenceFile | undefined, tenantId: string): KybEvidenceRejection | null {
	if (file?.category !== "MERCHANT_KYB" || file.tenantId !== tenantId) {
		return "INVALID";
	}
	if (file.status === "PENDING") {
		return "INCOMPLETE";
	}
	return SUBMITTABLE_FILE_STATUSES.includes(file.status) ? null : "NOT_SUBMITTABLE";
}

/** Unusable evidence (infected, or never cleared) needs merchant action. */
export function evidenceNeedsAction(statuses: readonly KybDocumentScanStatus[]): boolean {
	return statuses.some((status) => status === "INFECTED" || status === "SCAN_FAILED");
}

/** Every document scanned clean. An empty set is not "all clean": there is nothing to review. */
export function evidenceAllClean(statuses: readonly KybDocumentScanStatus[]): boolean {
	return statuses.length > 0 && statuses.every((status) => status === "CLEAN");
}
