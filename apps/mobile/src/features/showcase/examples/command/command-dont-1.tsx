import { Button } from "@workspace/ui-native/components/button";
import { CommandPalette, type CommandPaletteGroup } from "@workspace/ui-native/components/command-palette";
import * as React from "react";

import { ignorePress } from "../example-support";

const GROUPS: readonly CommandPaletteGroup[] = [
	{
		key: "all",
		title: "Commands",
		items: [
			{ key: "a", label: "Do it", onSelect: ignorePress },
			{ key: "b", label: "Go", onSelect: ignorePress },
			{ key: "c", label: "Run", onSelect: ignorePress },
		],
	},
];

export function CommandDont1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Actions" variant="outline" onPress={show} />
			<CommandPalette visible={open} onClose={hide} groups={GROUPS} title="Command palette" placeholder="Type a command or search…" emptyMessage="No results found." />
		</>
	);
}
