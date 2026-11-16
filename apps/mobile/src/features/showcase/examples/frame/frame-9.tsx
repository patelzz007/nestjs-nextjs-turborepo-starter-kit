import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import * as React from "react";
import { Text } from "react-native";

const TITLE = "Project Configuration";
const DESCRIPTION = "Adjust your environment settings";

interface Panel {
	readonly heading: string | null;
	readonly text: string;
}

const PANELS: readonly Panel[] = [{ heading: "Environment Variables", text: "XS spacing is ideal for high-density toolbars and property panels." }];

export function Frame9Example(): React.JSX.Element {
	return (
		<Frame spacing="xs">
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
			<FrameFooter>
				<Text className="text-label font-sans text-muted-foreground">Updated 2m ago</Text>
			</FrameFooter>
		</Frame>
	);
}
