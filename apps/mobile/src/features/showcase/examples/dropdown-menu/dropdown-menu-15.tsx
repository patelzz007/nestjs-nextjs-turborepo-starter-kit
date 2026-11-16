import PlusIcon from "lucide-react-native/icons/plus";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const CREATE: readonly DropdownMenuItemData<string>[] = [
	{ value: "customer", label: "Customer" },
	{ value: "order", label: "Order" },
	{ value: "invoice", label: "Invoice" },
];
const ACCOUNT: readonly DropdownMenuItemData<string>[] = [
	{ value: "profile", label: "Profile" },
	{ value: "billing", label: "Billing" },
	{ value: "signout", label: "Sign out", variant: "destructive", group: "Session" },
];
const AVATAR = <Avatar name="Ava Patel" imageUrl={null} size="sm" />;

export function DropdownMenu15Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<DropdownMenu label="New" icon={PlusIcon} variant="primary" items={CREATE} onSelect={ignorePress} />
			<DropdownMenu label="Account" size="icon" leading={AVATAR} variant="ghost" items={ACCOUNT} onSelect={ignorePress} />
		</View>
	);
}
