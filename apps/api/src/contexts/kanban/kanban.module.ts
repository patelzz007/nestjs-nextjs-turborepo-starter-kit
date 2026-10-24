import { Module, type Provider } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
// The board is platform data with no tenant: every unit of work runs as a named system operation.
import { USER_OWNED_DATA_SCOPE } from "../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { AuthorizationModule, PERMISSION_HOLDERS_READ, type PermissionHoldersReadPort } from "../authorization/public-api";
import { FilesModule, StoredFileAccess } from "../files/public-api";
import { AddKanbanCommentHandler } from "./application/commands/add-kanban-comment/add-kanban-comment.handler";
import { AddKanbanLinkHandler } from "./application/commands/add-kanban-link/add-kanban-link.handler";
import { AttachKanbanFileHandler } from "./application/commands/attach-kanban-file/attach-kanban-file.handler";
import { CreateKanbanTaskHandler } from "./application/commands/create-kanban-task/create-kanban-task.handler";
import { DeleteKanbanTaskHandler } from "./application/commands/delete-kanban-task/delete-kanban-task.handler";
import { ImportKanbanTasksHandler } from "./application/commands/import-kanban-tasks/import-kanban-tasks.handler";
import { MoveKanbanItemToParentHandler } from "./application/commands/move-kanban-item-to-parent/move-kanban-item-to-parent.handler";
import { MoveKanbanColumnHandler } from "./application/commands/move-kanban-column/move-kanban-column.handler";
import { MoveKanbanTaskHandler } from "./application/commands/move-kanban-task/move-kanban-task.handler";
import { RemoveKanbanAttachmentHandler } from "./application/commands/remove-kanban-attachment/remove-kanban-attachment.handler";
import { RemoveKanbanLinkHandler } from "./application/commands/remove-kanban-link/remove-kanban-link.handler";
import { ReviseKanbanTaskHandler } from "./application/commands/revise-kanban-task/revise-kanban-task.handler";
import { SetKanbanChecklistItemHandler } from "./application/commands/set-kanban-checklist-item/set-kanban-checklist-item.handler";
import { UpdateKanbanColumnHandler } from "./application/commands/update-kanban-column/update-kanban-column.handler";
import { WatchKanbanTaskHandler } from "./application/commands/watch-kanban-task/watch-kanban-task.handler";
import type { KanbanScope } from "./application/kanban-scope";
import type { KanbanAssigneesPort } from "./application/ports/kanban-assignees.port";
import type { KanbanAttachmentFilesPort } from "./application/ports/kanban-attachment-files.port";
import type { KanbanReadPort } from "./application/ports/kanban-read.port";
import { KANBAN_ASSIGNEES, KANBAN_ATTACHMENT_FILES, KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, type KanbanIdGenerator } from "./application/ports/kanban.tokens";
import { GetKanbanAttachmentDownloadHandler } from "./application/queries/get-kanban-attachment-download/get-kanban-attachment-download.handler";
import { GetKanbanBoardHandler } from "./application/queries/get-kanban-board/get-kanban-board.handler";
import { GetKanbanTaskHandler } from "./application/queries/get-kanban-task/get-kanban-task.handler";
import { ListKanbanActivityHandler } from "./application/queries/list-kanban-activity/list-kanban-activity.handler";
import { ListKanbanCommentsHandler } from "./application/queries/list-kanban-comments/list-kanban-comments.handler";
import { ListKanbanItemsHandler } from "./application/queries/list-kanban-items/list-kanban-items.handler";
import { SearchKanbanItemsHandler } from "./application/queries/search-kanban-items/search-kanban-items.handler";
import { ListKanbanPeopleHandler } from "./application/queries/list-kanban-people/list-kanban-people.handler";
import { PermissionHoldersKanbanAssignees } from "./infrastructure/adapters/permission-holders-kanban-assignees.adapter";
import { StoredFileKanbanAttachmentFiles } from "./infrastructure/adapters/stored-file-kanban-attachment-files.adapter";
import { UuidKanbanIdGenerator } from "./infrastructure/adapters/uuid-kanban-id-generator";
import { KanbanFileRegistrations } from "./infrastructure/persistence/kanban-file-registrations";
import { KanbanScopeFactory } from "./infrastructure/persistence/kanban-scope.factory";
import { PrismaKanbanReadRepository } from "./infrastructure/persistence/prisma-kanban.read-repository";
import { KanbanController } from "./presentation/http/kanban.controller";

const COMMAND_HANDLERS: readonly Provider[] = [
	CreateKanbanTaskHandler,
	ImportKanbanTasksHandler,
	ReviseKanbanTaskHandler,
	MoveKanbanTaskHandler,
	MoveKanbanItemToParentHandler,
	DeleteKanbanTaskHandler,
	MoveKanbanColumnHandler,
	AddKanbanCommentHandler,
	AttachKanbanFileHandler,
	RemoveKanbanAttachmentHandler,
	UpdateKanbanColumnHandler,
	AddKanbanLinkHandler,
	RemoveKanbanLinkHandler,
	SetKanbanChecklistItemHandler,
	WatchKanbanTaskHandler,
];

const QUERY_HANDLERS: readonly Provider[] = [
	GetKanbanBoardHandler,
	SearchKanbanItemsHandler,
	GetKanbanTaskHandler,
	ListKanbanPeopleHandler,
	ListKanbanItemsHandler,
	ListKanbanCommentsHandler,
	ListKanbanActivityHandler,
	GetKanbanAttachmentDownloadHandler,
];

/**
 * The kanban context: the platform staff's two linked boards — a planning board
 * of epics and features and an execution board of stories and tasks — with each
 * item's checklists, links, watchers, history, comments and file attachments
 * (KANBAN_TASK_ATTACHMENT, owned here). Every change that reorders a board or
 * reshapes the hierarchy runs under the board lock. Who may be assigned is the
 * authorization context's answer (holders of READ on KANBAN_TASK).
 */
@Module({
	imports: [PrismaModule, UnitOfWorkModule, SystemCommandModule, FilesModule, AuthorizationModule],
	controllers: [KanbanController],
	providers: [
		{
			provide: KANBAN_UNIT_OF_WORK,
			inject: [TenantTransactionService, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<KanbanScope> => new PrismaUnitOfWork(transactions, new KanbanScopeFactory(), dispatcher, publisher, USER_OWNED_DATA_SCOPE),
		},
		{
			provide: KANBAN_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): KanbanReadPort => new PrismaKanbanReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions)),
		},
		{
			provide: KANBAN_ATTACHMENT_FILES,
			inject: [StoredFileAccess],
			useFactory: (files: StoredFileAccess): KanbanAttachmentFilesPort => new StoredFileKanbanAttachmentFiles(files),
		},
		{
			provide: KANBAN_ASSIGNEES,
			inject: [PERMISSION_HOLDERS_READ],
			useFactory: (holders: PermissionHoldersReadPort): KanbanAssigneesPort => new PermissionHoldersKanbanAssignees(holders),
		},
		{ provide: KANBAN_ID_GENERATOR, useFactory: (): KanbanIdGenerator => new UuidKanbanIdGenerator() },
		KanbanFileRegistrations,
		...COMMAND_HANDLERS,
		...QUERY_HANDLERS,
	],
})
export class KanbanModule {}
