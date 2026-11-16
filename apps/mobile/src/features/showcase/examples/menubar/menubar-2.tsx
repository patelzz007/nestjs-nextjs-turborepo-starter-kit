import { Menubar, type MenubarMenu } from "@workspace/ui-native/components/menubar";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Menubar2Example(): React.JSX.Element {
	const menus: readonly MenubarMenu[] = [
		{
			key: "file",
			label: "File",
			onSelect: ignorePress,
			items: [
				{ value: "new", label: "New tab" },
				{
					value: "share",
					label: "Share",
					items: [
						{ value: "email", label: "Email link" },
						{ value: "messages", label: "Messages" },
						{ value: "notes", label: "Notes" },
					],
				},
			],
		},
		{
			key: "edit",
			label: "Edit",
			onSelect: ignorePress,
			items: [
				{ value: "undo", label: "Undo" },
				{
					value: "find",
					label: "Find",
					items: [
						{ value: "search", label: "Search the web" },
						{ value: "find-text", label: "Find…" },
						{ value: "next", label: "Find next" },
					],
				},
			],
		},
	];
	return <Menubar menus={menus} />;
}
