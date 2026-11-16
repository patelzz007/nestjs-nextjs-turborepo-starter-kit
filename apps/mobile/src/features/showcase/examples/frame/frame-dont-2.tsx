import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import * as React from "react";
import { Text } from "react-native";
const TITLE = "Server Logs";

interface Panel {
	readonly heading: string | null;
	readonly text: string;
}

const PANELS: readonly Panel[] = [
	{ heading: "Auth Service", text: "Logged in user: admin" },
	{ heading: "Database", text: "Query took 12ms" },
	{ heading: "Storage", text: "Upload complete" },
	{ heading: "Cache", text: "Hit rate 98%" },
	{ heading: "Queue", text: "3 jobs waiting" },
	{ heading: "Search", text: "Index rebuilt" },
];

// Six separate panels for one log: a column of boxes where one stacked list would read as one thing.

export function FrameDont2Example(): React.JSX.Element {
	return (
		<Frame>
			<FrameHeader>
				<FrameTitle>{TITLE}</FrameTitle>
			</FrameHeader>
			{PANELS.map((panel: Panel, position: number): React.JSX.Element => (
				<FramePanel key={`${String(position)}-${panel.text}`} className="gap-1">
					{panel.heading === null ? null : <Text className="text-label font-sans-semibold text-foreground">{panel.heading}</Text>}
					<Text className="text-label font-sans text-muted-foreground">{panel.text}</Text>
				</FramePanel>
			))}
		</Frame>
	);
}
