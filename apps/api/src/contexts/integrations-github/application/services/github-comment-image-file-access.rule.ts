import type { FileUploadRequest, FileCategory } from "@workspace/shared";

import type { AuthorizationKernelPort } from "../../../authorization/public-api";
import {
	fileForbidden,
	isOwnPersonalUpload,
	uploaderOnly,
	type FileAccessAction,
	type FileAccessSubject,
	type FileActor,
	type FileCategoryAccessRule,
} from "../../../files/public-api";

/** The one kernel call the rule makes: the audited decision, throwing a 403 on DENY. */
export type KernelAuthorizeCheck = Pick<AuthorizationKernelPort, "authorize">;

/** GITHUB_COMMENT_IMAGE: only for yourself and with UPDATE:GITHUB_PULL_REQUEST (the permission that posts the comment); afterwards only the uploader. */
export class GithubCommentImageFileAccessRule implements FileCategoryAccessRule {
	public readonly categories: readonly FileCategory[] = ["GITHUB_COMMENT_IMAGE"];

	public constructor(private readonly kernel: KernelAuthorizeCheck) {}

	public async assertCanUpload(actor: FileActor, request: FileUploadRequest): Promise<void> {
		if (!isOwnPersonalUpload(actor.userId, request)) {
			throw fileForbidden("upload", "Cannot upload an image for another user");
		}
		await this.kernel.authorize({ subject: { userId: actor.userId, isSuperAdmin: false }, action: "UPDATE", resource: "GITHUB_PULL_REQUEST" });
	}

	public assertCanAct(actor: FileActor, file: FileAccessSubject, action: FileAccessAction): Promise<void> {
		return uploaderOnly(actor, file, action);
	}
}
