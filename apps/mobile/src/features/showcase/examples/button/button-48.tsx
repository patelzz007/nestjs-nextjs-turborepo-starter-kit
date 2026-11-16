import BellIcon from "lucide-react-native/icons/bell";
import { CountBadge } from "@workspace/ui-native/components/count-badge";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function Button48Example(): React.JSX.Element {
	return (
		<View className="self-start">
			<IconButton icon={BellIcon} label="Notifications, 3 unread" onPress={ignorePress} />
			<CountBadge count={3} className="absolute -top-1.5 -right-1.5" />
		</View>
	);
}
