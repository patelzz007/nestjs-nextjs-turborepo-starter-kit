import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { createFilesTransactionalPorts } from "../../../files/public-api";
import type { KanbanScope } from "../../application/kanban-scope";
import { PrismaKanbanActivityRepository, PrismaKanbanPeopleRepository } from "./prisma-kanban-activity.repository";
import { PrismaKanbanAttachmentRepository } from "./prisma-kanban-attachment.repository";
import { PrismaKanbanBoardRepository } from "./prisma-kanban-board.repository";
import { PrismaKanbanChecklistRepository } from "./prisma-kanban-checklist.repository";
import { PrismaKanbanCommentRepository } from "./prisma-kanban-comment.repository";
import { PrismaKanbanKeyRepository } from "./prisma-kanban-key.repository";
import { PrismaKanbanLinkRepository } from "./prisma-kanban-link.repository";
import { PrismaKanbanTaskRepository } from "./prisma-kanban-task.repository";
import { PrismaKanbanWatcherRepository } from "./prisma-kanban-watcher.repository";

/** Builds the board's repositories (and the files lock it binds with) on the unit-of-work transaction. Never cached. */
export class KanbanScopeFactory implements ScopeFactory<KanbanScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): KanbanScope {
		return {
			board: new PrismaKanbanBoardRepository(db),
			tasks: new PrismaKanbanTaskRepository(db),
			keys: new PrismaKanbanKeyRepository(db),
			comments: new PrismaKanbanCommentRepository(db),
			attachments: new PrismaKanbanAttachmentRepository(db),
			checklist: new PrismaKanbanChecklistRepository(db),
			links: new PrismaKanbanLinkRepository(db),
			watchers: new PrismaKanbanWatcherRepository(db),
			activity: new PrismaKanbanActivityRepository(db),
			people: new PrismaKanbanPeopleRepository(db),
			files: createFilesTransactionalPorts(db).fileReferences,
			events,
		};
	}
}
