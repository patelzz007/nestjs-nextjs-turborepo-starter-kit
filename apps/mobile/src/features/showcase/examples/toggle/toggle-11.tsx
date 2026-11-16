import BookmarkIcon from "lucide-react-native/icons/bookmark";
import HeartIcon from "lucide-react-native/icons/heart";
import Repeat2Icon from "lucide-react-native/icons/repeat-2";
import Share2Icon from "lucide-react-native/icons/share-2";
import { Toggle } from "@workspace/ui-native/components/toggle";
import { type LucideIcon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { Text, View } from "react-native";

interface Reaction {
	readonly label: string;
	readonly icon: LucideIcon;
	readonly count: number;
}

const REACTIONS: readonly Reaction[] = [
	{ label: "Like", icon: HeartIcon, count: 128 },
	{ label: "Repost", icon: Repeat2Icon, count: 24 },
	{ label: "Share", icon: Share2Icon, count: 9 },
	{ label: "Bookmark", icon: BookmarkIcon, count: 31 },
];

function ReactionToggle({ reaction }: { readonly reaction: Reaction }): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(false);
	const count = reaction.count + (pressed ? 1 : 0);
	return (
		<Toggle
			label={reaction.label}
			icon={reaction.icon}
			hideLabel
			variant="outline"
			accessibilityHint={`${String(count)} so far`}
			trailing={<Text className="text-caption font-sans text-muted-foreground tabular-nums">{count}</Text>}
			pressed={pressed}
			onChange={setPressed}
		/>
	);
}

export function Toggle11Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-2">
			{REACTIONS.map((reaction: Reaction): React.JSX.Element => (
				<ReactionToggle key={reaction.label} reaction={reaction} />
			))}
		</View>
	);
}
