import { assertUploadCompletable, type VerifiedUpload } from "../../../domain/aggregates/stored-file.aggregate";
import { FileUploadAlreadyCompletedError } from "../../../domain/errors/files.errors";
import type { StoredFileSaveOutcome } from "../../../domain/repositories/stored-file.repository";
import type { FileObjectStoragePort } from "../../ports/file-object-storage.port";
import type { StoredFileView } from "../../ports/stored-file-read.port";
import type { StorageTaskDispatcher } from "../../ports/storage-task-dispatcher.port";

/**
 * Verifies the uploaded bytes (size, SHA-256, magic bytes against the category
 * allowlist, pixel rules) and claims the file PENDING → SCANNING exactly once
 * through `claim` (a compare-and-set: of concurrent completions only one
 * applies, the others get 409). It never marks a file clean itself; the caller
 * starts the scan. Shared by {@link completeFileUpload} and the server-side
 * ingest (`ServerFileIngest`), which scans inline.
 */
export async function verifyAndClaimUpload(
	storage: FileObjectStoragePort,
	uploaderId: string,
	file: StoredFileView,
	checksumSha256: string,
	claim: (verified: VerifiedUpload) => Promise<StoredFileSaveOutcome>,
): Promise<void> {
	assertUploadCompletable(file, uploaderId, checksumSha256);
	const verified = await storage.verifyUpload(file, checksumSha256);
	if ((await claim(verified)) === "lost-race") {
		throw new FileUploadAlreadyCompletedError();
	}
}

/**
 * {@link verifyAndClaimUpload}, then dispatches the malware scan. Shared by the
 * command handler and the published `StoredFileAccess`.
 */
export async function completeFileUpload(
	storage: FileObjectStoragePort,
	dispatcher: StorageTaskDispatcher,
	uploaderId: string,
	file: StoredFileView,
	checksumSha256: string,
	claim: (verified: VerifiedUpload) => Promise<StoredFileSaveOutcome>,
): Promise<void> {
	await verifyAndClaimUpload(storage, uploaderId, file, checksumSha256, claim);
	await dispatcher.dispatchScan(file.id);
}
