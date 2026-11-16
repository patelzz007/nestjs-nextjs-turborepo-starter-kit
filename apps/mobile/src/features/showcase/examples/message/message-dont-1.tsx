import { Bubble } from "@workspace/ui-native/components/bubble";
import { Message } from "@workspace/ui-native/components/message";
import * as React from "react";
import { View } from "react-native";

export function MessageDont1Example(): React.JSX.Element {
	return (
		<View className="w-full gap-2">
			<Message>
				<Bubble text="Standup moved to 10." />
			</Message>
			<Message>
				<Bubble text="Works for me." />
			</Message>
		</View>
	);
}
