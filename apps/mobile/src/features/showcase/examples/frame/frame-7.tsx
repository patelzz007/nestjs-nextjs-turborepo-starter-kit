import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import * as React from "react";
import { Text } from "react-native";

const TITLE = "Inventory Check";
const DESCRIPTION = "Real-time stock monitoring";

interface Panel {
	readonly heading: string | null;
	readonly text: string;
}

const PANELS: readonly Panel[] = [{ heading: "Warehouse A", text: "Dense mode removes outer padding for a more compact appearance." }];

export function Frame7Example(): React.JSX.Element {
	return (
		<Frame dense>
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
