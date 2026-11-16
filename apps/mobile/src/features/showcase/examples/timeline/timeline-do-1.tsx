import CheckIcon from "lucide-react-native/icons/check";
import CircleIcon from "lucide-react-native/icons/circle";
import { TimelineRailIcon, TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
import * as React from "react";
import { Text, View } from "react-native";

interface Entry {
	readonly key: string;
	readonly title: string;
	readonly time: string;
}

const ENTRIES: readonly Entry[] = [
	{ key: "placed", title: "Order placed", time: "Nov 12, 09:14" },
	{ key: "paid", title: "Payment confirmed", time: "Nov 12, 09:15" },
	{ key: "shipped", title: "Shipped", time: "Nov 13, 16:40" },
	{ key: "out", title: "Out for delivery", time: "Expected Nov 15" },
	{ key: "delivered", title: "Delivered", time: "—" },
];
/** The stage the order has reached (0-based). */
const CURRENT = 2;
export function TimelineDo1Example(): React.JSX.Element {
	return (
		<View>
			{ENTRIES.map((entry: Entry, index: number): React.JSX.Element => (
				<TimelineRailItem
					key={entry.key}
					node={<TimelineRailIcon icon={index <= CURRENT ? CheckIcon : CircleIcon} tone={index <= CURRENT ? "success" : "neutral"} size="sm" />}
					isLast={index === ENTRIES.length - 1}>
					<Text className="text-body font-sans-semibold text-foreground">{entry.title}</Text>
					<Text className="text-caption font-sans text-muted-foreground">{entry.time}</Text>
				</TimelineRailItem>
			))}
		</View>
	);
}
