import BellIcon from "lucide-react-native/icons/bell";
import { CountBadge } from "@workspace/ui-native/components/count-badge";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const RICH = (
	<View className="gap-1">
		<Text className="text-caption font-sans-semibold text-background">3 new notifications</Text>
		<Text className="text-caption font-sans text-background">Ava commented on your post</Text>
		<Text className="text-caption font-sans text-background">Deploy to production finished</Text>
		<Text className="text-caption font-sans text-background">Ben invited you to Design</Text>
	</View>
);

export function Tooltip5Example(): React.JSX.Element {
	return (
		<Tooltip content="3 new: Ava commented, a deploy finished, Ben invited you." richContent={RICH} accessibilityLabel="Notifications" asChild>
			<View>
				<IconButton icon={BellIcon} label="Notifications" variant="secondary" onPress={ignorePress} />
				<CountBadge count={3} className="absolute -top-1 -right-1" />
			</View>
		</Tooltip>
	);
}
