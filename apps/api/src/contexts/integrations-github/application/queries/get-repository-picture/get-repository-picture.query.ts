import { Query } from "@nestjs/cqrs";
import type { GithubRepositoryFile } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { GithubPicture } from "../../ports/github-repository-files.port";

/** A picture kept in a repository, read with the caller's own token. */
export class GetRepositoryPictureQuery extends Query<GithubPicture> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubRepositoryFile,
	) {
		super();
	}
}
