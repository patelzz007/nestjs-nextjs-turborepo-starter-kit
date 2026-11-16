import { Menubar, type MenubarMenu } from "@workspace/ui-native/components/menubar";
import * as React from "react";

import { ignorePress } from "../example-support";

export function MenubarDo1Example(): React.JSX.Element {
	const menus: readonly MenubarMenu[] = [
		{
			key: "file",
			label: "File",
			onSelect: ignorePress,
			items: [
				{ value: "tab", label: "New tab", shortcut: ["⌘", "T"] },
				{ value: "window", label: "New window", shortcut: ["⌘", "N"] },
				{ value: "incognito", label: "New incognito window", disabled: true },
				{ value: "print", label: "Print…", shortcut: ["⌘", "P"], group: "Output" },
			],
		},
		{
			key: "edit",
			label: "Edit",
			onSelect: ignorePress,
			items: [
				{ value: "undo", label: "Undo", shortcut: ["⌘", "Z"] },
				{ value: "redo", label: "Redo", shortcut: ["⇧", "⌘", "Z"] },
				{ value: "cut", label: "Cut", group: "Clipboard" },
				{ value: "copy", label: "Copy", group: "Clipboard" },
			],
		},
	];
	return <Menubar menus={menus} />;
}
