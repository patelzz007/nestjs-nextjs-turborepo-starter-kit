// GitHub's merge box, read live (GET …/:number/status): whether a review is
// still needed, where the head commit's checks stand ("All checks have
// passed"), and whether the branch merges cleanly ("No conflicts with base
// branch"). Each row is tinted like the app's toasts and says its state in
// words with its own glyph, never by colour alone. Its own read, so slow
// checks never hold up the conversation. Under the rows, "Merge pull request"
// opens the merge sheet (merge-sheet.tsx) — or says why merging is not offered.

import type { GithubPullRequestParams, GithubReviewDecision } from "@workspace/shared";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleDotIcon from "lucide-react-native/icons/circle-dot";
import CircleXIcon from "lucide-react-native/icons/circle-x";
import GitMergeIcon from "lucide-react-native/icons/git-merge";
import * as React from "react";
import { Text, View } from "react-native";

import { Button } from "../../components/button";
import { Icon, type LucideIcon } from "../../components/icon";
import { MutedText } from "../../components/text";
import { Banner } from "../../components/banner";
import { Skeleton, SkeletonGroup } from "../../components/skeleton";
import { TimelineRailIcon, TimelineRailItem } from "../../components/timeline-rail";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { checksLine, mergeabilityLine, mergeUnavailableReason, reviewLine, type MergeBoxLine } from "./labels";
import { MergeSheet } from "./merge-sheet";

/** Each row as the app's toasts look: a soft fill, a slightly darker border of the same tone, and a glyph of its own. */
const LINE_STYLES: Readonly<Record<MergeBoxLine["tone"], { readonly icon: LucideIcon; readonly iconColor: string; readonly box: string }>> = {
	success: { icon: CircleCheckIcon, iconColor: "accent-tone-green", box: "border-tone-green/30 bg-tone-green-soft" },
	danger: { icon: CircleXIcon, iconColor: "accent-tone-red", box: "border-tone-red/30 bg-tone-red-soft" },
	attention: { icon: CircleDotIcon, iconColor: "accent-tone-yellow", box: "border-tone-yellow/30 bg-tone-yellow-soft" },
};

export interface MergeBoxProps {
	readonly pullRequest: GithubPullRequestParams;
	readonly reviewDecision: GithubReviewDecision | null;
	/** The pull request's title — GitHub's suggested squash commit title is built from it. */
	readonly title: string;
	/** Whose repository the head branch is in. */
	readonly headOwner: string;
}

export function MergeBox({ pullRequest, reviewDecision, title, headOwner }: MergeBoxProps): React.JSX.Element {
	const api = useApi();
	const status = api.githubPullRequests.status.useQuery(pullRequest);
	const data = status.data?.data;
	const [merging, setMerging] = React.useState(false);
	const openMerge = React.useCallback((): void => {
		setMerging(true);
	}, []);
	const closeMerge = React.useCallback((): void => {
		setMerging(false);
	}, []);
	const unavailable = data === undefined ? null : mergeUnavailableReason(data.merge.state, data.mergeability, data.merge.methods);
	const lines =
		data === undefined ? [] : [reviewLine(reviewDecision), checksLine(data.checks), mergeabilityLine(data.mergeability)].filter((line): line is MergeBoxLine => line !== null);

	return (
		<TimelineRailItem node={<TimelineRailIcon icon={GitMergeIcon} />} testID="pull-request-merge-box">
			<View className="gap-2">
				{status.isPending ? (
					<SkeletonGroup accessibilityLabel="Loading the checks and conflicts" className="gap-2">
						<Skeleton className="h-16 w-full rounded-xl" />
						<Skeleton className="h-16 w-full rounded-xl" />
					</SkeletonGroup>
				) : null}
				{status.isError ? <Banner tone="error" message={errorMessageOf(status.error)} /> : null}
				{lines.map((line: MergeBoxLine): React.JSX.Element => (
					<MergeBoxRow key={line.title} line={line} />
				))}
				{data === undefined ? null : unavailable === null ? (
					<Button label="Merge pull request" onPress={openMerge} accessibilityHint="Choose how to merge, then confirm" testID="pull-request-merge" />
				) : (
					<MutedText>{unavailable}</MutedText>
				)}
				{data === undefined ? null : <MergeSheet pullRequest={pullRequest} title={title} headOwner={headOwner} options={data.merge} visible={merging} onClose={closeMerge} />}
			</View>
		</TimelineRailItem>
	);
}

function MergeBoxRow({ line }: { readonly line: MergeBoxLine }): React.JSX.Element {
	const style = LINE_STYLES[line.tone];
	return (
		<View accessible accessibilityLabel={`${line.title}. ${line.detail}`} className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 ${style.box}`}>
			<Icon icon={style.icon} size="md" colorClassName={style.iconColor} />
			<View className="flex-1 gap-0.5">
				<Text className="font-sans-semibold text-sm text-foreground">{line.title}</Text>
				<Text className="font-sans text-sm text-muted-foreground">{line.detail}</Text>
			</View>
		</View>
	);
}
