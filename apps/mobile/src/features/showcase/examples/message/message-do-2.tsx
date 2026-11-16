import { Bubble } from "@workspace/ui-native/components/bubble";
import { Message } from "@workspace/ui-native/components/message";
import * as React from "react";
import { Text } from "react-native";

export function MessageDo2Example(): React.JSX.Element {
	return (
		<Message variant="sent" timestamp="10:04" footer={<Text className="text-caption font-sans text-muted-foreground">Read</Text>}>
			<Bubble variant="sent" text="Sent the contract." />
		</Message>
	);
}
