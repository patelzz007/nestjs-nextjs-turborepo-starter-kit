import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import * as React from "react";
import { Text } from "react-native";

const TITLE = "System Analytics";
const DESCRIPTION = "Global traffic and usage patterns";

interface Panel {
	readonly heading: string | null;
	readonly text: string;
}

const PANELS: readonly Panel[] = [{ heading: "Performance Metrics", text: "Large spacing creates a focused, airy feel suitable for marketing pages or empty states." }];

export function Frame12Example(): React.JSX.Element {
	return (
		<Frame spacing="lg">
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
				<Text className="text-label font-sans text-muted-foreground">View full report</Text>
			</FrameFooter>
		</Frame>
	);
}
