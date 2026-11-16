import { Bubble } from "@workspace/ui-native/components/bubble";
import { Message } from "@workspace/ui-native/components/message";
import * as React from "react";
import { Text, View } from "react-native";

function Header({ name, time }: { readonly name: string; readonly time: string }): React.JSX.Element {
	return (
		<>
			<Text className="text-caption font-sans-medium text-foreground">{name}</Text>
			<Text accessibilityElementsHidden importantForAccessibility="no" className="text-caption text-muted-foreground">
				·
			</Text>
			<Text className="text-caption font-sans text-muted-foreground">{time}</Text>
		</>
	);
}

// A name and time header split by a decorative dot, a Read receipt under the sent turn, and an Edited note.
export function Message3Example(): React.JSX.Element {
	return (
		<View className="w-full gap-3">
			<Message header={<Header name="Ava Patel" time="10:02" />} footer={<Text className="text-caption font-sans text-muted-foreground">Edited</Text>}>
				<Bubble text="Updated the deck with the Q3 numbers." />
			</Message>
			<Message variant="sent" header={<Header name="You" time="10:04" />} footer={<Text className="text-caption font-sans text-muted-foreground">Read</Text>}>
				<Bubble variant="sent" text="Thanks, looks great." />
			</Message>
		</View>
	);
}
