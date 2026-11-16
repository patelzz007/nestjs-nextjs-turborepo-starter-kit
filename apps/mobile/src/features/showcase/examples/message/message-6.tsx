import { Avatar } from "@workspace/ui-native/components/avatar";
import { Bubble } from "@workspace/ui-native/components/bubble";
import { Message } from "@workspace/ui-native/components/message";
import * as React from "react";
import { View } from "react-native";

import { PORTRAITS } from "./message-sample";

const LINES: readonly string[] = ["The staging deploy is green.", "Load test ran for an hour, p95 at 180 ms.", "Merging after lunch unless someone objects."];

// One sender's run: the name on the first row, the portrait on the last, and empty avatar slots keeping the rows aligned.
export function Message6Example(): React.JSX.Element {
	return (
		<View className="w-full gap-1">
			{LINES.map((line: string, index: number): React.JSX.Element => {
				const last = index === LINES.length - 1;
				return (
					<Message
						key={line}
						author={index === 0 ? "Ava Patel" : undefined}
						avatar={last ? <Avatar name="Ava Patel" imageUrl={PORTRAITS.ava} size="md" /> : <View className="size-8" />}>
						<Bubble text={line} />
					</Message>
				);
			})}
		</View>
	);
}
