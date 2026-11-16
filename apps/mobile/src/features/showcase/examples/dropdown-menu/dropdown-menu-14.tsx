import MonitorIcon from "lucide-react-native/icons/monitor";
import MoonIcon from "lucide-react-native/icons/moon";
import SunIcon from "lucide-react-native/icons/sun";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

type Theme = "light" | "dark" | "system";
type Status = "online" | "away" | "busy";

const THEMES: readonly ToggleGroupOption<Theme>[] = [
	{ value: "light", label: "Light", icon: SunIcon },
	{ value: "dark", label: "Dark", icon: MoonIcon },
	{ value: "system", label: "System", icon: MonitorIcon },
];

export function DropdownMenu14Example(): React.JSX.Element {
	const [theme, setTheme] = React.useState<Theme | null>("system");
	const [status, setStatus] = React.useState<Status>("online");
	const items: readonly DropdownMenuItemData<string>[] = [
		{ value: "inbox", label: "Inbox", trailing: "12" },
		{ value: "mentions", label: "Mentions", trailing: "3" },
		{ value: "online", label: "Online", kind: "radio", checked: status === "online", group: "Status" },
		{ value: "away", label: "Away", kind: "radio", checked: status === "away", group: "Status" },
		{ value: "busy", label: "Do not disturb", kind: "radio", checked: status === "busy", group: "Status" },
	];
	const choose = React.useCallback((value: string): void => {
		if (value === "online" || value === "away" || value === "busy") {
			setStatus(value);
			return;
		}
		ignorePress();
	}, []);
	const header = (
		<View className="gap-3 pb-2">
			<View className="flex-row items-center gap-3">
				<Avatar name="Ava Patel" imageUrl={null} size="md" />
				<Text className="text-body-lg font-sans-semibold text-foreground">Ava Patel</Text>
			</View>
			<ToggleGroup type="single" label="Theme" hideLabels options={THEMES} value={theme} onChange={setTheme} spacing="attached" variant="outline" size="sm" />
		</View>
	);
	return <DropdownMenu label="Account" items={items} onSelect={choose} header={header} />;
}
