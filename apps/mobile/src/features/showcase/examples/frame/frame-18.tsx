import { Frame, FramePanel } from "@workspace/ui-native/components/frame";
import * as React from "react";
import { Text } from "react-native";

interface Panel {
	readonly heading: string | null;
	readonly text: string;
}

const PANELS: readonly Panel[] = [
	{ heading: "Account Snapshot", text: "Active seats, usage limits, and billing status are ready for review." },
	{ heading: "Team Activity", text: "24 members signed in this week with no unresolved security alerts." },
];

export function Frame18Example(): React.JSX.Element {
	return (
		<Frame>
			{PANELS.map((panel: Panel, position: number): React.JSX.Element => (
				<FramePanel key={`${String(position)}-${panel.text}`} className="gap-1">
					{panel.heading === null ? null : <Text className="text-label font-sans-semibold text-foreground">{panel.heading}</Text>}
					<Text className="text-label font-sans text-muted-foreground">{panel.text}</Text>
				</FramePanel>
			))}
		</Frame>
	);
}
