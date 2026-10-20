import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { AUTHORIZATION_KERNEL, type AuthorizationKernelPort } from "../../../authorization/public-api";
import { FileCategoryAccessRegistry } from "../../../files/public-api";
import { GithubCommentImageFileAccessRule } from "../../application/services/github-comment-image-file-access.rule";

/** integrations-github owns GITHUB_COMMENT_IMAGE: who may upload a picture for a pull-request comment. */
@Injectable()
export class GithubFileRegistrations implements OnModuleInit {
	public constructor(
		private readonly access: FileCategoryAccessRegistry,
		@Inject(AUTHORIZATION_KERNEL) private readonly kernel: AuthorizationKernelPort,
	) {}

	public onModuleInit(): void {
		this.access.register(new GithubCommentImageFileAccessRule(this.kernel));
	}
}
