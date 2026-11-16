import { ContextMenu } from "@workspace/ui-native/components/context-menu";
import type { DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const AREA = "Long press here";

function Area(): React.JSX.Element {
	return (
		<View className="rounded-card h-32 items-center justify-center border border-dashed border-input">
			<Text className="text-body font-sans text-muted-foreground">{AREA}</Text>
		</View>
	);
}

interface ShownBars {
	readonly bookmarks: boolean;
	readonly urls: boolean;
	readonly sidebar: boolean;
}

const INITIAL: ShownBars = { bookmarks: true, urls: true, sidebar: false };

export function ContextMenu6Example(): React.JSX.Element {
	const [shown, setShown] = React.useState<ShownBars>(INITIAL);
	const items: readonly DropdownMenuItemData<keyof ShownBars>[] = [
		{ value: "bookmarks", label: "Show bookmarks bar", kind: "checkbox", checked: shown.bookmarks },
		{ value: "urls", label: "Show full URLs", kind: "checkbox", checked: shown.urls },
		{ value: "sidebar", label: "Show sidebar", kind: "checkbox", checked: shown.sidebar },
	];
	const toggle = React.useCallback((key: keyof ShownBars): void => {
		setShown((current: ShownBars): ShownBars => ({ ...current, [key]: !current[key] }));
	}, []);
	return (
		<ContextMenu title="View" items={items} onSelect={toggle}>
			<Area />
		</ContextMenu>
	);
}
