// ============================================
// merge-sheet.tsx - Merging a pull request, as GitHub's merge box does (ADR 052)
// ============================================
// The repository's merge methods (merge commit, squash, rebase — only those it
// allows), the commit title GitHub would write (editable; a rebase makes no
// commit of its own), an optional message, and "Delete branch … after merge"
// (only a branch of this repository). The merge is pinned to the head commit
// the merge box read, so commits pushed after it are never merged unseen; it
// carries an Idempotency-Key, so retrying never merges twice. Deleting the
// branch never undoes the merge: if GitHub keeps it, the reason is shown.

import { useQueryClient } from "@tanstack/react-query";
import { MergeGithubPullRequestSchema, type GithubMergeMethod, type GithubMergeOptions, type GithubPullRequestParams } from "@workspace/shared";
import * as React from "react";
import { View } from "react-native";

import { Alert } from "@workspace/ui-native/components/alert";
import { BottomSheet, SheetOptionRow } from "@workspace/ui-native/components/bottom-sheet";
import { Button } from "@workspace/ui-native/components/button";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { MutedText } from "@workspace/ui-native/components/text";
import { TextField } from "@workspace/ui-native/components/text-field";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { useIdempotencyKeys } from "../../lib/idempotency-keys";
import { useToast } from "../toast/facade";
import { defaultMergeTitle, MERGE_METHOD_LABELS, mergedMessage } from "./labels";
import { refreshPullRequest } from "./refresh";

export interface MergeSheetProps {
	readonly pullRequest: GithubPullRequestParams;
	readonly title: string;
	/** Whose repository the head branch is in (its own, unless a fork). */
	readonly headOwner: string;
	readonly options: GithubMergeOptions;
	readonly visible: boolean;
	readonly onClose: () => void;
}

export function MergeSheet({ pullRequest, title, headOwner, options, visible, onClose }: MergeSheetProps): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const toast = useToast();
	const keys = useIdempotencyKeys();
	const merge = api.githubPullRequests.merge.useIdempotentMutation();
	const initialMethod: GithubMergeMethod = options.defaultMethod ?? options.methods.at(0) ?? "merge";
	const titleFor = React.useCallback(
		(method: GithubMergeMethod): string => defaultMergeTitle(method, { number: pullRequest.number, title, headOwner, headBranch: options.headBranch }),
		[headOwner, options.headBranch, pullRequest.number, title],
	);
	const [method, setMethod] = React.useState<GithubMergeMethod>(initialMethod);
	const [commitTitle, setCommitTitle] = React.useState(titleFor(initialMethod));
	const [commitMessage, setCommitMessage] = React.useState("");
	const [deleteBranch, setDeleteBranch] = React.useState(options.canDeleteHeadBranch);
	const [requestError, setRequestError] = React.useState<string | null>(null);

	const choose = React.useCallback(
		(next: GithubMergeMethod): void => {
			setMethod(next);
			setCommitTitle(titleFor(next));
			setRequestError(null);
		},
		[titleFor],
	);
	const submit = React.useCallback((): void => {
		const parsed = MergeGithubPullRequestSchema.safeParse({
			method,
			expectedHeadSha: options.headSha,
			commitTitle,
			commitMessage,
			deleteBranch: deleteBranch && options.canDeleteHeadBranch,
		});
		if (!parsed.success) {
			setRequestError(parsed.error.issues.at(0)?.message ?? "Check the commit title and message.");
			return;
		}
		setRequestError(null);
		merge
			.mutateAsync({ input: { ...pullRequest, ...parsed.data }, idempotencyKey: keys.keyFor(JSON.stringify(parsed.data)) })
			.then(async (answer): Promise<void> => {
				keys.spend();
				onClose();
				toast.success(mergedMessage(answer.data, options.headBranch));
				if (answer.data.branch.outcome === "failed") {
					toast.error(`The branch was kept: ${answer.data.branch.reason}`);
				}
				await refreshPullRequest(queryClient, pullRequest);
			})
			.catch((error: unknown): void => {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			});
	}, [commitMessage, commitTitle, deleteBranch, keys, merge, method, onClose, options, pullRequest, queryClient, toast]);

	return (
		<BottomSheet visible={visible} title="Merge pull request" onClose={onClose} testID="pull-request-merge-sheet">
			<View className="gap-3">
				{requestError === null ? null : <Alert tone="error" message={requestError} />}
				<View>
					{options.methods.map((each: GithubMergeMethod): React.JSX.Element => (
						<SheetOptionRow
							key={each}
							value={each}
							label={MERGE_METHOD_LABELS[each].label}
							description={MERGE_METHOD_LABELS[each].description}
							selected={each === method}
							onSelect={choose}
						/>
					))}
				</View>
				{method === "rebase" ? null : (
					<>
						<TextField label="Commit title" value={commitTitle} onChange={setCommitTitle} autoCapitalize="sentences" testID="pull-request-merge-title" />
						<TextField
							label="Commit message"
							value={commitMessage}
							onChange={setCommitMessage}
							placeholder="Optional — GitHub writes one when empty"
							multiline
							autoCapitalize="sentences"
							testID="pull-request-merge-message"
						/>
					</>
				)}
				{options.canDeleteHeadBranch ? (
					<Checkbox label={`Delete branch ${options.headBranch} after merge`} checked={deleteBranch} onChange={setDeleteBranch} testID="pull-request-merge-delete-branch" />
				) : (
					<MutedText>{`The branch ${options.headBranch} is in a fork, so it stays.`}</MutedText>
				)}
				<Button
					label={MERGE_METHOD_LABELS[method].confirm}
					onPress={submit}
					loading={merge.isPending}
					accessibilityHint="Merges the pull request on GitHub"
					testID="pull-request-merge-confirm"
				/>
			</View>
		</BottomSheet>
	);
}
