import { Bubble, type BubbleReaction } from "@workspace/ui-native/components/bubble";
import { Card, CardContent } from "@workspace/ui-native/components/card";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import SmilePlusIcon from "lucide-react-native/icons/smile-plus";
import * as React from "react";
import { View } from "react-native";

const STATIC: readonly BubbleReaction[] = [
	{ key: "party", emoji: "🎉", count: 4, label: "4 people reacted with party popper" },
	{ key: "eyes", emoji: "👀", count: 2, label: "2 people reacted with eyes" },
];

// Emoji pills hanging off the bubble's edge, and a button that adds yours.
export function Bubble4Example(): React.JSX.Element {
	const [mine, setMine] = React.useState(false);
	const toggle = React.useCallback((): void => {
		setMine((current: boolean): boolean => !current);
	}, []);
	const reactions = mine ? [...STATIC, { key: "mine", emoji: "👍", label: "You reacted with thumbs up" }] : STATIC;
	return (
		<Card className="w-full">
			<CardContent className="gap-4 pt-4">
				<Bubble text="We just crossed 10,000 customers!" reactions={STATIC} />
				<View className="flex-row items-end gap-1 self-end">
					<IconButton icon={SmilePlusIcon} label={mine ? "Remove your reaction" : "Add a reaction"} onPress={toggle} variant="ghost" size="sm" />
					<Bubble text="Amazing work, team." variant="sent" reactions={reactions.filter((reaction) => reaction.key === "mine")} />
				</View>
			</CardContent>
		</Card>
	);
}
