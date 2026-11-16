import { Menubar, type MenubarMenu } from "@workspace/ui-native/components/menubar";
import * as React from "react";

export function Menubar3Example(): React.JSX.Element {
	const [bookmarks, setBookmarks] = React.useState(true);
	const [urls, setUrls] = React.useState(false);
	const [theme, setTheme] = React.useState("system");
	const toggleView = React.useCallback((value: string): void => {
		if (value === "bookmarks") {
			setBookmarks((on: boolean): boolean => !on);
		} else {
			setUrls((on: boolean): boolean => !on);
		}
	}, []);
	const menus: readonly MenubarMenu[] = [
		{
			key: "view",
			label: "View",
			onSelect: toggleView,
			items: [
				{ value: "bookmarks", label: "Always show bookmarks bar", kind: "checkbox", checked: bookmarks },
				{ value: "urls", label: "Always show full URLs", kind: "checkbox", checked: urls },
			],
		},
		{
			key: "theme",
			label: "Theme",
			onSelect: setTheme,
			items: [
				{ value: "light", label: "Light", kind: "radio", checked: theme === "light" },
				{ value: "dark", label: "Dark", kind: "radio", checked: theme === "dark" },
				{ value: "system", label: "System", kind: "radio", checked: theme === "system" },
			],
		},
	];
	return <Menubar menus={menus} />;
}
