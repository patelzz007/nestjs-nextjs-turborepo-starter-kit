import type { FileUploadRequest, FileCategory } from "@workspace/shared";

import {
	fileForbidden,
	isOwnPersonalUpload,
	uploaderOnly,
	type FileAccessAction,
	type FileAccessSubject,
	type FileActor,
	type FileCategoryAccessRule,
} from "../../../files/public-api";

/** USER_AVATAR: an account uploads only its own avatar; afterwards only the uploader acts on it. */
export class UserAvatarFileAccessRule implements FileCategoryAccessRule {
	public readonly categories: readonly FileCategory[] = ["USER_AVATAR"];

	public assertCanUpload(actor: FileActor, request: FileUploadRequest): Promise<void> {
		return isOwnPersonalUpload(actor.userId, request) ? Promise.resolve() : Promise.reject(fileForbidden("upload", "Cannot upload an avatar for another user"));
	}

	public assertCanAct(actor: FileActor, file: FileAccessSubject, action: FileAccessAction): Promise<void> {
		return uploaderOnly(actor, file, action);
	}
}
