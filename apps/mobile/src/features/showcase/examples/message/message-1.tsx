import { Bubble } from "@workspace/ui-native/components/bubble";
import { Message } from "@workspace/ui-native/components/message";
import * as React from "react";
import { View } from "react-native";

const TURNS: readonly { readonly id: string; readonly sent: boolean; readonly text: string }[] = [
	{ id: "1", sent: false, text: "Are we still on for 3?" },
	{ id: "2", sent: true, text: "Yes! Same room as last week." },
	{ id: "3", sent: false, text: "Perfect, see you there." },
];

// The bare two-sided pattern: no avatars or names, the bubble's side and colour say who spoke.
export function Message1Example(): React.JSX.Element {
	return (
		<View className="w-full gap-3">
			{TURNS.map((turn): React.JSX.Element => (
				<Message key={turn.id} variant={turn.sent ? "sent" : "received"}>
					<Bubble text={turn.text} variant={turn.sent ? "sent" : "received"} />
				</Message>
			))}
		</View>
	);
}
