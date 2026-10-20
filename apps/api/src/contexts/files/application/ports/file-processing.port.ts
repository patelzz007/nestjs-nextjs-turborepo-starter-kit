import type { FileProcessingResult, StorageCdnInvalidationJob } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** What happened to a verdict: applied, or ignored because the file had already left SCANNING. */
export type VerdictOutcome = "READY" | "QUARANTINED" | "FAILED" | "SKIPPED" | "AWAITING_EXTERNAL";

/**
 * The scan-and-verdict pipeline (object promotion, public publishing,
 * renditions, then the verdict transaction). It is infrastructure because it
 * drives object storage; every verdict it applies goes through the files unit
 * of work, so `FileVerdictReached` is drained by the transactional dispatcher.
 */
export interface FileProcessingPort {
	/**
	 * Scans one file and applies the verdict. `finalAttempt` says whether a
	 * scanner outage should fail the upload now (last BullMQ attempt, or an
	 * inline scan with no queue to retry) or be rethrown for a retry.
	 */
	scan(actor: ActorContext, fileId: string, finalAttempt: boolean): Promise<VerdictOutcome>;

	/** Applies a result posted by an external processing worker; 409 once the file left SCANNING. */
	applyProcessingResult(actor: ActorContext, result: FileProcessingResult): Promise<void>;
}

/** Purges a withdrawn file's keys from the CDN. A rejection is the queue's signal to retry. */
export interface CdnInvalidationPort {
	invalidate(job: StorageCdnInvalidationJob): Promise<void>;
}

/**
 * The external processing worker proves itself with a shared secret
 * (`STORAGE_PROCESSING_CALLBACK_SECRET`). Fails closed in every environment:
 * with no secret configured nobody can call back. Throws a 401 `CALLBACK_UNAUTHORIZED`.
 */
export interface ProcessingCallbackAuthenticator {
	assertAuthentic(presentedSecret: string | null): void;
}
