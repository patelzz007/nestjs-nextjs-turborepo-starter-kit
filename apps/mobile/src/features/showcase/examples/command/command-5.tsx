import FileIcon from "lucide-react-native/icons/file";
import { Badge } from "@workspace/ui-native/components/badge";
import { Icon } from "@workspace/ui-native/components/icon";
import { Button } from "@workspace/ui-native/components/button";
import { CommandPalette, type CommandPaletteGroup } from "@workspace/ui-native/components/command-palette";
import * as React from "react";

import { ignorePress } from "../example-support";

const FILE = <Icon icon={FileIcon} size="md" colorClassName="accent-muted-foreground" />;

const GROUPS: readonly CommandPaletteGroup[] = [
	{
		key: "files",
		title: "Files",
		items: [
			{ key: "page", label: "page.tsx", description: "app/(dashboard)/page.tsx", leading: FILE, trailing: <Badge label="TSX" size="sm" />, onSelect: ignorePress },
			{ key: "layout", label: "layout.tsx", description: "app/layout.tsx", leading: FILE, trailing: <Badge label="TSX" size="sm" />, onSelect: ignorePress },
			{ key: "readme", label: "README.md", description: "README.md", leading: FILE, trailing: <Badge label="MD" size="sm" />, onSelect: ignorePress },
			{ key: "tokens", label: "tokens.json", description: "packages/tokens/tokens.json", leading: FILE, trailing: <Badge label="JSON" size="sm" />, onSelect: ignorePress },
		],
	},
];

export function Command5Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Search files…" variant="outline" onPress={show} />
			<CommandPalette visible={open} onClose={hide} groups={GROUPS} title="Search files" placeholder="Type a command or search…" emptyMessage="No results found." />
		</>
	);
}
