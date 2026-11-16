import CheckIcon from "lucide-react-native/icons/check";
import XIcon from "lucide-react-native/icons/x";
import { Badge } from "@workspace/ui-native/components/badge";
import { TimelineRailIcon, TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
import * as React from "react";
import { Text, View } from "react-native";

interface Entry {
	readonly key: string;
	readonly ok: boolean;
	readonly env: string;
	readonly commit: string;
	readonly branch: string;
	readonly duration: string;
}

const ENTRIES: readonly Entry[] = [
	{ key: "d1", ok: true, env: "Production", commit: "a1b2c3d", branch: "main", duration: "1m 12s" },
	{ key: "d2", ok: false, env: "Preview", commit: "9f8e7d6", branch: "feat/billing", duration: "38s" },
	{ key: "d3", ok: true, env: "Preview", commit: "4c5d6e7", branch: "feat/charts", duration: "1m 02s" },
];
export function Timeline10Example(): React.JSX.Element {
	return (
		<View>
			{ENTRIES.map((entry: Entry, index: number): React.JSX.Element => (
				<TimelineRailItem
					key={entry.key}
					node={<TimelineRailIcon icon={entry.ok ? CheckIcon : XIcon} tone={entry.ok ? "success" : "danger"} size="sm" />}
					isLast={index === ENTRIES.length - 1}>
					<View className="flex-row items-center gap-2">
						<Text className="text-body font-sans-semibold text-foreground">{entry.env}</Text>
						<Badge label={entry.ok ? "Ready" : "Failed"} tone={entry.ok ? "success" : "destructive"} size="sm" />
					</View>
					<Text className="text-caption font-mono text-muted-foreground">{`${entry.commit} · ${entry.branch} · ${entry.duration}`}</Text>
				</TimelineRailItem>
			))}
		</View>
	);
}
