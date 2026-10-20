import { Query } from "@nestjs/cqrs";
import type { FileDetailResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /files/:fileId`: one file's metadata. */
export class GetFileQuery extends Query<FileDetailResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly fileId: string,
	) {
		super();
	}
}
