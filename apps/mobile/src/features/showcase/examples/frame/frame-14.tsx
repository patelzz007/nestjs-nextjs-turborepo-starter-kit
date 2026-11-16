import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import * as React from "react";
import { Text } from "react-native";

const TITLE = "Media Library";
const DESCRIPTION = "Manage your assets and downloads";

interface Panel {
	readonly heading: string | null;
	readonly text: string;
}

const PANELS: readonly Panel[] = [{ heading: "Storage Capacity", text: "Medium radius is a versatile middle ground between sharp and rounded aesthetics." }];

export function Frame14Example(): React.JSX.Element {
	return (
		<Frame radius="md">
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
				<Text className="text-label font-sans text-muted-foreground">75% of 100GB used</Text>
			</FrameFooter>
		</Frame>
	);
}
