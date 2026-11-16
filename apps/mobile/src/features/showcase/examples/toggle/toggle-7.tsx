import BellIcon from "lucide-react-native/icons/bell";
import { CountBadge } from "@workspace/ui-native/components/count-badge";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";
import { View } from "react-native";

export function Toggle7Example(): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(false);
	return (
		<View className="self-start">
			<Toggle label="Notifications, 3 new" icon={BellIcon} hideLabel pressed={pressed} onChange={setPressed} />
			<CountBadge count={3} className="absolute -top-1.5 -right-1.5" />
		</View>
	);
}
