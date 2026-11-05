import type { FileCategory, FileRecord, FileStatus, FileVisibility, StorageObjectLocator } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** A live stored file as the files use cases read it (never a persistence row). */
export interface StoredFileView {
	readonly id: string;
	readonly category: FileCategory;
	readonly visibility: FileVisibility;
	readonly status: FileStatus;
	readonly uploadedById: string;
	readonly tenantId: string | null;
	readonly productId: string | null;
	readonly originalName: string;
	readonly mimeType: string;
	readonly sizeBytes: number;
	readonly expectedChecksum: string;
	/** Where the original's bytes are now (staging until READY, then the final key). */
	readonly locator: StorageObjectLocator;
	readonly publicPath: string | null;
	/** Epoch ms of the last change; the stale-upload sweep compares it against its cut-offs. */
	readonly updatedAt: number;
	/** The public `FileRecord` contract for this file. */
	readonly record: FileRecord;
}

/** Bytes a server-side ingest stores: the same bytes under the same name in the same tenant category are one file. */
export interface IngestedFileContent {
	/** Null for a platform category (a file of no tenant). */
	readonly tenantId: string | null;
	readonly category: FileCategory;
	readonly originalName: string;
	readonly checksumSha256: string;
}

/**
 * Read side of stored files. Every read runs under the actor's RLS session, so
 * a file the actor cannot see is simply absent (404, never 403: existence is not leaked).
 */
export interface StoredFileReadPort {
	findLive(actor: ActorContext, fileId: string): Promise<StoredFileView | null>;

	/**
	 * The actor's OWN live upload with this id, whatever tenant it belongs to — read to authorize
	 * completing it (the request names no tenant). Never another user's file: nothing leaks.
	 */
	findOwnUpload(actor: ActorContext, fileId: string): Promise<StoredFileView | null>;

	/** PENDING uploads whose ticket was abandoned, oldest first, one sweep page. */
	listStalePending(actor: ActorContext, olderThanMs: number): Promise<readonly StoredFileView[]>;

	/** Files whose verdict is overdue (lost job, scanner outage beyond retries), oldest first, one sweep page. */
	listStaleAwaitingVerdict(actor: ActorContext, olderThanMs: number): Promise<readonly StoredFileView[]>;

	/**
	 * Server ingest (`files.server_ingest`): the live file already holding `content` — a READY one
	 * first, else one an earlier ingest left awaiting its scan verdict — or null. Read as that
	 * operation: the ingest acts for a context that authorized it, not as a member of the tenant.
	 */
	findIngestedContent(actor: ActorContext, content: IngestedFileContent): Promise<StoredFileView | null>;

	/** Server ingest: a live file the ingest just recorded, read as `files.server_ingest` (see {@link findIngestedContent}). */
	findLiveForIngest(actor: ActorContext, fileId: string): Promise<StoredFileView | null>;

	/** READY files of a staging category that nothing consumed within `olderThanMs`, oldest first, one sweep page. */
	listExpiredStaging(actor: ActorContext, category: FileCategory, olderThanMs: number): Promise<readonly StoredFileView[]>;
}
