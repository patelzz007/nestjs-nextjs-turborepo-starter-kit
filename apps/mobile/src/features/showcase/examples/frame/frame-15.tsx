import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import * as React from "react";
import { Text } from "react-native";

const TITLE = "Team Collaboration";
const DESCRIPTION = "Invite and manage workspace members";

interface Panel {
	readonly heading: string | null;
	readonly text: string;
}

const PANELS: readonly Panel[] = [{ heading: "Active Members", text: "Large radius offers a modern, friendly appearance for social and collaborative interfaces." }];

export function Frame15Example(): React.JSX.Element {
	return (
		<Frame radius="lg">
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
				<Text className="text-label font-sans text-muted-foreground">3 members online</Text>
			</FrameFooter>
		</Frame>
	);
}
