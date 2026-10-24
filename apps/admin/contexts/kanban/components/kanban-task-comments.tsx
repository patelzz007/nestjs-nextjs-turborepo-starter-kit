"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { readPaginatedHasNext, readPaginatedHasPrevious, readPaginatedTotal, readPaginatedTotalPages } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { KANBAN_COMMENT_BODY_MAX_LENGTH, KANBAN_COMMENT_FILE_LIMIT, newRowId, type KanbanAttachment, type KanbanComment, type KanbanPerson } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { ListPager } from "@workspace/ui/components/list-pager";
import { Textarea } from "@workspace/ui/components/textarea";
import { toastMessage } from "@workspace/ui/components/toast";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";
import { Download, FileText, Image as ImageIcon, Link2, MoreHorizontal, Paperclip, X } from "lucide-react";
import * as React from "react";

import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";
import { formatDateTime } from "@/lib/format/dates";

import { invalidateKanbanBoards } from "../lib/kanban-cache";
import { formatRelativeTime } from "../lib/kanban-display";
import { assertAttachmentAllowed, KANBAN_ATTACHMENT_ACCEPT, KanbanAttachmentRejectedError, useCommentWithFiles } from "../lib/use-attach-kanban-file";
import { useKanbanAttachmentDownload } from "../lib/use-kanban-attachment-download";
import { KanbanPageSection } from "./kanban-page-section";
import { KanbanPersonAvatar } from "./kanban-person";
import { KanbanPersonTimeline, KanbanPersonTimelineItem } from "./kanban-person-timeline";

/** Comments shown per page, newest first. */
const COMMENTS_PAGE_SIZE = 20;

const COMMENT_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_ATTACHMENT_LIMIT_REACHED: "This item already holds the most attachments it can.",
	KANBAN_ATTACHMENT_FILE_INVALID: "A file could not be attached. Upload it again.",
	KANBAN_TASK_NOT_FOUND: "This item was deleted.",
};

/** A file posted with a comment: its name, and a button that downloads it. */
function CommentFile({ taskId, attachment }: { readonly taskId: string; readonly attachment: KanbanAttachment }): React.JSX.Element {
	const { isDownloading, download } = useKanbanAttachmentDownload(taskId, attachment.id);
	const Icon = attachment.kind === "DOCUMENT" ? FileText : ImageIcon;
	return (
		<li>
			<Button variant="outline" size="sm" disabled={isDownloading} onClick={download} aria-label={`Download ${attachment.fileName}`}>
				<Icon data-icon="inline-start" />
				<span className="max-w-48 truncate">{attachment.fileName}</span>
				<Download data-icon="inline-end" />
			</Button>
		</li>
	);
}

/** A file picked for the next comment, with a button that drops it. */
function PickedFile({ file, index, onRemove }: { readonly file: File; readonly index: number; readonly onRemove: (index: number) => void }): React.JSX.Element {
	const handleRemove = React.useCallback((): void => {
		onRemove(index);
	}, [index, onRemove]);
	return (
		<li>
			<Badge variant="outline" className="gap-1 rounded-md py-1 pr-1 pl-2 font-normal">
				<Paperclip aria-hidden />
				<span className="max-w-48 truncate">{file.name}</span>
				<Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${file.name}`} onClick={handleRemove}>
					<X />
				</Button>
			</Badge>
		</li>
	);
}

/** One comment on the timeline: the author's avatar on the line, beside a card whose header names them and when they posted, with a menu; then the text and its files. */
function CommentItem({ comment, step, now }: { readonly comment: KanbanComment; readonly step: number; readonly now: number }): React.JSX.Element {
	const { copyToClipboard } = useCopyToClipboard({
		onCopy: (): void => {
			toastMessage.success({ title: "Link copied" });
		},
		onError: (): void => {
			toastMessage.error({ title: "Could not copy the link" });
		},
	});
	const anchor = `comment-${comment.id}`;
	const handleCopyLink = React.useCallback((): void => {
		copyToClipboard(new URL(`#${anchor}`, window.location.href).toString());
	}, [anchor, copyToClipboard]);
	return (
		<KanbanPersonTimelineItem step={step} person={comment.author} id={anchor}>
			<article aria-label={`Comment by ${comment.author.name}`} className="min-w-0 overflow-hidden rounded-lg border border-input bg-card">
				<header className="flex items-center gap-2 border-b border-input bg-muted/40 py-1 pr-1 pl-3.5">
					<span className="truncate text-sm font-medium">{comment.author.name}</span>
					<time dateTime={new Date(comment.createdAt).toISOString()} title={formatDateTime(comment.createdAt)} className="shrink-0 text-xs text-muted-foreground">
						{formatRelativeTime(comment.createdAt, now)}
					</time>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="ghost" size="icon-sm" className="ml-auto text-muted-foreground" aria-label={`Actions for the comment by ${comment.author.name}`} />}>
							<MoreHorizontal />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-40">
							<DropdownMenuItem onClick={handleCopyLink}>
								<Link2 />
								Copy link
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</header>
				<div className="flex flex-col gap-2 px-3.5 py-2.5">
					{comment.body.length > 0 ? <p className="text-sm leading-6 [overflow-wrap:anywhere] whitespace-pre-wrap">{comment.body}</p> : null}
					{comment.attachments.length > 0 ? (
						<ul aria-label={`Files posted by ${comment.author.name}`} className="flex flex-wrap gap-2">
							{comment.attachments.map((attachment) => (
								<CommentFile key={attachment.id} taskId={comment.taskId} attachment={attachment} />
							))}
						</ul>
					) : null}
				</div>
			</article>
		</KanbanPersonTimelineItem>
	);
}

export interface KanbanTaskCommentsProps {
	readonly taskId: string;
	/** UPDATE:KANBAN_TASK — write a comment. */
	readonly canComment: boolean;
}

/**
 * An item's discussion: pages of comments, newest first, each with the files
 * posted with it; and — with UPDATE — a box to add one, with text, files
 * (PDFs and images, up to `KANBAN_COMMENT_FILE_LIMIT`), or both.
 */
export function KanbanTaskComments({ taskId, canComment }: KanbanTaskCommentsProps): React.JSX.Element {
	const { api, user } = useAuth();
	const queryClient = useQueryClient();
	// Read once per render of the list: what "3 hours ago" counts from.
	const [now] = React.useState(Date.now);
	const me = React.useMemo((): KanbanPerson => ({ id: user?.id ?? "", name: user?.fullName ?? "" }), [user?.fullName, user?.id]);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const [page, setPage] = React.useState(1);
	const [body, setBody] = React.useState("");
	const [files, setFiles] = React.useState<readonly File[]>([]);
	const [idempotencyKey, setIdempotencyKey] = React.useState<string>(newRowId);
	const commentsQuery = api.kanban.comments.useQuery({ taskId, page, limit: COMMENTS_PAGE_SIZE });
	const comments = commentsQuery.data?.data ?? [];

	const addComment = useCommentWithFiles();

	const handleBodyChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setBody(event.target.value);
	}, []);
	const handlePick = React.useCallback((): void => {
		inputRef.current?.click();
	}, []);
	const handleFiles = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const picked = [...(event.target.files ?? [])];
			event.target.value = "";
			try {
				for (const file of picked) {
					assertAttachmentAllowed(file);
				}
			} catch (error) {
				toastMessage.error({ title: "Could not add the file", description: error instanceof KanbanAttachmentRejectedError ? error.message : "Pick a PDF or an image." });
				return;
			}
			const next = [...files, ...picked];
			if (next.length > KANBAN_COMMENT_FILE_LIMIT) {
				toastMessage.error({ title: "Too many files", description: `A comment carries at most ${String(KANBAN_COMMENT_FILE_LIMIT)} files.` });
				return;
			}
			setFiles(next);
		},
		[files],
	);
	const handleRemoveFile = React.useCallback((index: number): void => {
		setFiles((current) => current.filter((_, position) => position !== index));
	}, []);
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (body.trim().length === 0 && files.length === 0) {
				return;
			}
			addComment.mutate(
				{ taskId, body, files, idempotencyKey },
				{
					onSuccess: (): void => {
						setBody("");
						setFiles([]);
						setIdempotencyKey(newRowId());
						setPage(1);
						toastMessage.success({ title: "Comment added" });
						void Promise.all([queryClient.invalidateQueries({ queryKey: apiRouter.kanban.task.scopeKey({ taskId }) }), invalidateKanbanBoards(queryClient)]);
					},
					onError: (error: Error): void => {
						if (error instanceof KanbanAttachmentRejectedError) {
							toastMessage.error({ title: "Could not add the comment", description: error.message });
							return;
						}
						toastMutationError("Could not add the comment", error, COMMENT_ERROR_MESSAGES);
					},
				},
			);
		},
		[addComment, body, files, idempotencyKey, queryClient, taskId],
	);
	const handlePrevious = React.useCallback((): void => {
		setPage((current) => Math.max(1, current - 1));
	}, []);
	const handleNext = React.useCallback((): void => {
		setPage((current) => current + 1);
	}, []);
	const canPost = !addComment.isPending && (body.trim().length > 0 || files.length > 0);

	return (
		<KanbanPageSection title="Comments" note={commentsQuery.data === undefined ? undefined : String(readPaginatedTotal(commentsQuery.data.meta))}>
			{/* A thread reads best at a comfortable line length, even on the wide page. */}
			<div className="flex max-w-4xl flex-col gap-4">
				{canComment ? (
					<form className="flex gap-3" onSubmit={handleSubmit}>
						<span className="pt-1">
							<KanbanPersonAvatar person={me} size="default" />
						</span>
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<div className="overflow-hidden rounded-lg border border-input bg-card transition-colors focus-within:border-foreground/30">
								<div className="flex items-center gap-2 border-b border-input bg-muted/40 px-1.5 py-1">
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										className="text-muted-foreground"
										aria-label="Attach files"
										title={`Attach up to ${String(KANBAN_COMMENT_FILE_LIMIT)} PDFs or images`}
										disabled={files.length >= KANBAN_COMMENT_FILE_LIMIT || addComment.isPending}
										onClick={handlePick}>
										<Paperclip />
									</Button>
									<span className="text-xs text-muted-foreground">PDFs or images, up to {KANBAN_COMMENT_FILE_LIMIT}</span>
								</div>
								<Textarea
									value={body}
									onChange={handleBodyChange}
									placeholder="Add your comment here…"
									aria-label="Comment"
									maxLength={KANBAN_COMMENT_BODY_MAX_LENGTH}
									className="min-h-16 resize-none rounded-none border-0 bg-transparent px-3.5 py-2.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
								/>
								{files.length > 0 ? (
									<ul aria-label="Files to post" className="flex flex-wrap gap-2 px-3 pb-2.5">
										{files.map((file, index) => (
											<PickedFile key={`${file.name}:${String(file.size)}:${String(file.lastModified)}`} file={file} index={index} onRemove={handleRemoveFile} />
										))}
									</ul>
								) : null}
							</div>
							<input ref={inputRef} type="file" multiple accept={KANBAN_ATTACHMENT_ACCEPT} className="hidden" aria-label="Files for the comment" onChange={handleFiles} />
							<div className="flex justify-end">
								<Button type="submit" size="sm" disabled={!canPost}>
									{addComment.isPending ? (files.length > 0 ? "Uploading…" : "Posting…") : "Comment"}
								</Button>
							</div>
						</div>
					</form>
				) : null}
				{commentsQuery.isError ? <p className="text-sm text-destructive">Could not load the comments.</p> : null}
				{!commentsQuery.isError && comments.length === 0 && !commentsQuery.isLoading ? <p className="text-sm text-muted-foreground">No comments yet.</p> : null}
				{comments.length === 0 ? null : (
					<KanbanPersonTimeline label="Comments" count={comments.length}>
						{comments.map((comment, index) => (
							<CommentItem key={comment.id} comment={comment} step={index + 1} now={now} />
						))}
					</KanbanPersonTimeline>
				)}
				{readPaginatedTotalPages(commentsQuery.data?.meta) > 1 ? (
					<ListPager
						page={page}
						totalPages={readPaginatedTotalPages(commentsQuery.data?.meta)}
						hasPrevious={readPaginatedHasPrevious(commentsQuery.data?.meta)}
						hasNext={readPaginatedHasNext(commentsQuery.data?.meta)}
						onPrevious={handlePrevious}
						onNext={handleNext}
						disabled={commentsQuery.isFetching}
					/>
				) : null}
			</div>
		</KanbanPageSection>
	);
}
