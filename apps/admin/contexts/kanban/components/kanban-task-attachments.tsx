"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_SLOT_INDEX, type KanbanAttachment } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { toastMessage } from "@workspace/ui/components/toast";
import { Download, FileText, Image as ImageIcon, Paperclip, Trash2 } from "lucide-react";
import * as React from "react";

import { useResourceDeleteDialog } from "@/components/common/resource-delete-dialog";
import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";
import { formatDateTime } from "@/lib/format/dates";

import { invalidateKanbanBoards } from "../lib/kanban-cache";
import { KANBAN_ATTACHMENT_ACCEPT, KanbanAttachmentRejectedError, useAttachKanbanFile } from "../lib/use-attach-kanban-file";
import { useKanbanAttachmentDownload } from "../lib/use-kanban-attachment-download";
import { KanbanPageSection } from "./kanban-page-section";

const ATTACH_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_ATTACHMENT_LIMIT_REACHED: "This task already holds the most attachments it can.",
	KANBAN_ATTACHMENT_FILE_INVALID: "The file could not be attached. Upload it again.",
	KANBAN_TASK_NOT_FOUND: "This task was deleted.",
};

const BYTES_PER_KILOBYTE = 1024;

function formatSize(bytes: number): string {
	return bytes < BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE
		? `${String(Math.max(1, Math.round(bytes / BYTES_PER_KILOBYTE)))} KB`
		: `${(bytes / (BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE)).toFixed(1)} MB`;
}

interface AttachmentRowProps {
	readonly taskId: string;
	readonly attachment: KanbanAttachment;
	readonly canRemove: boolean;
	readonly onRemove: (attachment: KanbanAttachment) => void;
}

function AttachmentRow({ taskId, attachment, canRemove, onRemove }: AttachmentRowProps): React.JSX.Element {
	const { isDownloading, download: handleDownload } = useKanbanAttachmentDownload(taskId, attachment.id);
	const Icon = attachment.kind === "DOCUMENT" ? FileText : ImageIcon;
	const handleRemove = React.useCallback((): void => {
		onRemove(attachment);
	}, [attachment, onRemove]);

	return (
		<li className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
			<div className="flex min-w-0 items-center gap-3">
				<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
					<Icon aria-hidden className="size-4" />
				</span>
				<div className="min-w-0">
					<p className="truncate text-sm">{attachment.fileName}</p>
					<p className="truncate text-xs text-muted-foreground">
						{formatSize(attachment.sizeBytes)}, added by {attachment.uploadedBy.name} on {formatDateTime(attachment.createdAt)}
						{attachment.commentId === null ? null : ", with a comment"}
					</p>
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-1">
				<Button variant="ghost" size="icon-sm" aria-label={`Download ${attachment.fileName}`} disabled={isDownloading} onClick={handleDownload}>
					<Download />
				</Button>
				{canRemove ? (
					<Button variant="ghost" size="icon-sm" aria-label={`Remove ${attachment.fileName}`} onClick={handleRemove}>
						<Trash2 />
					</Button>
				) : null}
			</div>
		</li>
	);
}

export interface KanbanTaskAttachmentsProps {
	readonly taskId: string;
	/** Newest first, as the task answers them. */
	readonly attachments: readonly KanbanAttachment[];
	/** UPDATE:KANBAN_TASK — attach and remove. */
	readonly canEdit: boolean;
}

/** A task's files: download any, and — with UPDATE — attach PDFs and images or remove them. */
export function KanbanTaskAttachments({ taskId, attachments, canEdit }: KanbanTaskAttachmentsProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const inputRef = React.useRef<HTMLInputElement>(null);
	const { requestDelete, resourceDeleteDialog } = useResourceDeleteDialog();
	const attachFile = useAttachKanbanFile();

	const refresh = React.useCallback(async (): Promise<void> => {
		await Promise.all([queryClient.invalidateQueries({ queryKey: apiRouter.kanban.task.scopeKey({ taskId }) }), invalidateKanbanBoards(queryClient)]);
	}, [queryClient, taskId]);

	const removeAttachment = api.kanban.removeAttachment.useMutation({
		onSuccess: async () => {
			await refresh();
			toastMessage.success({ title: "Attachment removed" });
		},
		onError: (error) => {
			toastMutationError("Could not remove the attachment", error);
		},
	});

	const handlePick = React.useCallback((): void => {
		inputRef.current?.click();
	}, []);
	const handleFile = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const file = event.target.files?.[LIST_SLOT_INDEX.first];
			event.target.value = "";
			if (file === undefined) {
				return;
			}
			attachFile.mutate(
				{ taskId, file },
				{
					onSuccess: (attachment): void => {
						toastMessage.success({ title: "File attached", description: attachment.fileName });
						void refresh();
					},
					onError: (error): void => {
						if (error instanceof KanbanAttachmentRejectedError) {
							toastMessage.error({ title: "Could not attach the file", description: error.message });
							return;
						}
						toastMutationError("Could not attach the file", error, ATTACH_ERROR_MESSAGES);
					},
				},
			);
		},
		[attachFile, refresh, taskId],
	);
	const handleRemove = React.useCallback(
		(attachment: KanbanAttachment): void => {
			void requestDelete({
				title: `Remove "${attachment.fileName}"?`,
				description: "The file is deleted for everyone who can see this task.",
				onConfirm: async (): Promise<void> => {
					await removeAttachment.mutateAsync({ taskId, attachmentId: attachment.id });
				},
			});
		},
		[removeAttachment, requestDelete, taskId],
	);

	return (
		<KanbanPageSection
			title="Files"
			note={attachments.length === 0 ? undefined : String(attachments.length)}
			actions={
				canEdit ? (
					<>
						<input ref={inputRef} type="file" accept={KANBAN_ATTACHMENT_ACCEPT} className="hidden" aria-label="File to attach" onChange={handleFile} />
						<Button variant="ghost" size="sm" className="text-muted-foreground" disabled={attachFile.isPending} onClick={handlePick}>
							<Paperclip data-icon="inline-start" />
							{attachFile.isPending ? "Attaching…" : "Attach file"}
						</Button>
					</>
				) : undefined
			}>
			{attachments.length === 0 ? (
				<p className="text-sm text-muted-foreground">No files yet. PDFs count as documents, images as attachments.</p>
			) : (
				<ul className="flex flex-col">
					{attachments.map((attachment) => (
						<AttachmentRow key={attachment.id} taskId={taskId} attachment={attachment} canRemove={canEdit} onRemove={handleRemove} />
					))}
				</ul>
			)}
			{resourceDeleteDialog}
		</KanbanPageSection>
	);
}
