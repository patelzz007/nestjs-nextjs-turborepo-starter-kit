import { Injectable } from "@nestjs/common";

import type { GithubTokenOwner, GithubTokenOwnerPort } from "../../application/ports/github-credentials.port";
import { GithubPullRequestClient } from "../github-api/github-pull-request.client";

/** Asks GitHub who a token being linked belongs to, and when it expires. */
@Injectable()
export class GithubTokenOwnerAdapter implements GithubTokenOwnerPort {
	public constructor(private readonly client: GithubPullRequestClient) {}

	public async fetchTokenOwner(token: string): Promise<GithubTokenOwner> {
		const owner = await this.client.fetchTokenOwner({ source: "linked", token });
		return { githubUserId: owner.user.id, login: owner.user.login, tokenExpiresAt: owner.tokenExpiresAt };
	}
}
