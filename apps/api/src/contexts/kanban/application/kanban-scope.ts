import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { FileReferencePort } from "../../files/public-api";
import type {
	KanbanActivityRepository,
	KanbanAttachmentRepository,
	KanbanBoardRepository,
	KanbanChecklistRepository,
	KanbanCommentRepository,
	KanbanKeyRepository,
	KanbanLinkRepository,
	KanbanPeopleRepository,
	KanbanTaskRepository,
	KanbanWatcherRepository,
} from "../domain/repositories/kanban.repositories";

/** Everything one kanban transaction can touch. Every member is bound to that transaction. */
export interface KanbanScope {
	readonly board: KanbanBoardRepository;
	readonly tasks: KanbanTaskRepository;
	readonly keys: KanbanKeyRepository;
	readonly comments: KanbanCommentRepository;
	readonly attachments: KanbanAttachmentRepository;
	readonly checklist: KanbanChecklistRepository;
	readonly links: KanbanLinkRepository;
	readonly watchers: KanbanWatcherRepository;
	readonly activity: KanbanActivityRepository;
	readonly people: KanbanPeopleRepository;
	/** The files context's row-locked "is this file live and the caller's" check. */
	readonly files: FileReferencePort;
	readonly events: TransactionalEventCollector;
}
