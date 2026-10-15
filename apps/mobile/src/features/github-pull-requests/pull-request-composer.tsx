// ============================================
// Writing on a pull request (ADR 052) — synced to GitHub
// ============================================
// The comment box under the conversation, and "Review changes": GitHub's own
// three verdicts (comment, approve, request changes) with a summary. Both are
// posted to GitHub as the admin's linked account; the text is checked with the
// same shared schema the API checks. Each send carries an Idempotency-Key
// (lib/idempotency-keys.ts), so retrying after a dropped connection never posts
// twice. On success the pull request's views reload, so the new comment or
// review shows in the conversation. "Add a picture" uploads a photo and adds
// its markdown to the text (use-comment-image-attach.ts); sending waits until
// the upload is done, so an "Uploading…" line is never posted.

import { useQueryClient } from "@tanstack/react-query";
import {
	AddGithubPullRequestCommentSchema,
	SubmitGithubPullRequestReviewSchema,
	type GithubActor,
	type GithubPullRequestParams,
	type GithubReviewEvent,
} from "@workspace/shared";
import ImagePlusIcon from "lucide-react-native/icons/image-plus";
import * as React from "react";
import { View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Banner } from "../../components/banner";
import { BottomSheet, SheetOptionRow } from "../../components/bottom-sheet";
import { Button } from "../../components/button";
import { IconButton } from "../../components/icon-button";
import { MutedText } from "../../components/text";
import { TextField } from "../../components/text-field";
import { TimelineRailItem } from "../../components/timeline-rail";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { useIdempotencyKeys } from "../../lib/idempotency-keys";
import { useToast } from "../toast/facade";
import { COMMENT_POSTED_MESSAGE, loginOf, OWN_PULL_REQUEST_REVIEW_NOTE, REVIEW_EVENT_OPTIONS, REVIEW_SUBMITTED_MESSAGE, type ReviewEventOption } from "./labels";
import { refreshPullRequest } from "./refresh";
import { useCommentImageAttach, type CommentImageAttach } from "./use-comment-image-attach";

interface AddPictureButtonProps {
	readonly attach: CommentImageAttach;
	readonly testID: string;
}

/** "Add a picture": opens the photo library; spins while the picked one uploads. */
function AddPictureButton({ attach, testID }: AddPictureButtonProps): React.JSX.Element {
	return (
		<IconButton
			icon={ImagePlusIcon}
			label="Add a picture"
			accessibilityHint="Uploads a photo and adds it to your text"
			onPress={attach.attach}
			loading={attach.isUploading}
			testID={testID}
		/>
	);
}

/** The first message of a failed parse, for the field under it. */
function firstIssue(result: { readonly success: false; readonly error: { readonly issues: readonly { readonly message: string }[] } }): string {
	const [issue] = result.error.issues;
	return issue?.message ?? "Check what you wrote.";
}

export interface CommentComposerProps {
	readonly pullRequest: GithubPullRequestParams;
	/** The linked GitHub account — its avatar is the composer's node on the conversation's line. */
	readonly viewer: GithubActor | null;
	/** Opens "Review changes" beside "Comment"; absent once the pull request is closed or merged. */
	readonly onReview?: (() => void) | undefined;
}

/** "Add a comment" at the end of the conversation, with "Review changes" beside "Comment". */
export function CommentComposer({ pullRequest, viewer, onReview }: CommentComposerProps): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const toast = useToast();
	const keys = useIdempotencyKeys();
	const addComment = api.githubPullRequests.addComment.useIdempotentMutation();
	const [body, setBody] = React.useState("");
	const [fieldError, setFieldError] = React.useState<string | undefined>(undefined);
	const [requestError, setRequestError] = React.useState<string | null>(null);
	const picture = useCommentImageAttach(pullRequest, setBody);

	const change = React.useCallback((next: string): void => {
		setBody(next);
		setFieldError(undefined);
	}, []);
	const submit = React.useCallback((): void => {
		const parsed = AddGithubPullRequestCommentSchema.safeParse({ body });
		if (!parsed.success) {
			setFieldError(firstIssue(parsed));
			return;
		}
		setRequestError(null);
		const input = { ...pullRequest, ...parsed.data };
		addComment
			.mutateAsync({ input, idempotencyKey: keys.keyFor(JSON.stringify(parsed.data)) })
			.then(async (): Promise<void> => {
				keys.spend();
				setBody("");
				toast.success(COMMENT_POSTED_MESSAGE);
				await refreshPullRequest(queryClient, pullRequest);
			})
			.catch((error: unknown): void => {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			});
	}, [addComment, body, keys, pullRequest, queryClient, toast]);

	return (
		<TimelineRailItem node={<Avatar name={loginOf(viewer)} imageUrl={viewer?.avatarUrl ?? null} size="md" />} isLast testID="pull-request-comment-composer">
			<View className="gap-3 rounded-xl border border-border bg-card p-3">
				{requestError === null ? null : <Banner tone="error" message={requestError} />}
				{picture.error === null ? null : <Banner tone="error" message={picture.error} />}
				<TextField
					label="Add a comment"
					value={body}
					onChange={change}
					error={fieldError}
					placeholder="Leave a comment"
					multiline
					autoCapitalize="sentences"
					testID="pull-request-comment-field"
				/>
				{/* Tools for the text sit on their own row, so the two actions below always keep their full labels. */}
				<View className="flex-row gap-2">
					<AddPictureButton attach={picture} testID="pull-request-comment-picture" />
				</View>
				<View className="flex-row gap-3">
					{/* Its own width, so its label stays on one line on any screen; "Comment" takes the rest. */}
					{onReview === undefined ? null : (
						<Button label="Review changes" variant="secondary" onPress={onReview} accessibilityHint="Comment, approve or request changes" testID="pull-request-review" />
					)}
					<View className="flex-1">
						<Button
							label="Comment"
							onPress={submit}
							loading={addComment.isPending}
							disabled={picture.isUploading}
							accessibilityHint="Posts your comment to GitHub"
							testID="pull-request-comment-submit"
						/>
					</View>
				</View>
			</View>
		</TimelineRailItem>
	);
}

export interface ReviewSheetProps {
	readonly pullRequest: GithubPullRequestParams;
	readonly visible: boolean;
	/** GitHub does not let an author approve or request changes on their own pull request. */
	readonly viewerDidAuthor: boolean;
	readonly onClose: () => void;
}

/** "Review changes": a summary and a verdict, submitted to GitHub at once. */
export function ReviewSheet({ pullRequest, visible, viewerDidAuthor, onClose }: ReviewSheetProps): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const toast = useToast();
	const keys = useIdempotencyKeys();
	const submitReview = api.githubPullRequests.submitReview.useIdempotentMutation();
	const [event, setEvent] = React.useState<GithubReviewEvent>("comment");
	const [body, setBody] = React.useState("");
	const [fieldError, setFieldError] = React.useState<string | undefined>(undefined);
	const [requestError, setRequestError] = React.useState<string | null>(null);
	const picture = useCommentImageAttach(pullRequest, setBody);
	const options = viewerDidAuthor ? REVIEW_EVENT_OPTIONS.filter((option: ReviewEventOption): boolean => option.value === "comment") : REVIEW_EVENT_OPTIONS;

	const changeBody = React.useCallback((next: string): void => {
		setBody(next);
		setFieldError(undefined);
	}, []);
	const choose = React.useCallback((next: GithubReviewEvent): void => {
		setEvent(next);
		setFieldError(undefined);
	}, []);
	const submit = React.useCallback((): void => {
		const parsed = SubmitGithubPullRequestReviewSchema.safeParse({ event, body });
		if (!parsed.success) {
			setFieldError(firstIssue(parsed));
			return;
		}
		setRequestError(null);
		const input = { ...pullRequest, ...parsed.data };
		submitReview
			.mutateAsync({ input, idempotencyKey: keys.keyFor(JSON.stringify(parsed.data)) })
			.then(async (): Promise<void> => {
				keys.spend();
				setBody("");
				setEvent("comment");
				onClose();
				toast.success(REVIEW_SUBMITTED_MESSAGE);
				await refreshPullRequest(queryClient, pullRequest);
			})
			.catch((error: unknown): void => {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			});
	}, [body, event, keys, onClose, pullRequest, queryClient, submitReview, toast]);

	return (
		<BottomSheet visible={visible} title="Review changes" onClose={onClose} testID="pull-request-review-sheet">
			<View className="gap-3">
				{requestError === null ? null : <Banner tone="error" message={requestError} />}
				{picture.error === null ? null : <Banner tone="error" message={picture.error} />}
				<TextField
					label="Summary"
					value={body}
					onChange={changeBody}
					error={fieldError}
					placeholder={event === "approve" ? "Optional" : "Leave a comment"}
					multiline
					autoCapitalize="sentences"
					testID="pull-request-review-field"
				/>
				<View>
					{options.map((option: ReviewEventOption): React.JSX.Element => (
						<SheetOptionRow
							key={option.value}
							value={option.value}
							label={option.label}
							description={option.description}
							selected={option.value === event}
							onSelect={choose}
						/>
					))}
				</View>
				{viewerDidAuthor ? <MutedText>{OWN_PULL_REQUEST_REVIEW_NOTE}</MutedText> : null}
				<View className="flex-row gap-2">
					<AddPictureButton attach={picture} testID="pull-request-review-picture" />
				</View>
				<Button
					label="Submit review"
					onPress={submit}
					loading={submitReview.isPending}
					disabled={picture.isUploading}
					accessibilityHint="Submits your review to GitHub"
					testID="pull-request-review-submit"
				/>
			</View>
		</BottomSheet>
	);
}
