// "Edited" on a comment opens this: every saved version, newest first, who
// saved it and when, and the text as it was — like GitHub's edit history. The
// versions are read only while the sheet is open (GET /github/content-edits/:id).

import type { GithubContentEdit } from "@workspace/shared";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";

import { Avatar } from "@workspace/ui-native/components/avatar";
import { BottomSheet } from "@workspace/ui-native/components/bottom-sheet";
import { Markdown } from "../../../components/markdown";
import { SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import { ErrorState } from "@workspace/ui-native/components/empty";
import { useApi } from "../../../lib/api-context";
import { errorMessageOf } from "../../../lib/error-messages";
import { editEntryLabel, loginOf } from "./labels";

export const EDIT_HISTORY_TITLE = "Edit history";
export const REMOVED_VERSION_MESSAGE = "This version was removed from the history.";

export interface EditHistorySheetProps {
	/** The comment, review or description whose versions are shown; `null` keeps the sheet closed. */
	readonly nodeId: string | null;
	readonly nowMs: number;
	readonly onClose: () => void;
}

export function EditHistorySheet({ nodeId, nowMs, onClose }: EditHistorySheetProps): React.JSX.Element {
	return (
		<BottomSheet visible={nodeId !== null} title={EDIT_HISTORY_TITLE} onClose={onClose} testID="edit-history-sheet">
			{nodeId === null ? null : <EditHistory nodeId={nodeId} nowMs={nowMs} />}
		</BottomSheet>
	);
}

function EditHistory({ nodeId, nowMs }: { readonly nodeId: string; readonly nowMs: number }): React.JSX.Element {
	const api = useApi();
	const history = api.githubPullRequests.contentEdits.useQuery({ nodeId });
	const retry = React.useCallback((): void => {
		void history.refetch();
	}, [history]);
	if (history.isPending) {
		return (
			<SkeletonGroup accessibilityLabel="Loading the edit history" className="gap-3">
				<SkeletonText size="sm" widthClassName="w-1/2" />
				<SkeletonText size="sm" widthClassName="w-3/4" />
			</SkeletonGroup>
		);
	}
	if (history.isError) {
		return <ErrorState message={errorMessageOf(history.error)} retryLabel="Try again" onRetry={retry} />;
	}
	const { edits, totalCount } = history.data.data;
	// The last version listed is the original only when GitHub returned the whole history.
	const lastIsOriginal = edits.length === totalCount;
	return (
		<ScrollView contentContainerClassName="gap-4 pb-2">
			{edits.map((edit: GithubContentEdit, index: number): React.JSX.Element => (
				// Versions are listed newest first and never reorder; GitHub gives them no id of their own.
				<View key={`${String(edit.editedAt)}-${String(index)}`} className="gap-2 border-b border-border pb-4">
					<View className="flex-row items-center gap-2">
						<Avatar name={loginOf(edit.editor)} imageUrl={edit.editor?.avatarUrl ?? null} size="sm" />
						<Text className="flex-1 font-sans text-sm text-muted-foreground">
							{editEntryLabel(edit.editor, edit.editedAt, nowMs)}
							{lastIsOriginal && index === edits.length - 1 ? " (original)" : ""}
						</Text>
					</View>
					{edit.body === null ? <Text className="font-sans text-sm text-muted-foreground italic">{REMOVED_VERSION_MESSAGE}</Text> : <Markdown source={edit.body} />}
				</View>
			))}
		</ScrollView>
	);
}
