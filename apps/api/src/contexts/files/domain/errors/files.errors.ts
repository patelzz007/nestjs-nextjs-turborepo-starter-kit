import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

/*
 * Files-context rule violations. Messages and codes are the ones the HTTP API
 * has always returned for these cases (clients match on the codes). No details
 * are attached, so the error envelope is byte-identical to the previous one.
 */

/** Only the uploader may complete an upload, and an avatar is only ever uploaded for yourself. */
export class FileUploadForbiddenError extends DomainError {
	public readonly code: DomainErrorCode = "FILE_UPLOAD_FORBIDDEN";

	public constructor(message = "Not allowed to complete this upload") {
		super(message);
	}
}

/** The upload already left PENDING (completed, or lost a race with a concurrent completion). */
export class FileUploadAlreadyCompletedError extends DomainError {
	public readonly code: DomainErrorCode = "FILE_UPLOAD_ALREADY_COMPLETED";

	public constructor() {
		super("Upload already completed");
	}
}

/** The checksum presented at completion is not the one the ticket was issued for. */
export class FileChecksumMismatchError extends DomainError {
	public readonly code: DomainErrorCode = "FILE_CHECKSUM_MISMATCH";

	public constructor() {
		super("Checksum mismatch");
	}
}

/** A verdict arrived for a file that is no longer awaiting one. */
export class FileStateConflictError extends DomainError {
	public readonly code: DomainErrorCode = "FILE_STATE_CONFLICT";

	public constructor(message: string) {
		super(message);
	}
}

/** The upload request breaks its category's size limit. */
export class FileTooLargeError extends DomainError {
	public readonly code: DomainErrorCode = "FILE_TOO_LARGE";

	public constructor() {
		super("File exceeds maximum allowed size");
	}
}

/** The upload request names a MIME type its category does not accept. */
export class FileMimeTypeNotAllowedError extends DomainError {
	public readonly code: DomainErrorCode = "FILE_INVALID_MIME";

	public constructor() {
		super("Disallowed MIME type");
	}
}

/** The resource an upload's object keys are namespaced under (product, tenant, user) is missing. */
export class FileOwnerUnresolvedError extends DomainError {
	public readonly code: DomainErrorCode = "FILE_RESOURCE_REQUIRED";

	public constructor(category: string) {
		super(`Missing resource binding for a ${category} upload`);
	}
}

/** A live reward still shows this image. */
export class FileInUseAsRewardImageError extends DomainError {
	public readonly code: DomainErrorCode = "FILE_IN_USE_AS_REWARD_IMAGE";

	public constructor() {
		super("This image is shown on a reward. Remove it from the reward first.");
	}
}

/** The file was submitted as KYB evidence, which is retained for the review history. */
export class KybEvidenceRetainedError extends DomainError {
	public readonly code: DomainErrorCode = "KYB_EVIDENCE_RETAINED";

	public constructor() {
		super("Submitted verification evidence is retained and cannot be deleted");
	}
}

/**
 * Thrown by an owner's in-transaction handler when the resource a READY file is
 * bound to no longer exists (a product removed mid-scan). The verdict
 * transaction rolls back and the files context fails the upload instead. It is
 * a signal between contexts, never an HTTP outcome, so it is not a DomainError.
 */
export class FileBindingTargetMissingError extends Error {
	public constructor(
		public readonly fileId: string,
		target: string,
	) {
		super(`File binding target is missing: ${target}`);
		this.name = "FileBindingTargetMissingError";
	}
}
