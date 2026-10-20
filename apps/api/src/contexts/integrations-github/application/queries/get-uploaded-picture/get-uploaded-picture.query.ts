import { Query } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { GithubPicture } from "../../ports/github-repository-files.port";

/** Largest picture served back to the app — a repository may hold a bigger file, which is then not shown. */
export const GITHUB_SERVED_PICTURE_MAX_BYTES = 26_214_400;
/** Which upload, and the node whose body shows it. */
export interface GetUploadedPictureInput {
	readonly attachmentId: string;
	readonly nodeId: string;
}

/** An upload to a private repository, shown in the body of `nodeId`: the body is read now with the caller's token (so GitHub decides they may see it and signs a fresh link), and the picture through that link. */
export class GetUploadedPictureQuery extends Query<GithubPicture> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetUploadedPictureInput,
	) {
		super();
	}
}
