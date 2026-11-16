import InboxIcon from "lucide-react-native/icons/inbox";
import { Button } from "@workspace/ui-native/components/button";
import { CountBadge } from "@workspace/ui-native/components/count-badge";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function Button39Example(): React.JSX.Element {
	return (
		<View className="self-start">
			<Button label="Inbox" variant="outline" icon={InboxIcon} accessibilityLabel="Inbox, 8 unread" onPress={ignorePress} />
			<CountBadge count={8} className="absolute -top-2 -right-2" />
		</View>
	);
}
