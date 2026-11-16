import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";
import { Frame, FramePanel } from "@workspace/ui-native/components/frame";
import { Text } from "react-native";

import { PEOPLE } from "./avatar-sample";

// Compact social proof in a Frame: four developer photos and a caption.
export function Avatar21Example(): React.JSX.Element {
	return (
		<Frame className="w-full">
			<FramePanel className="flex-row items-center gap-3">
				<AvatarGroup label="Four developers" size="sm">
					{PEOPLE.slice(0, 4).map((person): React.JSX.Element => (
						<Avatar key={person.name} name={person.name} imageUrl={person.photo} size="sm" />
					))}
				</AvatarGroup>
				<Text className="text-label font-sans text-muted-foreground">Joined by 500+ developers</Text>
			</FramePanel>
		</Frame>
	);
}
