import { Avatar } from "@workspace/ui-native/components/avatar";
import { Bubble } from "@workspace/ui-native/components/bubble";
import { Card, CardContent, CardHeader } from "@workspace/ui-native/components/card";
import * as React from "react";
import { Text, View } from "react-native";

interface Turn {
	readonly id: string;
	readonly from: "agent" | "customer";
	readonly text: string;
}

const THREAD: readonly Turn[] = [
	{ id: "1", from: "customer", text: "Hi! My order arrived damaged." },
	{ id: "2", from: "agent", text: "Sorry to hear that. Could you send a photo of the box?" },
	{ id: "3", from: "customer", text: "Sent it just now." },
	{ id: "4", from: "agent", text: "Thanks — a replacement ships today." },
];
const NAME = "Mia from Support";

// A support thread in a Card: an avatar and name header, each turn aligned to its sender and announced as theirs.
export function Bubble1Example(): React.JSX.Element {
	return (
		<Card className="w-full">
			<CardHeader>
				<View className="flex-row items-center gap-2.5">
					<Avatar name={NAME} imageUrl={null} size="md" />
					<Text className="text-body font-sans-medium text-foreground">{NAME}</Text>
				</View>
			</CardHeader>
			<CardContent className="gap-2">
				{THREAD.map((turn: Turn): React.JSX.Element => (
					<Bubble
						key={turn.id}
						text={turn.text}
						variant={turn.from === "customer" ? "sent" : "received"}
						accessibilityLabel={`${turn.from === "customer" ? "You" : NAME}: ${turn.text}`}
					/>
				))}
			</CardContent>
		</Card>
	);
}
