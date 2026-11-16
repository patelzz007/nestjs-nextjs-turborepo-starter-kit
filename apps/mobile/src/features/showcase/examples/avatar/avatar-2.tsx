import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Icon } from "@workspace/ui-native/components/icon";
import UserIcon from "lucide-react-native/icons/user";
import { View } from "react-native";

// Photo-free placeholders: two-letter initials, and an icon for someone without a name.
export function Avatar2Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-3">
			<Avatar name="Ada Lovelace" imageUrl={null} />
			<View accessible accessibilityLabel="Unknown user" className="size-14 items-center justify-center rounded-full bg-muted">
				<Icon icon={UserIcon} size="md" colorClassName="accent-muted-foreground" />
			</View>
		</View>
	);
}
