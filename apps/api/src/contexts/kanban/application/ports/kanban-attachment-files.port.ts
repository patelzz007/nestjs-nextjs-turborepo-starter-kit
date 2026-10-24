import type { EpochMs } from "@workspace/shared";

/** A short-lived signed link that downloads a file as an attachment. */
export interface KanbanFileDownloadLink {
	readonly url: string;
	readonly expiresAt: EpochMs;
}

/**
 * The files context's delivery and deletion of a file the board already
 * authorized (the route's KANBAN_TASK permission). Deleting a file releases its
 * attachment row in the same transaction (`ReleaseKanbanAttachmentsOnFileDeleted`).
 */
export interface KanbanAttachmentFilesPort {
	/** `null` when the file is gone or not READY. */
	downloadLink(fileId: string): Promise<KanbanFileDownloadLink | null>;
	/** `false` when the file was already gone. */
	deleteFile(fileId: string, actorUserId: string): Promise<boolean>;
}
