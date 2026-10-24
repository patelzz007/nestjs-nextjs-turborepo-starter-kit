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

/** The one kernel call the rule makes: the audited decision, throwing a 403 on DENY. */
export type KernelAuthorizeCheck = Pick<AuthorizationKernelPort, "authorize">;

/**
 * KANBAN_TASK_ATTACHMENT: uploaded only for yourself and with UPDATE:KANBAN_TASK
 * (the permission that attaches it); through `/files`, only its uploader may
 * complete, read or delete it. Other staff download an attached file through
 * the board's own route, which checks READ:KANBAN_TASK.
 */
export class KanbanAttachmentFileAccessRule implements FileCategoryAccessRule {
	public readonly categories: readonly FileCategory[] = ["KANBAN_TASK_ATTACHMENT"];

	public constructor(private readonly kernel: KernelAuthorizeCheck) {}

	public async assertCanUpload(actor: FileActor, request: FileUploadRequest): Promise<void> {
		if (!isOwnPersonalUpload(actor.userId, request)) {
			throw fileForbidden("upload", "Cannot upload a task attachment for another user");
		}
		await this.kernel.authorize({ subject: { userId: actor.userId, isSuperAdmin: false }, action: "UPDATE", resource: "KANBAN_TASK" });
	}

	public assertCanAct(actor: FileActor, file: FileAccessSubject, action: FileAccessAction): Promise<void> {
		return uploaderOnly(actor, file, action);
	}
}
