import CreditCardIcon from "lucide-react-native/icons/credit-card";
import LogOutIcon from "lucide-react-native/icons/log-out";
import SettingsIcon from "lucide-react-native/icons/settings";
import UserIcon from "lucide-react-native/icons/user";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "profile", label: "Profile", icon: UserIcon },
	{ value: "billing", label: "Billing", icon: CreditCardIcon },
	{ value: "settings", label: "Settings", icon: SettingsIcon },
	{ value: "logout", label: "Log out", icon: LogOutIcon, variant: "destructive", group: "Session" },
];

export function DropdownMenu3Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	const choose = React.useCallback((value: string): void => {
		setPicked(value);
	}, []);
	return (
		<View className="gap-2">
			<DropdownMenu label="Open menu" items={ITEMS} onSelect={choose} />
			<Text className="text-body font-sans text-muted-foreground">{picked === null ? "Nothing chosen yet." : `Chose: ${picked}`}</Text>
		</View>
	);
}
