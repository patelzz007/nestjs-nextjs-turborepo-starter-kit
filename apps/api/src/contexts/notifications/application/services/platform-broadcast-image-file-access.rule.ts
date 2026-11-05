import type { FileCategory, FileUploadRequest } from "@workspace/shared";

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

/**
 * PLATFORM_BROADCAST_IMAGE (enhancement 5.4): uploaded only for yourself and with CREATE:BROADCAST (the
 * permission that writes a platform notice); through `/files`, only its uploader completes, reads or deletes
 * it. A notice names it by id, and the saved notice serves its public address.
 */
export class PlatformBroadcastImageFileAccessRule implements FileCategoryAccessRule {
	public readonly categories: readonly FileCategory[] = ["PLATFORM_BROADCAST_IMAGE"];

	public constructor(private readonly kernel: Pick<AuthorizationKernelPort, "authorize">) {}

	public async assertCanUpload(actor: FileActor, request: FileUploadRequest): Promise<void> {
		if (!isOwnPersonalUpload(actor.userId, request)) {
			throw fileForbidden("upload", "Cannot upload a broadcast picture for another user");
		}
		await this.kernel.authorize({ subject: { userId: actor.userId, isSuperAdmin: false }, action: "CREATE", resource: "BROADCAST" });
	}

	public assertCanAct(actor: FileActor, file: FileAccessSubject, action: FileAccessAction): Promise<void> {
		return uploaderOnly(actor, file, action);
	}
}
