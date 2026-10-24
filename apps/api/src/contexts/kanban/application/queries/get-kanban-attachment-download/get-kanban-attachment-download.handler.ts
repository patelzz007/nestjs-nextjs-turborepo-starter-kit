import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { KanbanAttachmentDownload } from "@workspace/shared";

import { KanbanAttachmentNotFoundError } from "../../../domain/errors/kanban.errors";
import type { KanbanAttachmentFilesPort } from "../../ports/kanban-attachment-files.port";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ATTACHMENT_FILES, KANBAN_READS } from "../../ports/kanban.tokens";
import { GetKanbanAttachmentDownloadQuery } from "./get-kanban-attachment-download.query";

/**
 * A short-lived signed link to one attachment's original upload, for any
 * staff member who may read the task — not only its uploader. Only a live
 * attachment of that live task resolves, so the route is no file oracle.
 */
@QueryHandler(GetKanbanAttachmentDownloadQuery)
export class GetKanbanAttachmentDownloadHandler implements IQueryHandler<GetKanbanAttachmentDownloadQuery, KanbanAttachmentDownload> {
	public constructor(
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ATTACHMENT_FILES) private readonly files: KanbanAttachmentFilesPort,
	) {}

	public async execute(query: GetKanbanAttachmentDownloadQuery): Promise<KanbanAttachmentDownload> {
		const attached = await this.reads.attachedFile(query.actor, query.taskId, query.attachmentId);
		const link = attached === null ? null : await this.files.downloadLink(attached.fileId);
		if (attached === null || link === null) {
			throw new KanbanAttachmentNotFoundError(query.attachmentId);
		}
		return { attachmentId: attached.attachmentId, fileName: attached.fileName, downloadUrl: link.url, expiresAt: link.expiresAt };
	}
}
