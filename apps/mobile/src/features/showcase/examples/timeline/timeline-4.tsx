import GitForkIcon from "lucide-react-native/icons/git-fork";
import GitMergeIcon from "lucide-react-native/icons/git-merge";
import GitPullRequestIcon from "lucide-react-native/icons/git-pull-request";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { TimelineRailIcon, TimelineRailItem, type TimelineRailTone } from "@workspace/ui-native/components/timeline-rail";
import * as React from "react";
import { Text, View } from "react-native";

interface Entry {
	readonly key: string;
	readonly icon: LucideIcon;
	readonly title: string;
	readonly text: string;
	readonly when: string;
	readonly tone: TimelineRailTone;
}

const ENTRIES: readonly Entry[] = [
	{ key: "fork", icon: GitForkIcon, title: "Forked the repository", text: "acme/web → ava/web", when: "3 days ago", tone: "neutral" },
	{ key: "pr", icon: GitPullRequestIcon, title: "Opened a pull request", text: "#482 Add dark mode", when: "2 days ago", tone: "attention" },
	{ key: "merge", icon: GitMergeIcon, title: "Merged", text: "#482 into main", when: "Yesterday", tone: "done" },
];
export function Timeline4Example(): React.JSX.Element {
	return (
		<View>
			{ENTRIES.map((entry: Entry, index: number): React.JSX.Element => (
				<TimelineRailItem key={entry.key} node={<TimelineRailIcon icon={entry.icon} tone={entry.tone} />} isLast={index === ENTRIES.length - 1}>
					<Text className="text-body font-sans-semibold text-foreground">{entry.title}</Text>
					<Text className="text-body font-mono text-muted-foreground">{entry.text}</Text>
					<Text className="text-caption font-sans text-muted-foreground">{entry.when}</Text>
				</TimelineRailItem>
			))}
		</View>
	);
}
