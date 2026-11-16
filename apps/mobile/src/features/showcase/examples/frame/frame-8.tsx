import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import * as React from "react";
import { Text } from "react-native";

const TITLE = "Server Logs";
const DESCRIPTION = "Recent activity and errors";

interface Panel {
	readonly heading: string | null;
	readonly text: string;
}

const PANELS: readonly Panel[] = [
	{ heading: "Auth Service", text: "Successfully logged in user: admin" },
	{ heading: "Database", text: "Query execution time: 12ms" },
	{ heading: "Storage", text: "Upload complete: image.png" },
];

export function Frame8Example(): React.JSX.Element {
	return (
		<Frame stacked>
			<FrameHeader>
				<FrameTitle>{TITLE}</FrameTitle>
				<FrameDescription>{DESCRIPTION}</FrameDescription>
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
