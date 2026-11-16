import CheckIcon from "lucide-react-native/icons/check";
import CircleIcon from "lucide-react-native/icons/circle";
import PlayIcon from "lucide-react-native/icons/play";
import { Badge } from "@workspace/ui-native/components/badge";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { TimelineRailIcon, TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
import * as React from "react";
import { Text, View } from "react-native";

interface Version {
	readonly key: string;
	readonly version: string;
	readonly icon: LucideIcon;
	readonly current: boolean;
}

const VERSIONS: readonly Version[] = [
	{ key: "v1", version: "v1.0", icon: CheckIcon, current: false },
	{ key: "v2", version: "v2.0", icon: CheckIcon, current: false },
	{ key: "v3", version: "v3.0", icon: PlayIcon, current: true },
	{ key: "v4", version: "v4.0", icon: CircleIcon, current: false },
];

export function Timeline12Example(): React.JSX.Element {
	return (
		<View className="flex-row">
			{VERSIONS.map((version: Version, index: number): React.JSX.Element => (
				<TimelineRailItem
					key={version.key}
					orientation="horizontal"
					isLast={index === VERSIONS.length - 1}
					node={<TimelineRailIcon icon={version.icon} tone={version.icon === CheckIcon ? "success" : version.current ? "attention" : "neutral"} size="sm" />}>
					<Text className="text-body font-sans-semibold text-foreground">{version.version}</Text>
					{version.current ? <Badge label="Current" tone="info" size="sm" className="self-start" /> : null}
				</TimelineRailItem>
			))}
		</View>
	);
}
