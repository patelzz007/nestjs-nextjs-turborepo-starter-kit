import { Query } from "@nestjs/cqrs";
import type { KanbanAttachmentDownload } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/kanban/tasks/:taskId/attachments/:attachmentId/download`. */
export class GetKanbanAttachmentDownloadQuery extends Query<KanbanAttachmentDownload> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly attachmentId: string,
	) {
		super();
	}
}
