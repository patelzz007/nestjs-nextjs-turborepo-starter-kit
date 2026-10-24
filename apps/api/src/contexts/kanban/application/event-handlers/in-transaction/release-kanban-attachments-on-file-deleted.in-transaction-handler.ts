import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import { FileDeleted } from "../../../../files/public-api";
import type { KanbanAttachmentFileScope } from "../../ports/kanban-attachment-bindings.port";

/** A deleted task attachment leaves its task in the deletion transaction. */
export class ReleaseKanbanAttachmentsOnFileDeleted implements InTransactionEventHandler<FileDeleted, KanbanAttachmentFileScope> {
	public accepts(event: DomainEvent): event is FileDeleted {
		return event instanceof FileDeleted && event.category === "KANBAN_TASK_ATTACHMENT";
	}

	public async handle(event: FileDeleted, scope: KanbanAttachmentFileScope): Promise<void> {
		await scope.attachmentBindings.releaseFile(event.fileId, event.deletedBy, event.occurredAt);
	}
}
