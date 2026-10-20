import { assertUploadCompletable, type VerifiedUpload } from "../../../domain/aggregates/stored-file.aggregate";
import { FileUploadAlreadyCompletedError } from "../../../domain/errors/files.errors";
import type { StoredFileSaveOutcome } from "../../../domain/repositories/stored-file.repository";
import type { FileObjectStoragePort } from "../../ports/file-object-storage.port";
import type { StoredFileView } from "../../ports/stored-file-read.port";
import type { StorageTaskDispatcher } from "../../ports/storage-task-dispatcher.port";

/**
 * Verifies the uploaded bytes (size, SHA-256, magic bytes against the category
 * allowlist, pixel rules), claims the file PENDING → SCANNING exactly once
 * through `claim` (a compare-and-set: of concurrent completions only one
 * applies, the others get 409), then dispatches the malware scan. It never
 * marks a file clean itself. Shared by the command handler and the
 * published `StoredFileAccess`.
 */
export async function completeFileUpload(
	storage: FileObjectStoragePort,
	dispatcher: StorageTaskDispatcher,
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
	await dispatcher.dispatchScan(file.id);
}
