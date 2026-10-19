import { Query } from "@nestjs/cqrs";
import type { FileDownloadResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /files/:fileId/download-url`: a short-lived signed URL (none until the file is READY). */
export class GetFileDownloadUrlQuery extends Query<FileDownloadResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly fileId: string,
	) {
		super();
	}
}
