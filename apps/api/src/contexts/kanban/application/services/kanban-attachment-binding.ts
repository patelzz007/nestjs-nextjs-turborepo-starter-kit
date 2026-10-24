import { KANBAN_ACTIVITY_VALUE_MAX_LENGTH, KANBAN_TASK_ATTACHMENT_LIMIT } from "@workspace/shared";

import { KanbanAttachmentFileInvalidError, KanbanAttachmentLimitReachedError } from "../../domain/errors/kanban.errors";
import { kanbanAttachmentKindFor } from "../../domain/policies/kanban-attachment-kind.policy";
import type { KanbanScope } from "../kanban-scope";
import type { KanbanIdGenerator } from "../ports/kanban.tokens";
import type { KanbanHistory } from "./kanban-history";

/** Files to attach to an item, uploaded by `uploaderId`, posted with `commentId` (or attached directly: `null`). */
export interface KanbanFileBinding {
	readonly taskId: string;
	readonly uploaderId: string;
	readonly fileIds: readonly string[];
	readonly commentId: string | null;
}

/**
 * Attaches files the caller uploaded to an item, inside the caller's
 * transaction — which has already row-locked the item, so concurrent attaches
 * to it run one at a time and the limit holds. Locks the files (a concurrent
 * delete waits for the binding), requires each to be the caller's own READY
 * `KANBAN_TASK_ATTACHMENT` not attached anywhere yet, records each as a document
 * (PDF) or an attachment (image) from its stored type, and adds it to the
 * item's history. Answers the new attachment ids, in the order given.
 */
export async function attachUploadedFiles(scope: KanbanScope, binding: KanbanFileBinding, ids: KanbanIdGenerator, history: KanbanHistory): Promise<readonly string[]> {
	if (binding.fileIds.length === 0) {
		return [];
	}
	const files = await scope.files.lockForBinding({ category: "KANBAN_TASK_ATTACHMENT", tenantId: null, uploadedById: binding.uploaderId, fileIds: [...binding.fileIds] });
	const attachable = [];
	for (const fileId of binding.fileIds) {
		const file = files.find((candidate) => candidate.id === fileId);
		if (file?.status !== "READY" || (await scope.attachments.isFileAttached(file.id))) {
			throw new KanbanAttachmentFileInvalidError(fileId);
		}
		attachable.push(file);
	}
	if ((await scope.attachments.countLive(binding.taskId)) + attachable.length > KANBAN_TASK_ATTACHMENT_LIMIT) {
		throw new KanbanAttachmentLimitReachedError(binding.taskId);
	}
	const attachmentIds: string[] = [];
	for (const file of attachable) {
		const id = ids.next();
		await scope.attachments.create({ id, taskId: binding.taskId, commentId: binding.commentId, fileId: file.id, kind: kanbanAttachmentKindFor(file.mimeType) });
		history.record(binding.taskId, "ATTACHED", { to: file.originalName.slice(0, KANBAN_ACTIVITY_VALUE_MAX_LENGTH) });
		attachmentIds.push(id);
	}
	return attachmentIds;
}
