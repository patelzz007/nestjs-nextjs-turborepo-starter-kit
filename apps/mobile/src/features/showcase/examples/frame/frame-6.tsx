import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import * as React from "react";
import { Text } from "react-native";
const TITLE = "No Outer Border";

interface Panel {
	readonly heading: string | null;
	readonly text: string;
}

const PANELS: readonly Panel[] = [{ heading: null, text: "The outer container of this frame has no border, only the background and panels are visible." }];

export function Frame6Example(): React.JSX.Element {
	return (
		<Frame variant="ghost">
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
