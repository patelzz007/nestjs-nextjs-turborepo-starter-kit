"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { toDocumentMimeType, uploadFileDirect, waitForFileReady } from "@workspace/client/lib/storage/direct-upload";
import { DocumentMimeTypeSchema, FILE_CATEGORY_POLICIES, IDEMPOTENCY_KEY_HEADER, type FileCategoryPolicy, type KanbanAttachment, type KanbanComment } from "@workspace/shared";

/** The task-attachment upload policy (types, size), from the shared contract the API enforces. */
export const KANBAN_ATTACHMENT_FILE_POLICY: FileCategoryPolicy = FILE_CATEGORY_POLICIES.KANBAN_TASK_ATTACHMENT;

/** The file picker's `accept`. */
export const KANBAN_ATTACHMENT_ACCEPT: string = KANBAN_ATTACHMENT_FILE_POLICY.allowedMimeTypes.join(",");

const BYTES_PER_MEGABYTE = 1_048_576;

/** A picked file the policy refuses, before anything is uploaded. */
export class KanbanAttachmentRejectedError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "KanbanAttachmentRejectedError";
	}
}

/** Refuses a file of a type or size the API would refuse (UX; the API checks again, on the stored bytes). */
export function assertAttachmentAllowed(file: File, policy: FileCategoryPolicy = KANBAN_ATTACHMENT_FILE_POLICY): void {
	const mimeType = DocumentMimeTypeSchema.safeParse(file.type);
	if (!mimeType.success || !policy.allowedMimeTypes.includes(mimeType.data)) {
		throw new KanbanAttachmentRejectedError("Attach a PDF or a JPEG, PNG or WebP image.");
	}
	if (file.size > policy.maxBytes) {
		throw new KanbanAttachmentRejectedError(`Attach a file of at most ${String(policy.maxBytes / BYTES_PER_MEGABYTE)} MB.`);
	}
}

export interface AttachKanbanFileInput {
	readonly taskId: string;
	readonly file: File;
}

/**
 * Uploads one file for the board through the file pipeline and answers its id
 * once it is READY: check the file → upload ticket (the caller's own
 * `KANBAN_TASK_ATTACHMENT`) → direct upload → complete → wait for the scan
 * verdict. Nothing is attached yet: the caller attaches it to an item, or posts
 * it with a comment. Errors: {@link KanbanAttachmentRejectedError},
 * `DirectUploadError` or `FileProcessingError`.
 */
function useUploadKanbanFile(): (file: File) => Promise<string> {
	const { api, user } = useAuth();
	return async (file: File): Promise<string> => {
		if (user === null) {
			throw new KanbanAttachmentRejectedError("Sign in again to attach files.");
		}
		assertAttachmentAllowed(file);
		const uploaded = await uploadFileDirect(api, { category: "KANBAN_TASK_ATTACHMENT", userId: user.id, fileName: file.name, mimeType: toDocumentMimeType(file) }, file);
		return (await waitForFileReady(api, uploaded.fileId)).file.id;
	};
}

/**
 * Attaches one file to an item: {@link useUploadKanbanFile}'s upload, then
 * `POST …/attachments`. Errors: the upload's, or an `ApiError` (e.g. `KANBAN_ATTACHMENT_LIMIT_REACHED`).
 */
export function useAttachKanbanFile(): UseMutationResult<KanbanAttachment, Error, AttachKanbanFileInput> {
	const { api } = useAuth();
	const upload = useUploadKanbanFile();
	return useMutation({
		mutationFn: async ({ taskId, file }: AttachKanbanFileInput): Promise<KanbanAttachment> => {
			const fileId = await upload(file);
			return (await api.kanban.attachFile.mutate({ taskId, fileId })).data;
		},
	});
}

export interface CommentWithFilesInput {
	readonly taskId: string;
	readonly body: string;
	readonly files: readonly File[];
	/** One key per comment draft: a retry never posts the comment twice. */
	readonly idempotencyKey: string;
}

/**
 * Posts a comment with its files: uploads each file (one after another, so a
 * refused file stops the rest), then `POST …/comments` with their ids — the
 * API binds them with the comment in one transaction. Errors: the uploads', or an `ApiError`.
 */
export function useCommentWithFiles(): UseMutationResult<KanbanComment, Error, CommentWithFilesInput> {
	const { api } = useAuth();
	const upload = useUploadKanbanFile();
	return useMutation({
		mutationFn: async ({ taskId, body, files, idempotencyKey }: CommentWithFilesInput): Promise<KanbanComment> => {
			const fileIds: string[] = [];
			for (const file of files) {
				fileIds.push(await upload(file));
			}
			return (await api.kanban.addComment.mutate({ taskId, body, fileIds }, { headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey } })).data;
		},
	});
}
