// The small pieces every pull-request screen shares, as GitHub's app draws
// them: the state pill (green open, grey draft, purple merged, red closed), the
// state glyph alone (a list row's leading icon), and a label in its own colour.
// Presentational.

import type { GithubLabel } from "@workspace/shared";
import GitMergeIcon from "lucide-react-native/icons/git-merge";
import GitPullRequestIcon from "lucide-react-native/icons/git-pull-request";
import GitPullRequestClosedIcon from "lucide-react-native/icons/git-pull-request-closed";
import GitPullRequestDraftIcon from "lucide-react-native/icons/git-pull-request-draft";
import * as React from "react";
import { Text, View } from "react-native";

import { Icon, type LucideIcon } from "../../components/icon";
import { labelColors } from "./label-colors";
import { DISPLAY_STATE_LABELS, type PullRequestDisplayState } from "./labels";

interface StateStyle {
	readonly icon: LucideIcon;
	/** The pill's solid fill. */
	readonly fill: string;
	/** The glyph's colour on its own. */
	readonly glyph: string;
}

const STATE_STYLES: Readonly<Record<PullRequestDisplayState, StateStyle>> = {
	open: { icon: GitPullRequestIcon, fill: "bg-success", glyph: "accent-success-foreground" },
	draft: { icon: GitPullRequestDraftIcon, fill: "bg-muted-foreground", glyph: "accent-muted-foreground" },
	merged: { icon: GitMergeIcon, fill: "bg-tone-violet", glyph: "accent-tone-violet" },
	closed: { icon: GitPullRequestClosedIcon, fill: "bg-destructive", glyph: "accent-destructive-foreground" },
};

export interface PullRequestStatePillProps {
	readonly state: PullRequestDisplayState;
	readonly testID?: string;
}

/** "Open", "Draft", "Merged" or "Closed" on its solid colour, with its glyph. */
export function PullRequestStatePill({ state, testID }: PullRequestStatePillProps): React.JSX.Element {
	const style = STATE_STYLES[state];
	const label = DISPLAY_STATE_LABELS[state];
	return (
		<View accessible accessibilityLabel={label} testID={testID} className={`flex-row items-center gap-1.5 self-start rounded-full px-3 py-1 ${style.fill}`}>
			<Icon icon={style.icon} size="sm" colorClassName="accent-status-foreground" />
			<Text className="font-sans-semibold text-sm text-status-foreground">{label}</Text>
		</View>
	);
}

/** The state's glyph alone, in its colour — a list row's leading icon. */
export function PullRequestStateGlyph({ state }: { readonly state: PullRequestDisplayState }): React.JSX.Element {
	const style = STATE_STYLES[state];
	return (
		<View accessible accessibilityLabel={DISPLAY_STATE_LABELS[state]}>
			<Icon icon={style.icon} size="md" colorClassName={style.glyph} />
		</View>
	);
}

/** A label in its GitHub colour; the text is black or white, whichever reads. */
export function LabelChip({ label }: { readonly label: GithubLabel }): React.JSX.Element {
	const colors = labelColors(label.color);
	return (
		// The colours are GitHub data, not design tokens: they are set inline.
		<View accessible accessibilityLabel={`Label ${label.name}`} className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: colors.background }}>
			<Text className="font-sans-medium text-xs" style={{ color: colors.text }}>
				{label.name}
			</Text>
		</View>
	);
}
