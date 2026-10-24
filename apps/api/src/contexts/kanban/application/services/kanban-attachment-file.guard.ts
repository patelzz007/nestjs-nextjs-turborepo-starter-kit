import type { FileCategory } from "@workspace/shared";

import type { FileDeletionScope, FileReferenceBlock, FileReferenceGuard } from "../../../files/public-api";
import type { KanbanAttachmentFileScope } from "../ports/kanban-attachment-bindings.port";

/**
 * The board's reference guard for KANBAN_TASK_ATTACHMENT: an attached file never
 * blocks its own deletion (its attachment row is released with it), but
 * `KanbanTaskAttachment` is bypass-only under RLS, so the deletion must run as
 * the allowlisted `files.delete` operation or the release would update nothing.
 */
export class KanbanAttachmentFileGuard implements FileReferenceGuard<KanbanAttachmentFileScope> {
	public readonly categories: readonly FileCategory[] = ["KANBAN_TASK_ATTACHMENT"];
	public readonly deletionScope: FileDeletionScope = "system-operation";

	public blockDelete(): Promise<FileReferenceBlock | null> {
		return Promise.resolve(null);
	}
}
