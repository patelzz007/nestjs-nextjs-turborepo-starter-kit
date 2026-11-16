import BellIcon from "lucide-react-native/icons/bell";
import { Button } from "@workspace/ui-native/components/button";
import { HoverCard } from "@workspace/ui-native/components/hover-card";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const CONTENT = (
	<View className="gap-2">
		<Text className="text-body font-sans text-foreground">You have 5 unread notifications.</Text>
		<Button label="View all" variant="link" size="sm" onPress={ignorePress} className="self-start" />
	</View>
);

export function Tooltip16Example(): React.JSX.Element {
	return (
		<HoverCard content={CONTENT} accessibilityLabel="Unread notifications" size="md">
			<View>
				<IconButton icon={BellIcon} label="Notifications, 5 unread" variant="ghost" onPress={ignorePress} />
				<View className="absolute top-2 right-2 size-2 rounded-full bg-destructive" />
			</View>
		</HoverCard>
	);
}
