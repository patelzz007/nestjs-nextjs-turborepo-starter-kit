import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { bindInTransactionHandler } from "../../../../platform/application/events/in-transaction-event-handler";
import { InTransactionEventRegistry } from "../../../../platform/application/events/in-transaction-event-registry";
import { AUTHORIZATION_KERNEL, type AuthorizationKernelPort } from "../../../authorization/public-api";
import { bindFileReferenceGuard, FileCategoryAccessRegistry, FileReferenceGuardRegistry } from "../../../files/public-api";
import { ReleaseKanbanAttachmentsOnFileDeleted } from "../../application/event-handlers/in-transaction/release-kanban-attachments-on-file-deleted.in-transaction-handler";
import { KanbanAttachmentFileAccessRule } from "../../application/services/kanban-attachment-file-access.rule";
import { KanbanAttachmentFileGuard } from "../../application/services/kanban-attachment-file.guard";
import { KanbanAttachmentFileScopeFactory } from "./prisma-kanban-attachment-bindings";

/**
 * The board owns KANBAN_TASK_ATTACHMENT: who may upload one (UPDATE:KANBAN_TASK,
 * for themselves), that deleting the file releases its attachment row in the
 * files transaction (mechanism 1), and that the deletion runs as `files.delete`
 * because `KanbanTaskAttachment` is bypass-only.
 */
@Injectable()
export class KanbanFileRegistrations implements OnModuleInit {
	public constructor(
		@Inject(InTransactionEventRegistry) private readonly handlers: InTransactionEventRegistry<Prisma.TransactionClient>,
		@Inject(FileReferenceGuardRegistry) private readonly guards: FileReferenceGuardRegistry<Prisma.TransactionClient>,
		private readonly access: FileCategoryAccessRegistry,
		@Inject(AUTHORIZATION_KERNEL) private readonly kernel: AuthorizationKernelPort,
	) {}

	public onModuleInit(): void {
		const scopes = new KanbanAttachmentFileScopeFactory();
		this.access.register(new KanbanAttachmentFileAccessRule(this.kernel));
		this.handlers.register(bindInTransactionHandler(new ReleaseKanbanAttachmentsOnFileDeleted(), scopes));
		this.guards.register(bindFileReferenceGuard(new KanbanAttachmentFileGuard(), scopes));
	}
}
