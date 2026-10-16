// One changed file of a commit, as GitHub's file header draws it: a chevron,
// what happened to the file, its path (and the old path after a rename), the
// lines added and deleted with the diffstat — and, while expanded, its diff
// below. Presentational and controlled: the caller owns `expanded`, picks the
// icon and its colour, formats the counts and passes the body.

import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { DiffStat, type DiffStatBlocks } from "./diff-stat";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";

export interface ChangedFileProps {
	readonly path: string;
	/** The path before a rename or copy; `null` otherwise. */
	readonly previousPath: string | null;
	/** What happened to the file, in words ("Modified") — read by screen readers. */
	readonly statusLabel: string;
	readonly statusIcon: LucideIcon;
	/** An `accent-*` token utility for the status icon. */
	readonly statusColorClassName: string;
	/** Formatted counts ("1,204"). */
	readonly additions: string;
	readonly deletions: string;
	/** Read with the counts by screen readers ("12 lines added, 3 deleted"). */
	readonly changeSummary: string;
	readonly blocks: DiffStatBlocks;
	readonly expanded: boolean;
	readonly onToggle: () => void;
	/** The diff, or why there is none — shown while expanded. */
	readonly children: React.ReactNode;
	readonly testID?: string;
}

export function ChangedFile({
	path,
	previousPath,
	statusLabel,
	statusIcon,
	statusColorClassName,
	additions,
	deletions,
	changeSummary,
	blocks,
	expanded,
	onToggle,
	children,
	testID,
}: ChangedFileProps): React.JSX.Element {
	const renamed = previousPath === null ? "" : `, from ${previousPath}`;
	return (
		<View className="overflow-hidden rounded-lg border border-border bg-card" testID={testID}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${path}${renamed}. ${statusLabel}. ${changeSummary}`}
				accessibilityState={{ expanded }}
				accessibilityHint={expanded ? "Hides the changes" : "Shows the changes"}
				onPress={onToggle}
				className={`min-h-12 flex-row items-center gap-2 bg-muted px-3 py-2.5 active:opacity-70 ${expanded ? "border-b border-border" : ""}`}>
				<Icon icon={expanded ? ChevronDownIcon : ChevronRightIcon} size="sm" colorClassName="accent-muted-foreground" />
				<Icon icon={statusIcon} size="sm" colorClassName={statusColorClassName} />
				<View className="flex-1 gap-0.5" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
					<Text className="font-mono text-sm text-foreground" numberOfLines={2} ellipsizeMode="head">
						{path}
					</Text>
					{previousPath === null ? null : (
						<Text className="font-mono text-xs text-muted-foreground" numberOfLines={1} ellipsizeMode="head">
							{`from ${previousPath}`}
						</Text>
					)}
				</View>
				<View className="items-end gap-1" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
					<View className="flex-row gap-1.5">
						<Text className="font-mono text-xs text-success-foreground">+{additions}</Text>
						<Text className="font-mono text-xs text-destructive-foreground">−{deletions}</Text>
					</View>
					<DiffStat blocks={blocks} />
				</View>
			</Pressable>
			{expanded ? children : null}
		</View>
	);
}
