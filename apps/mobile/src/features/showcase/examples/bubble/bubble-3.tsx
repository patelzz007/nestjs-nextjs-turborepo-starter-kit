import { Bubble } from "@workspace/ui-native/components/bubble";
import * as React from "react";
import { Text, View } from "react-native";

interface Entry {
	readonly id: string;
	readonly sent: boolean;
	readonly lines: readonly string[];
	readonly time: string;
}

const ENTRIES: readonly Entry[] = [
	{ id: "a", sent: false, lines: ["Morning!", "Did the invoices go out?", "Finance is asking."], time: "09:12" },
	{ id: "b", sent: true, lines: ["All 48 sent at 8:30.", "Two bounced, retrying now."], time: "09:14 · Delivered" },
];

// Consecutive lines from one sender grouped tight, a wider gap between senders, and a delivered time under each group.
export function Bubble3Example(): React.JSX.Element {
	return (
		<View className="w-full gap-5">
			{ENTRIES.map((entry: Entry): React.JSX.Element => (
				<View key={entry.id} className={entry.sent ? "items-end gap-1" : "items-start gap-1"}>
					{entry.lines.map((line: string): React.JSX.Element => (
						<Bubble key={line} text={line} variant={entry.sent ? "sent" : "received"} size="sm" />
					))}
					<Text className="text-caption px-1 font-sans text-muted-foreground">{entry.time}</Text>
				</View>
			))}
		</View>
	);
}
