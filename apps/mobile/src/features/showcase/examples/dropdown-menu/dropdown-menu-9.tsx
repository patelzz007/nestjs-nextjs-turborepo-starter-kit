import LifeBuoyIcon from "lucide-react-native/icons/life-buoy";
import LogOutIcon from "lucide-react-native/icons/log-out";
import UserIcon from "lucide-react-native/icons/user";
import UsersIcon from "lucide-react-native/icons/users";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "profile", label: "Profile", icon: UserIcon },
	{ value: "team", label: "Team", icon: UsersIcon },
	{ value: "help", label: "Help", icon: LifeBuoyIcon },
	{ value: "logout", label: "Log out", icon: LogOutIcon, group: "Session" },
];

const AVATAR = <Avatar name="Ava Patel" imageUrl={null} size="sm" />;
const HEADER = (
	<View className="flex-row items-center gap-3 pb-2">
		<Avatar name="Ava Patel" imageUrl={null} size="md" />
		<View>
			<Text className="text-body-lg font-sans-semibold text-foreground">Ava Patel</Text>
			<Text className="text-body font-sans text-muted-foreground">ava@acme.com</Text>
		</View>
	</View>
);

export function DropdownMenu9Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	const choose = React.useCallback((value: string): void => {
		setPicked(value);
	}, []);
	return (
		<View className="gap-2">
			<DropdownMenu label="Ava Patel" leading={AVATAR} header={HEADER} items={ITEMS} onSelect={choose} />
			<Text className="text-body font-sans text-muted-foreground">{picked === null ? "Nothing chosen yet." : `Chose: ${picked}`}</Text>
		</View>
	);
}
