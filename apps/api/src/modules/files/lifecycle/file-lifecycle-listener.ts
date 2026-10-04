import type { Prisma } from "@prisma/client";
import type { FileCategory } from "@workspace/shared";

/** The verdict a file just received. Every one is final: the file left SCANNING for good. */
export type FileVerdictOutcome = "READY" | "QUARANTINED" | "FAILED";

/** Published once per applied verdict, inside the transaction that applied it. */
export interface FileVerdictEvent {
	readonly fileId: string;
	readonly category: FileCategory;
	readonly organizationId: string | null;
	readonly uploadedById: string;
	readonly outcome: FileVerdictOutcome;
}

/**
 * Extension point for features that own files of a category (KYB evidence,
 * product galleries, …). The files module never imports those features: a
 * feature registers a provider that extends this class, and
 * {@link FileLifecycleListenerRegistry} discovers it.
 *
 * `onVerdict` runs INSIDE the verdict transaction (system operation
 * `files.scan_verdict.apply`): the verdict and every reaction commit together,
 * or roll back together and the verdict is retried — no event can be lost
 * between "file decided" and "feature reacted", even across a crash.
 * Reactions must therefore be idempotent and transaction-safe (no external
 * side effects; use the transactional outbox for those).
 */
export abstract class FileLifecycleListener {
	/** Categories this listener reacts to. */
	public abstract readonly categories: readonly FileCategory[];

	public abstract onVerdict(tx: Prisma.TransactionClient, event: FileVerdictEvent): Promise<void>;
}
