import { Bubble, type BubbleTone } from "@workspace/ui-native/components/bubble";
import * as React from "react";
import { View } from "react-native";

const TURNS: readonly { readonly tone: BubbleTone; readonly text: string; readonly sent: boolean }[] = [
	{ tone: "primary", text: "Shipping 2.4 to production now.", sent: true },
	{ tone: "secondary", text: "Build 2.4.0 is queued behind one other job.", sent: false },
	{ tone: "muted", text: "Migrations ran in 42 seconds.", sent: false },
	{ tone: "tinted", text: "Heads up: the feature flag is still off.", sent: false },
	{ tone: "outline", text: "Rollback plan is in the release notes.", sent: false },
	{ tone: "ghost", text: "Release notes updated.", sent: false },
	{ tone: "destructive", text: "Smoke test failed on checkout. Rolling back.", sent: false },
];

// One turn per tone in a release thread: from a status update to a failure notice.
export function Bubble2Example(): React.JSX.Element {
	return (
		<View className="w-full gap-2">
			{TURNS.map((turn): React.JSX.Element => (
				<Bubble key={turn.tone} text={turn.text} tone={turn.tone} variant={turn.sent ? "sent" : "received"} />
			))}
		</View>
	);
}
