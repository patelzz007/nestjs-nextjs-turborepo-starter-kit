import { Bubble } from "@workspace/ui-native/components/bubble";
import { Message } from "@workspace/ui-native/components/message";
import * as React from "react";
import { Text } from "react-native";

export function MessageDont2Example(): React.JSX.Element {
	return (
		<Message variant="sent" footer={<Text className="text-body-lg font-sans-bold text-foreground">READ AT 10:04</Text>}>
			<Bubble variant="sent" text="Sent the contract." />
		</Message>
	);
}
