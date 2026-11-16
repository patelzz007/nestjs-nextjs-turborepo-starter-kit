import BellIcon from "lucide-react-native/icons/bell";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Button } from "@workspace/ui-native/components/button";
import { CountBadge } from "@workspace/ui-native/components/count-badge";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const UNREAD = <View className="size-2 rounded-full bg-primary" />;

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "n1", label: "Ava commented on Roadmap", description: "2 minutes ago", leading: <Avatar name="Ava Patel" imageUrl={null} size="sm" />, trailing: "•" },
	{ value: "n2", label: "Ben invited you to Design", description: "1 hour ago", leading: <Avatar name="Ben Ortiz" imageUrl={null} size="sm" />, trailing: "•" },
	{ value: "n3", label: "Chloe shared a file", description: "Yesterday", leading: <Avatar name="Chloe Kim" imageUrl={null} size="sm" /> },
];

export function DropdownMenu11Example(): React.JSX.Element {
	const footer = <Button label="Mark all as read" variant="ghost" size="sm" onPress={ignorePress} />;
	return (
		<View className="flex-row items-center gap-2">
			<DropdownMenu label="Notifications" icon={BellIcon} size="icon" items={ITEMS} onSelect={ignorePress} footer={footer} leading={UNREAD} />
			<CountBadge count={2} />
		</View>
	);
}
