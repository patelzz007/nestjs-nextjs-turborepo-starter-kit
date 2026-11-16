import { Menubar, type MenubarMenu } from "@workspace/ui-native/components/menubar";
import * as React from "react";

import { ignorePress } from "../example-support";

export function MenubarDont1Example(): React.JSX.Element {
	const menus: readonly MenubarMenu[] = [
		{ key: "a", label: "File", onSelect: ignorePress, items: [{ value: "x", label: "Delete everything", variant: "destructive" }] },
		{ key: "b", label: "Edit", onSelect: ignorePress, items: [{ value: "y", label: "Undo" }] },
		{ key: "c", label: "View", onSelect: ignorePress, items: [{ value: "z", label: "Zoom" }] },
		{ key: "d", label: "Go", onSelect: ignorePress, items: [{ value: "w", label: "Back" }] },
		{ key: "e", label: "Tools", onSelect: ignorePress, items: [{ value: "v", label: "Logs" }] },
		{ key: "f", label: "Window", onSelect: ignorePress, items: [{ value: "u", label: "Close" }] },
		{ key: "g", label: "Help", onSelect: ignorePress, items: [{ value: "t", label: "Docs" }] },
	];
	return <Menubar menus={menus} />;
}
